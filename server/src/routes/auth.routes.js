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
const { validate } = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  sendVerificationSchema,
  verifyEmailSchema,
} = require('../schemas/auth');
const { authLimiter, passwordResetLimiter, emailVerifLimiter } = require('../middleware/rateLimit.middleware');

// ── Public ─────────────────────────────────────────────────────────────────
router.post('/register',          authLimiter,       validate({ body: registerSchema }), register);
router.post('/login',             authLimiter,       validate({ body: loginSchema }), login);
router.post('/google',            authLimiter,       validate({ body: googleLoginSchema }), googleLogin);
router.post('/send-verification', emailVerifLimiter, validate({ body: sendVerificationSchema }), sendVerificationOtp);
router.post('/verify-email',      emailVerifLimiter, validate({ body: verifyEmailSchema }), verifyEmail);

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
