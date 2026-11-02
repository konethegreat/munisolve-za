const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../config/db.config');
const { AppError } = require('../errors/AppError');
const { sendVerificationEmail } = require('../services/email.service');
const { logger } = require('../logger');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Helpers ────────────────────────────────────────────────────────────────

function generateOtp() {
  // Cryptographically random 6-digit code (000000–999999)
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function makeJwt(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

// ── Register ───────────────────────────────────────────────────────────────

const register = async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.validated.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');

  const hashedPassword = await bcrypt.hash(password, 12);

  // Generate OTP and store a SHA-256 hash of it (never store plaintext)
  const otp = generateOtp();
  const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const newUser = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone: phone || null,
      role: 'CITIZEN',
      isActive: true,
      isVerified: false,
      emailVerifToken: tokenHash,
      emailVerifExpiry: expiry,
    },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      phone: true, role: true, isActive: true, isVerified: true, createdAt: true,
    },
  });

  const token = makeJwt(newUser);

  await prisma.activityLog.create({
    data: {
      userId: newUser.id, action: 'REGISTER', entity: 'User', entityId: newUser.id,
      description: `New user registered: ${email}`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'),
      requestId: req.id,
    },
  });

  // Fire-and-forget — don't fail registration if email delivery fails
  sendVerificationEmail(newUser.email, newUser.firstName, otp).catch((err) =>
    logger.error({ err }, 'Verification email failed')
  );

  return res.status(201).json({
    success: true,
    message: 'Account created. Check your email for your verification code.',
    data: { user: newUser, token, expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  });
};

// ── Login ──────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  const { email, password } = req.validated.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'Your account has been deactivated.');

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    await prisma.activityLog.create({
      data: {
        userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id,
        description: `Failed login attempt for ${email}`,
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
        requestId: req.id,
      },
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = makeJwt(user);

  await Promise.all([
    prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }),
    prisma.activityLog.create({
      data: {
        userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id,
        description: `User logged in: ${email}`,
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
        requestId: req.id,
      },
    }),
  ]);

  const { password: _, emailVerifToken: __, emailVerifExpiry: ___, ...safeUser } = user;

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user: safeUser, token, expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  });
};

// ── Google OAuth ───────────────────────────────────────────────────────────

const googleLogin = async (req, res) => {
  const { idToken } = req.validated.body;

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Invalid Google token');
  }

  const payload = ticket.getPayload();
  const { email, given_name, family_name, sub: googleId } = payload;

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, isVerified: true, lastLogin: new Date() },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email,
        firstName: given_name,
        lastName: family_name || '',
        googleId,
        password: '',
        phone: 'N/A',
        role: 'CITIZEN',
        isVerified: true,
      },
    });
  }

  // BUG FIX: was { id: user.id } — auth.middleware.js reads decoded.userId
  const token = makeJwt(user);

  await prisma.activityLog.create({
    data: {
      userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id,
      description: `Google login: ${email}`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'),
      requestId: req.id,
    },
  });

  const { password: _, emailVerifToken: __, emailVerifExpiry: ___, ...safeUser } = user;

  return res.status(200).json({ success: true, data: { user: safeUser, token } });
};

// ── Send / Resend Verification OTP ────────────────────────────────────────

const sendVerificationOtp = async (req, res) => {
  const { email } = req.validated.body;

  const user = await prisma.user.findUnique({ where: { email } });

  // Don't reveal whether the account exists
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a code has been sent.',
    });
  }

  if (user.isVerified) throw new AppError(400, 'ALREADY_VERIFIED', 'This account is already verified.');

  const otp = generateOtp();
  const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifToken: tokenHash, emailVerifExpiry: expiry },
  });

  await sendVerificationEmail(user.email, user.firstName, otp);

  return res.status(200).json({
    success: true,
    message: 'Verification code sent. Check your inbox.',
  });
};

// ── Verify Email with OTP ──────────────────────────────────────────────────

const verifyEmail = async (req, res) => {
  const { email, otp } = req.validated.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new AppError(400, 'INVALID_CODE', 'Invalid or expired code.');
  if (user.isVerified) throw new AppError(400, 'ALREADY_VERIFIED', 'Account is already verified.');
  if (!user.emailVerifToken || !user.emailVerifExpiry) throw new AppError(400, 'NO_CODE', 'No verification code found. Request a new one.');
  if (new Date() > user.emailVerifExpiry) throw new AppError(400, 'CODE_EXPIRED', 'Code has expired. Request a new one.');

  const submittedHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
  const isValid = crypto.timingSafeEqual(
    Buffer.from(submittedHash, 'hex'),
    Buffer.from(user.emailVerifToken, 'hex')
  );

  if (!isValid) throw new AppError(400, 'INVALID_CODE', 'Invalid code. Please try again.');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, emailVerifToken: null, emailVerifExpiry: null },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      phone: true, role: true, isActive: true, isVerified: true, createdAt: true, lastLogin: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id, action: 'EMAIL_VERIFIED', entity: 'User', entityId: user.id,
      description: `Email verified for ${email}`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'),
      requestId: req.id,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'Email verified successfully.',
    data: { user: updated },
  });
};

// ── Get Current User ───────────────────────────────────────────────────────

const getCurrentUser = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      phone: true, role: true, isActive: true, isVerified: true,
      createdAt: true, lastLogin: true,
    },
  });

  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  return res.status(200).json({ success: true, data: user });
};

// ── Logout ─────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  await prisma.activityLog.create({
    data: {
      userId: req.user.id, action: 'LOGOUT', entity: 'User', entityId: req.user.id,
      description: `User logged out: ${req.user.email}`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'),
      requestId: req.id,
    },
  });
  return res.status(200).json({ success: true, message: 'Logout successful' });
};

module.exports = { register, login, googleLogin, sendVerificationOtp, verifyEmail, getCurrentUser, logout };
