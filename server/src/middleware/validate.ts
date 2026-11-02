import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../errors/AppError';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const validated: Record<string, unknown> = {};

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const input = key === 'body' ? req.body ?? {} : req[key];
      const result = schema.safeParse(input);

      if (!result.success) {
        return next(
          new AppError(
            400,
            'VALIDATION_ERROR',
            'Validation failed. Please check your input.',
            result.error.issues.map((issue) => ({
              field: issue.path.join('.') || key,
              message: issue.message,
            })),
          ),
        );
      }

      validated[key] = result.data;
    }

    req.validated = validated;
    next();
  };
}
