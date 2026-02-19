// ==========================================
// AUTHENTICATION CONTROLLER (Fixed)
// ==========================================
// Handles user registration, login, and authentication logic
// Author: MuniSolve ZA Development Team
// Last Updated: February 2026

const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../config/db.config');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==========================================
// USER REGISTRATION
// ==========================================
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    // STEP 1: Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
        errorCode: 'EMAIL_EXISTS'
      });
    }

    // STEP 2: Hash the password
    console.log('[AUTH] Hashing password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // STEP 3: Create user in database
    console.log(`[AUTH] Creating user account for: ${email}`);
    const newUser = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone || null,
        role: 'CITIZEN',
        isActive: true,
        isVerified: false
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true
      }
    });

    // STEP 4: Generate JWT token (Fixed user.id -> newUser.id)
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    );

    // STEP 5: Log activity (Fixed user.id -> newUser.id)
    await prisma.activityLog.create({
      data: {
        userId: newUser.id,
        action: 'REGISTER',
        entity: 'User',
        entityId: newUser.id,
        description: `New user registered: ${email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    console.log(`[AUTH] User registered successfully: ${email}`);

    // STEP 6: Return success response
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: newUser,
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });

  } catch (error) {
    console.error('[AUTH ERROR] Registration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      errorCode: 'REGISTRATION_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error.message
      })
    });
  }
};

// ==========================================
// USER LOGIN
// ==========================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`[AUTH] Login attempt for: ${email}`);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.',
        errorCode: 'ACCOUNT_DEACTIVATED'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: user.id,
          description: `Failed login attempt for ${email}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        description: `User logged in: ${email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });

  } catch (error) {
    console.error('[AUTH ERROR] Login failed:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed.',
      errorCode: 'LOGIN_ERROR'
    });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, given_name, family_name, sub: googleId } = payload;

    let user = await prisma.user.upsert({
      where: { email },
      update: { googleId },
      create: {
        email,
        firstName: given_name,
        lastName: family_name || '',
        googleId,
        password: '', 
        phone: 'N/A',
        role: 'CITIZEN'
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      success: true,
      data: { user, token }
    });

  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ success: false, message: 'Invalid Google Token' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('[AUTH ERROR] Get current user failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user'
    });
  }
};

const logout = async (req, res) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'LOGOUT',
        entity: 'User',
        entityId: req.user.id,
        description: `User logged out: ${req.user.email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  logout,
  googleLogin
};