import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.get('X-Request-Id');
  req.id = inbound && VALID_REQUEST_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
