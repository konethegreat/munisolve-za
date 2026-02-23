// ==========================================
// RATE LIMITING MIDDLEWARE
// ==========================================
// Limits auth attempts per IP to prevent brute-force
// Author: MuniSolve ZA Security Team

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit'); // helper to generate keys based on IP

// Auth routes: 5 attempts per 15 minutes (register/login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // only counts failed requests
  message: { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset: 3 attempts per hour
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req), 
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

module.exports = {
  authLimiter,
  passwordResetLimiter,
  generalLimiter,
};
