import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { AppError } from '../errors/AppError';

const keyByUserOrIp = (req: Request) =>
  req.user?.id != null ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? 'unknown');

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.')),
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: keyByUserOrIp,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many password reset requests.')),
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests from this IP.')),
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: keyByUserOrIp,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'You have reached your AI chat limit. Please try again in an hour.')),
  standardHeaders: true,
  legacyHeaders: false,
});

export const emailVerifLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many verification requests. Please wait an hour and try again.')),
  standardHeaders: true,
  legacyHeaders: false,
});
