import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.config';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  isVerified: true,
} as const;

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new AppError(401, 'NO_TOKEN', 'Access denied. No authentication token provided.');
  if (!authHeader.startsWith('Bearer ')) throw new AppError(401, 'INVALID_TOKEN_FORMAT', 'Invalid token format. Use: Bearer <token>');

  const token = authHeader.split(' ')[1];
  if (!token) throw new AppError(401, 'EMPTY_TOKEN', 'Authentication token is empty.');

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;
  } catch (jwtError) {
    const name = (jwtError as Error).name;
    if (name === 'TokenExpiredError') throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
    if (name === 'JsonWebTokenError') throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
    throw new AppError(401, 'TOKEN_VERIFICATION_FAILED', 'Token verification failed.');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId as number },
    select: { ...USER_SELECT, createdAt: true, lastLogin: true },
  });

  if (!user) throw new AppError(401, 'USER_NOT_FOUND', 'User account not found. Please log in again.');
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'Your account has been deactivated. Contact support.');

  req.user = user;
  req.token = token;
  logger.info({ userId: user.id, role: user.role, requestId: req.id }, 'User authenticated');
  next();
};

export const optionalAuthenticate: RequestHandler = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId as number },
      select: USER_SELECT,
    });
    req.user = user && user.isActive ? user : null;
  } catch {
    req.user = null;
    logger.info('Optional authentication token invalid, continuing as guest');
  }

  next();
};
