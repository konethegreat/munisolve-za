import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`));
};
