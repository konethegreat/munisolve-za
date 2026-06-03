const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../config/db.config');
const { sendVerificationEmail } = require('../services/email.service');

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
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
        errorCode: 'EMAIL_EXISTS',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP and store a SHA-256 hash of it (never store plaintext)
    const otp = generateOtp();
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const newUser = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
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
      },
    });

    // Fire-and-forget — don't fail registration if email delivery fails
    sendVerificationEmail(newUser.email, newUser.firstName, otp).catch((err) =>
      console.error('[REGISTER] Verification email failed to send:', err)
    );

    return res.status(201).json({
      success: true,
      message: 'Account created. Check your email for your verification code.',
      data: { user: newUser, token, expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
    });
  } catch (error) {
    console.error('[AUTH] register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      errorCode: 'REGISTRATION_ERROR',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
    });
  }
};

// ── Login ──────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(401).json({
        success: false, message: 'Invalid email or password', errorCode: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false, message: 'Your account has been deactivated.', errorCode: 'ACCOUNT_DEACTIVATED',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await prisma.activityLog.create({
        data: {
          userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id,
          description: `Failed login attempt for ${email}`,
          ipAddress: req.ip, userAgent: req.get('User-Agent'),
        },
      });
      return res.status(401).json({
        success: false, message: 'Invalid email or password', errorCode: 'INVALID_CREDENTIALS',
      });
    }

    const token = makeJwt(user);

    await Promise.all([
      prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }),
      prisma.activityLog.create({
        data: {
          userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id,
          description: `User logged in: ${email}`,
          ipAddress: req.ip, userAgent: req.get('User-Agent'),
        },
      }),
    ]);

    const { password: _, emailVerifToken: __, emailVerifExpiry: ___, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser, token, expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
    });
  } catch (error) {
    console.error('[AUTH] login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed.', errorCode: 'LOGIN_ERROR' });
  }
};

// ── Google OAuth ───────────────────────────────────────────────────────────

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

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
      },
    });

    const { password: _, emailVerifToken: __, emailVerifExpiry: ___, ...safeUser } = user;

    return res.status(200).json({ success: true, data: { user: safeUser, token } });
  } catch (error) {
    console.error('[AUTH] googleLogin error:', error);
    return res.status(401).json({ success: false, message: 'Invalid Google token' });
  }
};

// ── Send / Resend Verification OTP ────────────────────────────────────────

const sendVerificationOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Don't reveal whether the account exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a code has been sent.',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'This account is already verified.',
        errorCode: 'ALREADY_VERIFIED',
      });
    }

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
  } catch (error) {
    console.error('[AUTH] sendVerificationOtp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send verification code.' });
  }
};

// ── Verify Email with OTP ──────────────────────────────────────────────────

const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and code are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(400).json({
        success: false, message: 'Invalid or expired code.', errorCode: 'INVALID_CODE',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false, message: 'Account is already verified.', errorCode: 'ALREADY_VERIFIED',
      });
    }

    if (!user.emailVerifToken || !user.emailVerifExpiry) {
      return res.status(400).json({
        success: false, message: 'No verification code found. Request a new one.', errorCode: 'NO_CODE',
      });
    }

    if (new Date() > user.emailVerifExpiry) {
      return res.status(400).json({
        success: false, message: 'Code has expired. Request a new one.', errorCode: 'CODE_EXPIRED',
      });
    }

    const submittedHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(submittedHash, 'hex'),
      Buffer.from(user.emailVerifToken, 'hex')
    );

    if (!isValid) {
      return res.status(400).json({
        success: false, message: 'Invalid code. Please try again.', errorCode: 'INVALID_CODE',
      });
    }

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
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      data: { user: updated },
    });
  } catch (error) {
    console.error('[AUTH] verifyEmail error:', error);
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

// ── Get Current User ───────────────────────────────────────────────────────

const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, role: true, isActive: true, isVerified: true,
        createdAt: true, lastLogin: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('[AUTH] getCurrentUser error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve user' });
  }
};

// ── Logout ─────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId: req.user.id, action: 'LOGOUT', entity: 'User', entityId: req.user.id,
        description: `User logged out: ${req.user.email}`,
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      },
    });
    return res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

module.exports = { register, login, googleLogin, sendVerificationOtp, verifyEmail, getCurrentUser, logout };
