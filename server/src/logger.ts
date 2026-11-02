import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: {
    release: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'dev',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'otp',
      '*.password',
      '*.token',
      '*.otp',
    ],
    censor: '[redacted]',
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: any) => req.id,
  autoLogging: {
    ignore: (req: any) => req.url === '/health' || req.url === '/',
  },
  customLogLevel: (_req: any, res: any, error: any) =>
    error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  customSuccessMessage: (req: any, res: any) => `${req.method} ${req.url} ${res.statusCode}`,
});
