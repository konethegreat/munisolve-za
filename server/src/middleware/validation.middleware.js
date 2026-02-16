// ==========================================
// INPUT VALIDATION & SANITIZATION MIDDLEWARE
// ==========================================
// Protects against injection attacks, XSS, and invalid data
// Uses express-validator for comprehensive validation
// Author: MuniSolve ZA Security Team
// Last Updated: February 2026

// Import express-validator functions
// These provide comprehensive input validation and sanitization
const { body, param, query, validationResult } = require('express-validator');

/**
 * ==========================================
 * WHY INPUT VALIDATION IS CRITICAL
 * ==========================================
 * 
 * Security Threats Without Validation:
 * 1. SQL Injection: Malicious SQL in inputs
 *    Example: email = "' OR '1'='1"
 *    Result: Could expose entire database
 * 
 * 2. XSS (Cross-Site Scripting): Malicious JavaScript in inputs
 *    Example: description = "<script>alert('hacked')</script>"
 *    Result: Could steal user sessions, redirect users
 * 
 * 3. NoSQL Injection: Malicious queries in MongoDB-like databases
 *    Example: { "password": { "$gt": "" } }
 *    Result: Could bypass authentication
 * 
 * 4. Path Traversal: Accessing unauthorized files
 *    Example: filename = "../../etc/passwd"
 *    Result: Could read sensitive system files
 * 
 * 5. Data Corruption: Invalid data types causing crashes
 *    Example: age = "not a number"
 *    Result: Application errors, poor user experience
 * 
 * Our Defense: Validate EVERYTHING from the user
 */

/**
 * ==========================================
 * VALIDATION ERROR HANDLER
 * ==========================================
 * Purpose: Check if validation failed and return errors
 * This middleware should run AFTER validation chains
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * USAGE:
 * router.post('/register',
 *   validateRegistration,  // Validation rules
 *   handleValidationErrors, // Check if validation passed
 *   registerUser           // Only runs if validation passed
 * );
 */
const handleValidationErrors = (req, res, next) => {
  // Extract validation errors from request
  // validationResult() collects all errors from validation chains
  const errors = validationResult(req);
  
  // Check if there are any validation errors
  if (!errors.isEmpty()) {
    // Validation failed - return errors to client
    
    // Format errors for better readability
    // errors.array() returns: [{ msg: '...', param: '...', location: '...' }, ...]
    const formattedErrors = errors.array().map(error => ({
      field: error.param,     // Which field has the error
      message: error.msg,     // What's wrong with it
      value: error.value,     // The invalid value (for debugging)
      location: error.location // Where it was found (body, query, params)
    }));
    
    // Log validation failure (helps with debugging and security monitoring)
    console.warn('[VALIDATION] Request failed validation:', {
      path: req.path,
      method: req.method,
      errors: formattedErrors,
      // Don't log the full body (might contain passwords)
      // But log which fields were submitted
      submittedFields: Object.keys(req.body || {})
    });
    
    // Return 400 Bad Request with detailed error information
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please check your input.',
      errorCode: 'VALIDATION_ERROR',
      errors: formattedErrors,
      // Count of errors (useful for frontend)
      errorCount: formattedErrors.length
    });
  }
  
  // No validation errors - proceed to next middleware
  next();
};

/**
 * ==========================================
 * USER REGISTRATION VALIDATION
 * ==========================================
 * Validates all fields when a new user registers
 * Prevents: Invalid emails, weak passwords, XSS attacks, missing data
 */
