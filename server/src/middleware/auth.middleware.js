// ==========================================
// AUTHENTICATION MIDDLEWARE (Updated)
// ==========================================
// This middleware verifies JWT tokens and authenticates users
// Author: MuniSolve ZA Security Team
// Last Updated: February 2026

// Import required packages
const jwt = require('jsonwebtoken'); // For JWT token verification

const prisma = require('../config/db.config'); // Import Prisma Client from centralized config
const { AppError } = require('../errors/AppError');

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
  // STEP 1: Extract the token from the request header
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists
  if (!authHeader) throw new AppError(401, 'NO_TOKEN', 'Access denied. No authentication token provided.');

  // Check if header follows "Bearer <token>" format
  if (!authHeader.startsWith('Bearer ')) throw new AppError(401, 'INVALID_TOKEN_FORMAT', 'Invalid token format. Use: Bearer <token>');

  // Extract the actual token
  const token = authHeader.split(' ')[1];

  // Verify token is not empty
  if (!token) throw new AppError(401, 'EMPTY_TOKEN', 'Authentication token is empty.');

  // STEP 2: Verify the JWT token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtError) {
    if (jwtError.name === 'TokenExpiredError') throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
    if (jwtError.name === 'JsonWebTokenError') throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
    throw new AppError(401, 'TOKEN_VERIFICATION_FAILED', 'Token verification failed.');
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
  if (!user) throw new AppError(401, 'USER_NOT_FOUND', 'User account not found. Please log in again.');

  // STEP 4: Check if user account is active
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'Your account has been deactivated. Contact support.');

  // STEP 5: Attach user to request
  req.user = user;
  req.token = token;

  console.log(`[AUTH] User authenticated: ${user.email} (${user.role})`);

  // STEP 6: Proceed to next middleware
  next();
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