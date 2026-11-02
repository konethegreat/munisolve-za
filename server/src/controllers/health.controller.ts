import type { RequestHandler } from 'express';
import { getReadiness } from '../services/health.service';

export const liveness: RequestHandler = (_req, res) => {
  res.status(200).json({
    status: 'Success',
    message: 'MuniSolve ZA API is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.APP_VERSION || '1.0.0',
  });
};

export const readiness: RequestHandler = async (_req, res) => {
  const result = await getReadiness();
  res.status(result.ready ? 200 : 503).json({
    status: result.ready ? 'ready' : 'not_ready',
    checks: result.checks,
    timestamp: new Date().toISOString(),
  });
};
