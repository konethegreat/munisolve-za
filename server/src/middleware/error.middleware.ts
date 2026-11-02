import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { mapPrismaError } from '../errors/prismaErrors';
import { logger } from '../logger';

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  let appError: AppError | undefined;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new AppError(
      400,
      'VALIDATION_ERROR',
      'Validation failed. Please check your input.',
      error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
    );
  } else if (error?.message === 'Not allowed by CORS') {
    appError = new AppError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed to access the API.');
  } else {
    appError = mapPrismaError(error) ?? undefined;
  }

  if (!appError) {
    logger.error({ err: error, requestId: req.id }, 'Unhandled request error');
    appError = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  } else if (appError.statusCode >= 500) {
    logger.error({ err: error, requestId: req.id, errorCode: appError.errorCode }, appError.message);
  } else {
    logger.warn({ requestId: req.id, errorCode: appError.errorCode, path: req.originalUrl }, appError.message);
  }

  res.status(appError.statusCode).json({
    success: false,
    errorCode: appError.errorCode,
    message: appError.message,
    requestId: req.id,
    ...(appError.details && { errors: appError.details, errorCount: appError.details.length }),
  });
};
