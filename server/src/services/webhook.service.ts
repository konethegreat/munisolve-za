import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import prisma from '../config/db.config';
import { logger } from '../logger';
import {
  isBlockedAddress,
  parseWebhookUrl,
  signWebhook,
  subscriptionWantsEvent,
} from '../domain/webhook';
import type { WebhookEvent } from '../domain/webhook';

export const WEBHOOK_BATCH_SIZE = 25;
export const WEBHOOK_MAX_ATTEMPTS = 5;

export interface WebhookReportPayload {
  id: number;
  title: string;
  category: string;
  status: string;
  municipality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  assignedTeamId?: number | null;
  closureReason?: string | null;
  updatedAt?: Date | string | null;
}

export interface WebhookDeliverySummary {
  sent: number;
  failed: number;
}

type FetchLike = typeof fetch;
type ResolveHost = (hostname: string) => Promise<{ address: string; family: number }[]>;

class WebhookTargetError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'WebhookTargetError';
    this.code = code;
  }
}

class WebhookHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'WebhookHttpError';
    this.status = status;
  }
}

function reportSummary(report: WebhookReportPayload) {
  return {
    id: report.id,
    title: report.title,
    category: report.category,
    status: report.status,
    municipality: report.municipality ?? null,
    latitude: report.latitude ?? null,
    longitude: report.longitude ?? null,
    assignedTeamId: report.assignedTeamId ?? null,
    closureReason: report.closureReason ?? null,
    updatedAt: report.updatedAt ?? null,
  };
}

export function buildWebhookPayload(
  event: WebhookEvent,
  report: WebhookReportPayload,
  extra: Record<string, unknown> = {},
  now: Date = new Date(),
): string {
  return JSON.stringify({
    event,
    occurredAt: now.toISOString(),
    report: reportSummary(report),
    ...extra,
  });
}

// Business events enqueue deliveries; the tick delivers them. Deliveries that fail before the
// tick marks them SENT are retried, so the dedupe key only needs to be unique per event.
export async function enqueueReportEvent(options: {
  event: WebhookEvent;
  report: WebhookReportPayload;
  extra?: Record<string, unknown>;
  now?: Date;
  client?: any;
}): Promise<number> {
  const client = options.client ?? prisma;
  const subscriptions = await client.webhookSubscription.findMany({ where: { isActive: true } });
  const wanted = subscriptions.filter((subscription: any) => subscriptionWantsEvent(subscription.events, options.event));
  if (wanted.length === 0) return 0;

  const payload = buildWebhookPayload(options.event, options.report, options.extra, options.now ?? new Date());
  await client.webhookDelivery.createMany({
    data: wanted.map((subscription: any) => ({
      subscriptionId: subscription.id,
      dedupeKey: `wh_${crypto.randomUUID()}`,
      event: options.event,
      payload,
    })),
    skipDuplicates: true,
  });
  return wanted.length;
}

// Re-resolves the hostname on every attempt so a subscription cannot keep pointing at a
// private address after it was created.
async function assertDeliverable(urlString: string, resolveHost: ResolveHost): Promise<void> {
  const parsed = parseWebhookUrl(urlString);
  if ('reason' in parsed) throw new WebhookTargetError(parsed.reason, `Webhook URL rejected: ${parsed.reason}`);

  const hostname = new URL(parsed.url).hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return;

  let records: { address: string; family: number }[];
  try {
    records = await resolveHost(hostname);
  } catch {
    throw new WebhookTargetError('DNS_LOOKUP_FAILED', 'Could not resolve the webhook host');
  }
  if (!records || records.length === 0) throw new WebhookTargetError('DNS_LOOKUP_FAILED', 'Could not resolve the webhook host');
  if (records.some((record) => isBlockedAddress(record.address))) {
    throw new WebhookTargetError('PRIVATE_ADDRESS', 'The webhook host resolves to a private address');
  }
}

