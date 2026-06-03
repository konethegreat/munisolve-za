const express = require('express');
const router = express.Router();

const {
  register,
  login,
  googleLogin,
  sendVerificationOtp,
  verifyEmail,
  getCurrentUser,
  logout,
} = require('../controllers/auth.controller');

const { authenticate } = require('../middleware/auth.middleware');
const {
  validateRegistration,
  validateLogin,
  handleValidationErrors,
} = require('../middleware/validation.middleware');
const { authLimiter, passwordResetLimiter, emailVerifLimiter } = require('../middleware/rateLimit.middleware');

// ── Public ─────────────────────────────────────────────────────────────────
router.post('/register',           authLimiter,       validateRegistration, handleValidationErrors, register);
router.post('/login',              authLimiter,       validateLogin,        handleValidationErrors, login);
router.post('/google',             authLimiter,       googleLogin);
router.post('/send-verification',  emailVerifLimiter, sendVerificationOtp);
router.post('/verify-email',       emailVerifLimiter, verifyEmail);

// ── Protected ──────────────────────────────────────────────────────────────
router.get('/me',      authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);

// ── Placeholders ───────────────────────────────────────────────────────────
router.post('/forgot-password', passwordResetLimiter, (req, res) => {
  res.status(501).json({ success: false, message: 'Password reset coming soon', errorCode: 'NOT_IMPLEMENTED' });
});
router.post('/reset-password', (req, res) => {
  res.status(501).json({ success: false, message: 'Password reset coming soon', errorCode: 'NOT_IMPLEMENTED' });
});

module.exports = router;
