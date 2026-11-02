import type { RequestHandler } from 'express';
import { authenticate } from './auth.middleware';
import { AppError } from '../errors/AppError';

const SUPERVISOR_ROLES = ['WORKER_SUPERVISOR', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN'];

export const requireSupervisor: RequestHandler = (req, res, next) => {
  return authenticate(req, res, () => {
    const role = req.user?.role;
    if (!role || !SUPERVISOR_ROLES.includes(role)) {
      throw new AppError(403, 'SUPERVISOR_ONLY', 'Access denied. Supervisor privileges required.');
    }
    return next();
  });
};
