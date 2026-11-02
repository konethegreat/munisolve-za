import prisma from '../config/db.config';
import { planSlaNotifications } from '../domain/sla';
import type { NotificationDraft } from '../domain/sla';

export async function planDueNotifications(options: {
  now: Date;
  client?: any;
  clientUrl?: string;
}): Promise<NotificationDraft[]> {
  const client = options.client ?? prisma;
  const [reports, admins] = await Promise.all([
    client.report.findMany({
      where: { status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } },
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
