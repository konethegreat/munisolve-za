import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import { runTick } from '../services/notification.service';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const tick: RequestHandler = async (req, res) => {
  const expected = process.env.TICK_SECRET;
  if (!expected) {
    throw new AppError(503, 'TICK_NOT_CONFIGURED', 'Scheduled jobs are not configured.');
  }

  const provided = req.get('x-tick-secret') ?? '';
  if (!safeEqual(provided, expected)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid tick secret.');
  }

  const data = await runTick({ now: new Date() });
  res.status(200).json({ success: true, message: 'Tick complete', data });
};