async function sendDelivery(options: {
  delivery: any;
  subscription: any;
  now: Date;
  fetchImpl: FetchLike;
  resolveHost: ResolveHost;
}): Promise<number> {
  const { delivery, subscription, now, fetchImpl, resolveHost } = options;
  await assertDeliverable(subscription.url, resolveHost);

  const timestamp = String(Math.floor(now.getTime() / 1000));
  const signature = signWebhook(subscription.secret, timestamp, delivery.payload);

  let response: Response;
  try {
    response = await fetchImpl(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MuniSolve-Webhooks/1.0 (+https://github.com/konethegreat/munisolve-za)',
        'X-MuniSolve-Event': delivery.event,
        'X-MuniSolve-Delivery': String(delivery.id),
        'X-MuniSolve-Timestamp': timestamp,
        'X-MuniSolve-Signature': `sha256=${signature}`,
      },
      body: delivery.payload,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof WebhookTargetError) throw error;
    const failure: any = new Error(`Webhook request failed: ${(error as Error).message}`);
    failure.retryable = true;
    throw failure;
  }

  if (!response.ok) throw new WebhookHttpError(response.status);
  return response.status;
}

function retryDelayMinutes(attempts: number): number {
  return Math.min(5 * 3 ** Math.max(attempts - 1, 0), 180);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryable(error: unknown): boolean {
  if (error instanceof WebhookTargetError) return false;
  if (error instanceof WebhookHttpError) return error.status === 429 || error.status >= 500;
  return (error as { retryable?: boolean })?.retryable === true;
}

function isDue(row: any, now: Date): boolean {
  return !row.nextAttemptAt || new Date(row.nextAttemptAt).getTime() <= now.getTime();
}

export async function processWebhookDeliveries(options: {
  now: Date;
  client?: any;
  fetchImpl?: FetchLike;
  resolveHost?: ResolveHost;
  limit?: number;
}): Promise<WebhookDeliverySummary> {
  const client = options.client ?? prisma;
  const now = options.now;
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? ((hostname: string) => dns.lookup(hostname, { all: true, verbatim: true }));
  const limit = options.limit ?? WEBHOOK_BATCH_SIZE;

  const candidates = await client.webhookDelivery.findMany({
    where: { status: 'PENDING' },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit * 2,
  });
  const due = candidates.filter((row: any) => isDue(row, now)).slice(0, limit);
  const summary: WebhookDeliverySummary = { sent: 0, failed: 0 };

  for (const delivery of due) {
    const subscription = await client.webhookSubscription.findUnique({ where: { id: delivery.subscriptionId } });
    if (!subscription) {
      await client.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'FAILED', lastError: 'SUBSCRIPTION_MISSING' },
      });
      summary.failed += 1;
      continue;
    }
    if (!subscription.isActive) {
      await client.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'FAILED', lastError: 'SUBSCRIPTION_INACTIVE' },
      });
      summary.failed += 1;
      continue;
    }

    try {
      const responseStatus = await sendDelivery({ delivery, subscription, now, fetchImpl, resolveHost });
      await client.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENT', attempts: delivery.attempts + 1, deliveredAt: now, lastError: null, responseStatus },
      });
      summary.sent += 1;
    } catch (error) {
      const attempts = delivery.attempts + 1;
      const exhausted = attempts >= delivery.maxAttempts || !isRetryable(error);
      const status = error instanceof WebhookHttpError ? error.status : null;
      await client.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts,
          lastError: errorMessage(error),
          ...(status !== null && { responseStatus: status }),
          ...(exhausted
            ? {}
            : { nextAttemptAt: new Date(now.getTime() + retryDelayMinutes(attempts) * 60 * 1000) }),
        },
      });
      summary.failed += 1;
      logger.warn({ deliveryId: delivery.id, attempts, exhausted, err: error }, 'Webhook delivery failed');
    }
  }

  return summary;
}
