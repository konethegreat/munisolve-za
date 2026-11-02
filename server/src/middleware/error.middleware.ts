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
  } else if (
    typeof error?.status === 'number' &&
    error.status >= 400 &&
    error.status <= 499
  ) {
    // Client errors raised by express.json() (http-errors): malformed JSON,
    // oversized payloads, unsupported charsets and the like. They are the
    // caller's fault, so they must not be reported as INTERNAL_ERROR.
    appError = new AppError(
      error.status,
      error.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'BAD_REQUEST',
      'The request could not be processed.',
    );
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
