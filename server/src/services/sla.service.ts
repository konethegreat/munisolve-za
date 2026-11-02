import prisma from '../config/db.config';
import { DEFAULT_SLA_POLICY, addMinutes, planSlaNotifications, OPEN_REPORT_STATUSES } from '../domain/sla';
import type { NotificationDraft, SlaPolicyValues } from '../domain/sla';

export interface SlaWindows {
  responseDueAt: Date;
  resolutionDueAt: Date;
  slaCycleStartedAt: Date;
}

export async function loadSlaPolicy(category: string, client: any = prisma): Promise<SlaPolicyValues> {
  const policy = await client.slaPolicy.findUnique({ where: { category } });
  if (!policy || policy.isActive === false) return DEFAULT_SLA_POLICY;
  return {
    responseMinutes: policy.responseMinutes,
    resolutionMinutes: policy.resolutionMinutes,
  };
}

export function windowsFromPolicy(policy: SlaPolicyValues, now: Date): SlaWindows {
  return {
    responseDueAt: addMinutes(now, policy.responseMinutes),
    resolutionDueAt: addMinutes(now, policy.resolutionMinutes),
    slaCycleStartedAt: now,
  };
}

export async function slaWindowsForNewReport(
  category: string,
  now: Date = new Date(),
  client: any = prisma,
): Promise<SlaWindows> {
  return windowsFromPolicy(await loadSlaPolicy(category, client), now);
}

export async function resetResolutionWindow(
  category: string,
  now: Date,
  client: any = prisma,
): Promise<{ resolutionDueAt: Date; slaCycleStartedAt: Date }> {
  const policy = await loadSlaPolicy(category, client);
  return {
    resolutionDueAt: addMinutes(now, policy.resolutionMinutes),
    slaCycleStartedAt: now,
  };
}

export async function planDueNotifications(options: {
  now: Date;
  client?: any;
  clientUrl?: string;
}): Promise<NotificationDraft[]> {
  const client = options.client ?? prisma;
  const [reports, admins] = await Promise.all([
    client.report.findMany({
      where: { status: { in: [...OPEN_REPORT_STATUSES] } },
      include: { user: { select: { email: true, firstName: true } } },
      orderBy: { resolutionDueAt: 'asc' },
      take: 500,
    }),
    client.user.findMany({
      where: { role: { in: ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { email: true, firstName: true },
    }),
  ]);

  return planSlaNotifications({
    now: options.now,
    reports,
    admins,
    clientUrl: options.clientUrl ?? process.env.CLIENT_URL ?? '',
  });
}
