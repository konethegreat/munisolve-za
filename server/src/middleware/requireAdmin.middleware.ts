import type { RequestHandler } from 'express';
import { authenticate } from './auth.middleware';
import { AppError } from '../errors/AppError';

export const requireAdmin: RequestHandler = (req, res, next) => {
  return authenticate(req, res, () => {
    const role = req.user?.role;
    const isAdmin = role === 'MUNICIPAL_ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin) throw new AppError(403, 'ADMIN_ONLY', 'Access denied. Admin privileges required.');
    return next();
  });
};
