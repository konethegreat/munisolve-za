// ==========================================
// RATE LIMITING MIDDLEWARE
// ==========================================
// Limits auth attempts per IP to prevent brute-force
// Author: MuniSolve ZA Security Team

const rateLimit = require('express-rate-limit');

// Auth routes: 5 attempts per 15 minutes (register/login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset: 3 attempts per hour
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  message: { success: false, message: 'Too many password reset requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter (if needed elsewhere)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests from this IP.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI chat limiter: 30 messages per hour, keyed by authenticated user ID.
// AI calls are expensive — do not use generalLimiter on these routes.
const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  message: { success: false, message: 'You have reached your AI chat limit. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email verification OTP: 5 sends per hour per IP to prevent abuse
const emailVerifLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many verification requests. Please wait an hour and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  passwordResetLimiter,
  generalLimiter,
  aiChatLimiter,
  emailVerifLimiter,
};
