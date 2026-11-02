// ==========================================
// RATE LIMITING MIDDLEWARE
// ==========================================
// Limits auth attempts per IP to prevent brute-force
// Author: MuniSolve ZA Security Team

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { AppError } = require('../errors/AppError');

// Auth routes: 5 attempts per 15 minutes (register/login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.')),
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset: 3 attempts per hour
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.id != null ? `user:${req.user.id}` : ipKeyGenerator(req.ip),
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many password reset requests.')),
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter (if needed elsewhere)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests from this IP.')),
  standardHeaders: true,
  legacyHeaders: false,
});

// AI chat limiter: 30 messages per hour, keyed by authenticated user ID.
// AI calls are expensive — do not use generalLimiter on these routes.
const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id != null ? `user:${req.user.id}` : ipKeyGenerator(req.ip),
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'You have reached your AI chat limit. Please try again in an hour.')),
  standardHeaders: true,
  legacyHeaders: false,
});

// Email verification OTP: 5 sends per hour per IP to prevent abuse
const emailVerifLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many verification requests. Please wait an hour and try again.')),
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
