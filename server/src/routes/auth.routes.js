// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
// Defines all authentication-related endpoints
// Author: MuniSolve ZA Development Team
// Last Updated: February 2026

const express = require('express');
const router = express.Router();

// Import controllers
const {
  register,
  login,
  getCurrentUser,
  logout
} = require('../controllers/auth.controller');

// Import middleware
const { authenticate } = require('../middleware/auth.middleware');
const {
  validateRegistration,
  validateLogin,
  handleValidationErrors
} = require('../middleware/validation.middleware');
const {
  authLimiter,
  passwordResetLimiter
} = require('../middleware/rateLimit.middleware');

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 * 
 * Request body:
 * {
 *   "firstName": "Thabo",
 *   "lastName": "Mbeki",
 *   "email": "thabo@example.com",
 *   "password": "SecurePass123!",
 *   "phone": "0123456789" (optional)
 * }
 * 
 * Success response (201):
 * {
 *   "success": true,
 *   "message": "Account created successfully",
 *   "data": {
 *     "user": { ...user object... },
 *     "token": "jwt_token_here",
 *     "expiresIn": "24h"
 *   }
 * }
 */
router.post(
  '/register',
  authLimiter,              // Rate limit: 5 attempts per 15 minutes
  validateRegistration,     // Validate all input fields
  handleValidationErrors,   // Check if validation passed
  register                  // Controller function
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get JWT token
 * @access  Public
 * 
 * Request body:
 * {
 *   "email": "thabo@example.com",
 *   "password": "SecurePass123!"
 * }
 * 
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": {
 *     "user": { ...user object... },
 *     "token": "jwt_token_here",
 *     "expiresIn": "24h"
 *   }
 * }
 */
router.post(
  '/login',
  authLimiter,              // Rate limit: 5 attempts per 15 minutes
  validateLogin,            // Validate email and password format
  handleValidationErrors,   // Check if validation passed
  login                     // Controller function
);

// ==========================================
// PROTECTED ROUTES (Authentication required)
// ==========================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user's information
 * @access  Private (requires valid JWT token)
 * 
 * Headers:
 * Authorization: Bearer <jwt_token>
 * 
 * Success response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user_uuid",
 *     "firstName": "Thabo",
 *     "lastName": "Mbeki",
 *     "email": "thabo@example.com",
 *     "role": "CITIZEN",
 *     ...
 *   }
 * }
 */
router.get(
  '/me',
  authenticate,             // Verify JWT token and attach user to req
  getCurrentUser            // Controller function
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (logs the event, token removed client-side)
 * @access  Private (requires valid JWT token)
 * 
 * Headers:
 * Authorization: Bearer <jwt_token>
 * 
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Logout successful"
 * }
 */
router.post(
  '/logout',
  authenticate,             // Verify JWT token
  logout                    // Controller function
);

// ==========================================
// FUTURE ROUTES (Placeholders)
// ==========================================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 * 
 * TODO: Implement password reset functionality
 * 
 * Request body:
 * {
 *   "email": "user@example.com"
 * }
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,     // Rate limit: 3 attempts per hour
  (req, res) => {
    // Placeholder response
    res.status(501).json({
      success: false,
      message: 'Password reset feature coming soon',
      errorCode: 'NOT_IMPLEMENTED',
      hint: 'This feature will be implemented in Phase 2'
    });
  }
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token from email
 * @access  Public
 * 
 * TODO: Implement password reset functionality
 * 
 * Request body:
 * {
 *   "token": "reset_token_from_email",
 *   "newPassword": "NewSecurePass123!"
 * }
 */
router.post(
  '/reset-password',
  (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Password reset feature coming soon',
      errorCode: 'NOT_IMPLEMENTED'
    });
  }
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user's email address
 * @access  Public
 * 
 * TODO: Implement email verification
 * 
 * Request body:
 * {
 *   "token": "verification_token_from_email"
 * }
 */
router.post(
  '/verify-email',
  (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Email verification feature coming soon',
      errorCode: 'NOT_IMPLEMENTED'
    });
  }
);

// Export the router
module.exports = router;

// ==========================================
// TESTING THESE ROUTES
// ==========================================
/*

You can test these routes using:
1. Postman
2. Thunder Client (VS Code extension)
3. curl commands
4. Your React frontend

EXAMPLE CURL COMMANDS:

1. Register a new user:
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Thabo",
    "lastName": "Mbeki",
    "email": "thabo@example.com",
    "password": "SecurePass123!",
    "phone": "0123456789"
  }'

2. Login:
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "thabo@example.com",
    "password": "SecurePass123!"
  }'

3. Get current user (replace TOKEN with actual JWT):
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

4. Logout (replace TOKEN with actual JWT):
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

*/