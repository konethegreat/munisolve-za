import prisma from '../config/db.config';
import { logger } from '../logger';
import { addMinutes } from '../domain/sla';
import type { NotificationDraft } from '../domain/sla';
import { planDueNotifications } from './sla.service';
import { isEmailConfigured, sendNotificationEmail } from './email.service';

export const OUTBOX_BATCH_SIZE = 25;
export const LEASE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

export interface SendEmail {
  (message: { to: string; subject: string; text: string }): Promise<void>;
}

export interface TickOptions {
  now?: Date;
  limit?: number;
  client?: any;
  send?: SendEmail;
  configured?: boolean;
  clientUrl?: string;
}

export interface TickSummary {
  enqueued: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

interface ProcessSummary {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

interface ProcessOptions {
  now: Date;
  limit?: number;
  client?: any;
  send?: SendEmail;
  configured?: boolean;
}

export function retryDelayMinutes(attempts: number): number {
  return Math.min(5 * 2 ** Math.max(attempts - 1, 0), 6 * 60);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

export async function enqueueNotifications(
  drafts: NotificationDraft[],
  now: Date,
  client: any = prisma,
): Promise<number> {
  if (drafts.length === 0) return 0;
  const result = await client.notificationOutbox.createMany({
    data: drafts.map((draft) => ({
      ...draft,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: now,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function processOutbox({
  now,
  limit = OUTBOX_BATCH_SIZE,
  client = prisma,
  send = sendNotificationEmail,
  configured = isEmailConfigured(),
}: ProcessOptions): Promise<ProcessSummary> {
  const rows = await client.notificationOutbox.findMany({
    where: {
      OR: [{ status: 'PENDING' }, { status: 'SENDING' }],
      nextAttemptAt: { lte: now },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
  });

  const summary: ProcessSummary = { claimed: 0, sent: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    const claim = await client.notificationOutbox.updateMany({
      where: { id: row.id, status: row.status, nextAttemptAt: { lte: now } },
      data: { status: 'SENDING', nextAttemptAt: addMinutes(now, LEASE_MINUTES) },
    });
    if (claim.count !== 1) continue;
    summary.claimed += 1;

    if (!configured) {
      await client.notificationOutbox.update({
        where: { id: row.id },
        data: { status: 'SKIPPED', lastError: 'Email delivery is not configured.' },
      });
      summary.skipped += 1;
      continue;
    }

    try {
      await send({ to: row.recipientEmail, subject: row.subject, text: row.body });
      await client.notificationOutbox.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: now, lastError: null },
      });
      summary.sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= row.maxAttempts;
      await client.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts,
          lastError: errorMessage(error),
          nextAttemptAt: addMinutes(now, retryDelayMinutes(attempts)),
        },
      });
      summary.failed += 1;
      logger.warn({ notificationId: row.id, attempts, exhausted }, 'Notification delivery failed');
    }
  }

  return summary;
}

export async function runTick(options: TickOptions = {}): Promise<TickSummary> {
  const now = options.now ?? new Date();
  const client = options.client ?? prisma;

  const drafts = await planDueNotifications({ now, client, clientUrl: options.clientUrl });
  const enqueued = await enqueueNotifications(drafts, now, client);
  const processed = await processOutbox({
    now,
    client,
    limit: options.limit,
    send: options.send,
    configured: options.configured,
  });

  return { enqueued, ...processed };
}