const validateRegistration = [
  // FIRST NAME validation
  body('firstName')
    // Check that field exists and is not empty
    .notEmpty()
    .withMessage('First name is required')
    
    // Trim whitespace from beginning and end
    // "  John  " becomes "John"
    .trim()
    
    // Check length constraints
    // Names should be reasonable length
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    
    // Only allow letters, spaces, hyphens, and apostrophes
    // Valid: "Mary-Jane", "O'Brien", "De La Cruz"
    // Invalid: "John123", "User<script>"
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    
    // Sanitize to prevent XSS attacks
    // Removes any HTML tags or dangerous characters
    .escape(),
  
  // LAST NAME validation (similar to first name)
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  
  // EMAIL validation
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    
    // Normalize email: convert to lowercase, remove dots from Gmail addresses
    // "John.Doe@Gmail.Com" becomes "johndoe@gmail.com"
    .normalizeEmail()
    
    // Validate email format using RFC 5322 standard
    // Checks for: username@domain.extension
    .isEmail()
    .withMessage('Please provide a valid email address')
    
    // Additional custom email validation (optional)
    .custom((value) => {
      // Block temporary/disposable email providers (optional)
      const disposableEmailDomains = [
        'tempmail.com',
        '10minutemail.com',
        'guerrillamail.com'
      ];
      
      const domain = value.split('@')[1];
      if (disposableEmailDomains.includes(domain)) {
        throw new Error('Disposable email addresses are not allowed');
      }
      
      return true;
    }),
  
  // PASSWORD validation
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    
    // Minimum length for security
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    
    // Check password strength using custom validator
    .custom((value) => {
      // Password must contain:
      // - At least one uppercase letter (A-Z)
      // - At least one lowercase letter (a-z)
      // - At least one number (0-9)
      // - At least one special character (!@#$%^&*)
      
      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
      
      if (!hasUpperCase) {
        throw new Error('Password must contain at least one uppercase letter');
      }
      if (!hasLowerCase) {
        throw new Error('Password must contain at least one lowercase letter');
      }
      if (!hasNumbers) {
        throw new Error('Password must contain at least one number');
      }
      if (!hasSpecialChar) {
        throw new Error('Password must contain at least one special character');
      }
      
      // Check for common weak passwords
      const commonPasswords = [
        'password123',
        '12345678',
        'qwerty123',
        'admin123'
      ];
      
      if (commonPasswords.includes(value.toLowerCase())) {
        throw new Error('This password is too common. Please choose a stronger password');
      }
      
      return true;
    }),
  
  // PHONE validation (optional field)
  body('phone')
    .optional({ checkFalsy: true }) // Only validate if provided
    
    // Remove all spaces and dashes for validation
    // "(012) 345-6789" becomes "0123456789"
    .trim()
    .replace(/[\s\-]/g, '')
    
    // South African phone number format validation
    // Valid formats: 0123456789, +27123456789, 27123456789
    .matches(/^(\+?27|0)[0-9]{9}$/)
    .withMessage('Please provide a valid South African phone number')
];

/**
 * ==========================================
 * LOGIN VALIDATION
 * ==========================================
 * Validates user login credentials
 * Less strict than registration (we just need valid format)
 */
const validateLogin = [
  // EMAIL validation
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  
  // PASSWORD validation
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    // Don't validate password complexity on login
    // The password is already set, we just need to receive it
];

/**
 * ==========================================
 * REPORT CREATION VALIDATION
 * ==========================================
 * Validates citizen issue reports
 * Critical for preventing malicious content and ensuring data quality
 */
