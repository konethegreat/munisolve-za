// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
const express = require('express');
const router = express.Router();

// Import controllers
const {
  register,
  login,
  getCurrentUser,
  logout,
  googleLogin
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
// PUBLIC ROUTES
// ==========================================
router.post('/register', authLimiter, validateRegistration, handleValidationErrors, register);
router.post('/login',    authLimiter, validateLogin,        handleValidationErrors, login);

// ==========================================
// PROTECTED ROUTES
// ==========================================
router.get('/me',       authenticate, getCurrentUser);
router.post('/logout',  authenticate, logout);
//router.post('/google', googleLogin);

// ==========================================
// FUTURE ROUTES (Placeholders)
// ==========================================
router.post('/forgot-password', passwordResetLimiter, (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Password reset feature coming soon',
    errorCode: 'NOT_IMPLEMENTED'
  });
});

router.post('/reset-password', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Password reset feature coming soon',
    errorCode: 'NOT_IMPLEMENTED'
  });
});

router.post('/verify-email', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Email verification feature coming soon',
    errorCode: 'NOT_IMPLEMENTED'
  });
});




module.exports = router;