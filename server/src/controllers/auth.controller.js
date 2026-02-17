// ==========================================
// AUTHENTICATION CONTROLLER (Updated)
// ==========================================
// Handles user registration, login, and authentication logic
// Author: MuniSolve ZA Development Team
// Last Updated: February 2026

// Import required packages
const bcrypt = require('bcryptjs'); // Password hashing



// Import Prisma Client from centralized config
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library'); // For Google OAuth
const prisma = require('../config/db.config');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==========================================
// USER REGISTRATION
// ==========================================
/**
 * Register a new user account
 * 
 * Process:
 * 1. Check if email already exists
 * 2. Hash the password using bcrypt
 * 3. Create user in database
 * 4. Generate JWT token
 * 5. Return user data and token
 * 
 * @route POST /api/auth/register
 * @access Public (no authentication required)
 */
const register = async (req, res) => {
  try {
    // Extract data from request body
    // Validation middleware has already checked these fields
    const { firstName, lastName, email, password, phone } = req.body;

    // STEP 1: Check if email already exists
    // This prevents duplicate accounts
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      // Email is already registered
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
        errorCode: 'EMAIL_EXISTS',
        hint: 'Try logging in or use the "Forgot Password" feature'
      });
    }

    // STEP 2: Hash the password
    // NEVER store plain text passwords!
    // Salt rounds = 12 (good balance of security and performance)
    console.log('[AUTH] Hashing password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // STEP 3: Create user in database
    console.log(`[AUTH] Creating user account for: ${email}`);
    const newUser = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(), // Store email in lowercase for consistency
        password: hashedPassword,   // Store hashed password
        phone: phone || null,        // Phone is optional
        role: 'CITIZEN',             // Default role for new registrations
        isActive: true,              // Account is active by default
        isVerified: false            // Email not verified yet
      },
      // Select fields to return (exclude password!)
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

    // STEP 4: Generate JWT token
    // Token contains user ID, email, and role
    const token = jwt.sign(
      {
        userId: user.id,
        email: newUser.email,
        role: newUser.role
      },
      process.env.JWT_SECRET, // Secret key from .env
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h' // Token expires in 24 hours
      }
    );

    // STEP 5: Log activity for security audit
    await prisma.activityLog.create({
      data: {
        userId: user.id,
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
      },
      // Helpful next steps for the user
      nextSteps: [
        'Please verify your email address',
        'Complete your profile information',
        'Start reporting municipal issues'
      ]
    });

  } catch (error) {
    // Log the error for debugging
    console.error('[AUTH ERROR] Registration failed:', error);

    // Return error response
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      errorCode: 'REGISTRATION_ERROR',
      // Include error details only in development
      ...(process.env.NODE_ENV === 'development' && {
        debug: error.message
      })
    });
  }
};

// ==========================================
// USER LOGIN
// ==========================================
/**
 * Authenticate user and generate JWT token
 * 
 * Process:
 * 1. Find user by email
 * 2. Check if account is active
 * 3. Verify password
 * 4. Generate JWT token
 * 5. Update last login time
 * 6. Return user data and token
 * 
 * @route POST /api/auth/login
 * @access Public (no authentication required)
 */
const login = async (req, res) => {
  try {
    // Extract credentials from request body
    const { email, password } = req.body;

    // STEP 1: Find user by email
    console.log(`[AUTH] Login attempt for: ${email}`);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Check if user exists
    if (!user) {
      // User not found
      // Don't reveal whether email exists (security best practice)
      console.log(`[AUTH] Login failed: User not found - ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    // STEP 2: Check if account is active
    if (!user.isActive) {
      // Account has been deactivated
      console.log(`[AUTH] Login failed: Account deactivated - ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
        errorCode: 'ACCOUNT_DEACTIVATED',
        support: 'support@munisolve.za'
      });
    }

    // STEP 3: Verify password
    console.log('[AUTH] Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Password is incorrect
      console.log(`[AUTH] Login failed: Invalid password - ${email}`);
      
      // Log failed login attempt for security monitoring
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

    // STEP 4: Generate JWT token
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

    // STEP 5: Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // STEP 6: Log successful login
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

    console.log(`[AUTH] Login successful: ${email}`);

    // STEP 7: Return success response
    // Exclude password from response
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
      message: 'Login failed. Please try again.',
      errorCode: 'LOGIN_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error.message
      })
    });
  }
};



const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    console.log("Token received length:", idToken?.length);
    console.log("Using Backend Client ID:", process.env.GOOGLE_CLIENT_ID);

    // 1. Verify the token with Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, given_name, family_name, sub: googleId } = payload;

    // 2. Find or Create the user in your database
    // We use 'upsert' so it updates existing users or creates new ones
    let user = await prisma.user.upsert({
      where: { email },
      update: { googleId },
      create: {
        email,
        firstName: given_name,
        lastName: family_name || '',
        googleId,
        password: '', // No password needed for Google users
        phone: 'N/A',  // Default value
        role: 'CITIZEN'
      },
    });

    // 3. Generate your App's JWT token (just like regular login)
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
// ==========================================
// GET CURRENT USER
// ==========================================
/**
 * Get current authenticated user's information
 * 
 * @route GET /api/auth/me
 * @access Private (requires authentication)
 */
const getCurrentUser = async (req, res) => {
  try {
    // User is already attached to req by authenticate middleware
    // We just need to fetch fresh data from database
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
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND'
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
      message: 'Failed to retrieve user information',
      errorCode: 'GET_USER_ERROR'
    });
  }
};

// ==========================================
// LOGOUT
// ==========================================
/**
 * Logout user (client-side token removal)
 * 
 * Note: Since we use JWT, actual logout happens on client-side
 * Server just logs the logout event for audit purposes
 * 
 * @route POST /api/auth/logout
 * @access Private (requires authentication)
 */
const logout = async (req, res) => {
  try {
    // Log logout event
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

    console.log(`[AUTH] User logged out: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      hint: 'Please remove the token from client storage'
    });

  } catch (error) {
    console.error('[AUTH ERROR] Logout failed:', error);

    res.status(500).json({
      success: false,
      message: 'Logout failed',
      errorCode: 'LOGOUT_ERROR'
    });
  }
};

// ==========================================
// EXPORT CONTROLLER FUNCTIONS
// ==========================================
module.exports = {
  register,
  login,
  getCurrentUser,
  logout,
  googleLogin
};