const validateReportCreation = [
  // TITLE validation
  body('title')
    .notEmpty()
    .withMessage('Report title is required')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Title must be between 10 and 200 characters')
    
    // Prevent XSS in title
    .escape()
    
    // Custom validation: Check for spam-like patterns
    .custom((value) => {
      // Block excessive capitalization (MORE THAN 50%)
      const capsCount = (value.match(/[A-Z]/g) || []).length;
      const totalLetters = (value.match(/[a-zA-Z]/g) || []).length;
      
      if (totalLetters > 0 && (capsCount / totalLetters) > 0.5) {
        throw new Error('Please avoid excessive capitalization in title');
      }
      
      // Block repeated characters (more than 3 consecutive)
      if (/(.)\1{3,}/.test(value)) {
        throw new Error('Title contains suspicious repeated characters');
      }
      
      return true;
    }),
  
  // DESCRIPTION validation
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters')
    .escape(),
  
  // CATEGORY validation
  body('category')
    .notEmpty()
    .withMessage('Issue category is required')
    
    // Must be one of the predefined categories from Prisma enum
    .isIn([
      'POTHOLE',
      'WATER_LEAK',
      'ELECTRICITY_OUTAGE',
      'REFUSE_COLLECTION',
      'STREETLIGHT',
      'SEWAGE',
      'ILLEGAL_DUMPING',
      'GRAFFITI',
      'PARK_MAINTENANCE',
      'TRAFFIC_LIGHT',
      'OTHER'
    ])
    .withMessage('Invalid issue category'),
  
  // ADDRESS validation
  body('address')
    .notEmpty()
    .withMessage('Location address is required')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters')
    .escape(),
  
  // LATITUDE validation (optional GPS coordinates)
  body('latitude')
    .optional({ checkFalsy: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  // LONGITUDE validation (optional GPS coordinates)
  body('longitude')
    .optional({ checkFalsy: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  // MUNICIPALITY ID validation
  body('municipalityId')
    .notEmpty()
    .withMessage('Municipality selection is required')
    
    // Must be a valid UUID format
    .isUUID()
    .withMessage('Invalid municipality ID format'),
  
  // WARD ID validation (optional)
  body('wardId')
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage('Invalid ward ID format'),
  
  // IMAGE URLs validation (array of URLs)
  body('imageUrls')
    .optional()
    .isArray()
    .withMessage('Image URLs must be an array')
    
    // Custom validation for each URL in the array
    .custom((urls) => {
      // Limit number of images to prevent abuse
      if (urls.length > 5) {
        throw new Error('Maximum 5 images allowed per report');
      }
      
      // Validate each URL
      urls.forEach(url => {
        try {
          new URL(url); // Will throw if invalid URL
        } catch (error) {
          throw new Error(`Invalid image URL: ${url}`);
        }
        
        // Only allow HTTPS URLs (security)
        if (!url.startsWith('https://')) {
          throw new Error('Image URLs must use HTTPS protocol');
        }
      });
      
      return true;
    })
];

/**
 * ==========================================
 * REPORT STATUS UPDATE VALIDATION
 * ==========================================
 * Validates when municipal officials update report status
 */
const validateStatusUpdate = [
  // NEW STATUS validation
  body('status')
    .notEmpty()
    .withMessage('New status is required')
    
    // Must be valid status from Prisma enum
    .isIn(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'])
    .withMessage('Invalid status value'),
  
  // RESOLUTION NOTES validation (required for RESOLVED status)
  body('resolutionNotes')
    .if(body('status').equals('RESOLVED'))
    .notEmpty()
    .withMessage('Resolution notes are required when marking as resolved')
    .trim()
    .isLength({ min: 20, max: 1000 })
    .withMessage('Resolution notes must be between 20 and 1000 characters')
    .escape(),
  
  // ASSIGNED TO validation (required for ASSIGNED status)
  body('assignedToId')
    .if(body('status').equals('ASSIGNED'))
    .notEmpty()
    .withMessage('Official assignment is required for ASSIGNED status')
    .isUUID()
    .withMessage('Invalid user ID format')
];

/**
 * ==========================================
 * ID PARAMETER VALIDATION
 * ==========================================
 * Validates route parameters (e.g., /reports/:id)
 * Prevents path traversal and invalid ID attacks
 */
const validateIdParam = [
  param('id')
    .notEmpty()
    .withMessage('ID parameter is required')
    
    // Must be valid UUID format
    .isUUID()
    .withMessage('Invalid ID format. Must be a valid UUID')
];

/**
 * ==========================================
 * PAGINATION VALIDATION
 * ==========================================
 * Validates query parameters for pagination
 * Prevents excessive data requests
 */
const validatePagination = [
  // PAGE number validation
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page number must be a positive integer')
    .toInt(), // Convert string to integer
  
  // PAGE SIZE validation
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  // SORT BY validation (optional)
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'status', 'priority'])
    .withMessage('Invalid sort field'),
  
  // SORT ORDER validation
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be "asc" or "desc"')
];

// ==========================================
// EXPORT ALL VALIDATION FUNCTIONS
// ==========================================
module.exports = {
  // Error handler
  handleValidationErrors,
  
  // User validations
  validateRegistration,
  validateLogin,
  
  // Report validations
  validateReportCreation,
  validateStatusUpdate,
  
  // General validations
  validateIdParam,
  validatePagination
};

// ==========================================
// USAGE EXAMPLES
// ==========================================
/*

const express = require('express');
const router = express.Router();
const {
  validateRegistration,
  handleValidationErrors
} = require('../middleware/validation.middleware');

// Example 1: User registration with validation
router.post('/auth/register',
  validateRegistration,      // Apply validation rules
  handleValidationErrors,    // Check if validation passed
  registerController         // Only runs if validation passed
);

// Example 2: Report creation with validation
router.post('/reports',
  authenticate,              // User must be logged in
  validateReportCreation,    // Validate report data
  handleValidationErrors,    // Check validation
  createReportController     // Create the report
);

// Example 3: Update report with ID validation
router.put('/reports/:id',
  authenticate,
  authorize(['MUNICIPAL_ADMIN']),
  validateIdParam,           // Validate :id parameter
  validateStatusUpdate,      // Validate request body
  handleValidationErrors,
  updateReportController
);

*/