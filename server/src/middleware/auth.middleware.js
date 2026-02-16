// ==========================================
// AUTHENTICATION MIDDLEWARE (Updated)
// ==========================================
// This middleware verifies JWT tokens and authenticates users
// Author: MuniSolve ZA Security Team
// Last Updated: February 2026

// Import required packages
const jwt = require('jsonwebtoken'); // For JWT token verification

const prisma = require('../config/db.config'); // Import Prisma Client from centralized config

/**
 * ==========================================
 * AUTHENTICATION MIDDLEWARE FUNCTION
 * ==========================================
 * Purpose: Verify that the user has a valid JWT token
 * Process Flow:
 * 1. Extract token from Authorization header
 * 2. Verify token signature and expiration
 * 3. Decode token to get user ID
 * 4. Fetch user from database to ensure account still exists
 * 5. Attach user object to request for downstream use
 * 6. Allow request to proceed to next middleware/route handler
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticate = async (req, res, next) => {
  try {
    // STEP 1: Extract the token from the request header
    const authHeader = req.headers.authorization;
    
    // Check if Authorization header exists
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.',
        errorCode: 'NO_TOKEN'
      });
    }
    
    // Check if header follows "Bearer <token>" format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format. Use: Bearer <token>',
        errorCode: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    // Extract the actual token
    const token = authHeader.split(' ')[1];
    
    // Verify token is not empty
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is empty.',
        errorCode: 'EMPTY_TOKEN'
      });
    }
    
    // STEP 2: Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please log in again.',
          errorCode: 'TOKEN_EXPIRED',
          expiredAt: jwtError.expiredAt
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token.',
          errorCode: 'INVALID_TOKEN'
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Token verification failed.',
          errorCode: 'TOKEN_VERIFICATION_FAILED'
        });
      }
    }
    
    // STEP 3: Fetch the user from the database
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true
      }
    });
    
    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found. Please log in again.',
        errorCode: 'USER_NOT_FOUND'
      });
    }
    
    // STEP 4: Check if user account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.',
        errorCode: 'ACCOUNT_DEACTIVATED'
      });
    }
    
    // STEP 5: Attach user to request
    req.user = user;
    req.token = token;
    
    console.log(`[AUTH] User authenticated: ${user.email} (${user.role})`);
    
    // STEP 6: Proceed to next middleware
    next();
    
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
      errorCode: 'AUTH_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error.message
      })
    });
  }
};

/**
 * ==========================================
 * OPTIONAL AUTHENTICATION MIDDLEWARE
 * ==========================================
 * Purpose: Try to authenticate, but allow request even if no token
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true
      }
    });
    
    if (user && user.isActive) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
    console.log('[OPTIONAL_AUTH] Token invalid, continuing as guest');
  }
  
  next();
};

// ==========================================
// EXPORT MIDDLEWARE FUNCTIONS
// ==========================================
module.exports = {
  authenticate,
  optionalAuthenticate
};