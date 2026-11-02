import express from 'express';
import {
  register,
  login,
  googleLogin,
  sendVerificationOtp,
  verifyEmail,
  getCurrentUser,
  logout,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { AppError } from '../errors/AppError';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  sendVerificationSchema,
  verifyEmailSchema,
} from '../schemas/auth';
import { authLimiter, passwordResetLimiter, emailVerifLimiter } from '../middleware/rateLimit.middleware';

const router = express.Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), register);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/google', authLimiter, validate({ body: googleLoginSchema }), googleLogin);
router.post('/send-verification', emailVerifLimiter, validate({ body: sendVerificationSchema }), sendVerificationOtp);
router.post('/verify-email', emailVerifLimiter, validate({ body: verifyEmailSchema }), verifyEmail);

router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);

router.post('/forgot-password', passwordResetLimiter, () => {
  throw new AppError(501, 'NOT_IMPLEMENTED', 'Password reset coming soon');
});
router.post('/reset-password', () => {
  throw new AppError(501, 'NOT_IMPLEMENTED', 'Password reset coming soon');
});

export = router;
