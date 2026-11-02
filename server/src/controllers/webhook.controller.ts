import crypto from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import prisma from '../config/db.config';
import { AppError } from '../errors/AppError';
import { serializeEvents } from '../domain/webhook';

function publicWebhook(row: any) {
  return {
    id: row.id,
    url: row.url,
    description: row.description,
    events: String(row.events ?? '').split(',').filter(Boolean),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row._count ? { deliveryCount: row._count.deliveries } : {}),
  };
}

function newSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

async function audit(req: Request, action: string, id: number, description: string) {
  await prisma.activityLog.create({
    data: {
      userId: req.user!.id,
      action,
      entity: 'WebhookSubscription',
      entityId: id,
      description,
      requestId: String(req.id),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });
}

export const listWebhooks: RequestHandler = async (_req, res) => {
  const rows = await prisma.webhookSubscription.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { deliveries: true } } },
  });
  const data = rows.map(publicWebhook);
  res.status(200).json({ success: true, data, count: data.length });
};

export const createWebhook: RequestHandler = async (req, res) => {
  const { url, events, description } = req.validated.body;
  const secret = newSecret();
  const row = await prisma.webhookSubscription.create({
    data: { url, events: serializeEvents(events), description: description ?? null, secret },
  });
  await audit(req, 'WEBHOOK_CREATED', row.id, `Webhook subscription #${row.id} created`);

  res.status(201).json({
    success: true,
    message: 'Webhook created. Store the signing secret now; it is not shown again.',
    data: { ...publicWebhook(row), secret },
  });
};

export const updateWebhook: RequestHandler = async (req, res) => {
  const id = req.validated.params.id;
  const existing = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'WEBHOOK_NOT_FOUND', 'Webhook subscription not found.');

  const body = req.validated.body;
  const data: Record<string, unknown> = {};
  if (body.url !== undefined) data.url = body.url;
  if (body.events !== undefined) data.events = serializeEvents(body.events);
  if (body.description !== undefined) data.description = body.description;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const row = await prisma.webhookSubscription.update({ where: { id }, data });
  await audit(req, 'WEBHOOK_UPDATED', id, `Webhook subscription #${id} updated`);

  res.status(200).json({ success: true, message: 'Webhook updated', data: publicWebhook(row) });
};

export const rotateWebhookSecret: RequestHandler = async (req, res) => {
  const id = req.validated.params.id;
  const existing = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'WEBHOOK_NOT_FOUND', 'Webhook subscription not found.');

  const secret = newSecret();
  await prisma.webhookSubscription.update({ where: { id }, data: { secret } });
  await audit(req, 'WEBHOOK_SECRET_ROTATED', id, `Webhook subscription #${id} secret rotated`);

  res.status(200).json({
    success: true,
    message: 'Signing secret rotated. Store it now; it is not shown again.',
    data: { id, secret },
  });
};

export const deleteWebhook: RequestHandler = async (req, res) => {
  const id = req.validated.params.id;
  const existing = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'WEBHOOK_NOT_FOUND', 'Webhook subscription not found.');

  await prisma.webhookSubscription.delete({ where: { id } });
  await audit(req, 'WEBHOOK_DELETED', id, `Webhook subscription #${id} deleted`);

  res.status(200).json({ success: true, message: 'Webhook deleted' });
};

export const listWebhookDeliveries: RequestHandler = async (req, res) => {
  const id = req.validated.params.id;
  const existing = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'WEBHOOK_NOT_FOUND', 'Webhook subscription not found.');

  const data = await prisma.webhookDelivery.findMany({
    where: { subscriptionId: id },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      event: true,
      status: true,
      attempts: true,
      responseStatus: true,
      lastError: true,
      deliveredAt: true,
      createdAt: true,
    },
  });

  res.status(200).json({ success: true, data, count: data.length });
};
