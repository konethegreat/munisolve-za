export type NotificationKind =
  | 'SLA_RESPONSE_WARNING'
  | 'SLA_RESPONSE_BREACH'
  | 'SLA_RESOLUTION_WARNING'
  | 'SLA_RESOLUTION_BREACH';

export interface SlaPolicyValues {
  responseMinutes: number;
  resolutionMinutes: number;
}

export const DEFAULT_SLA_POLICY: SlaPolicyValues = {
  responseMinutes: 72 * 60,
  resolutionMinutes: 14 * 24 * 60,
};

export const SLA_WARNING_RATIO = 0.8;

export const OPEN_REPORT_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] as const;
const OPEN_STATUS_SET = new Set<string>(OPEN_REPORT_STATUSES);

export interface SlaPerson {
  email: string;
  firstName: string;
}

export interface SlaReport {
  id: number;
  title: string;
  category: string;
  municipality: string;
  status: string;
  createdAt: Date;
  assignedAt: Date | null;
  responseDueAt: Date | null;
  resolutionDueAt: Date | null;
  slaCycleStartedAt: Date | null;
  reopenCount: number;
  user: SlaPerson;
}

export interface NotificationDraft {
  dedupeKey: string;
  kind: NotificationKind;
  reportId: number;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface PlanOptions {
  now: Date;
  reports: SlaReport[];
  admins: SlaPerson[];
  clientUrl: string;
  warningRatio?: number;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function dueWarningAt(start: Date, due: Date, ratio = SLA_WARNING_RATIO): Date {
  return new Date(start.getTime() + ratio * (due.getTime() - start.getTime()));
}

type Target = 'response' | 'resolution';

function formatDue(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function reportLink(clientUrl: string, reportId: number): string {
  return `${clientUrl.replace(/\/$/, '')}/reports/${reportId}`;
}

function reportLabel(report: SlaReport): string {
  return `#${report.id} "${report.title}" (${report.category}) in ${report.municipality}`;
}

function ownerWarning(report: SlaReport, target: Target, dueAt: Date, clientUrl: string): { subject: string; body: string } {
  const next = target === 'response'
    ? 'A municipal crew has not been assigned yet.'
    : 'The municipality is still working on it.';
  return {
    subject: `Report #${report.id} is nearing its ${target} target`,
    body: [
      `Hi ${report.user.firstName || 'there'},`,
      `Your report ${reportLabel(report)} is approaching its ${target} target of ${formatDue(dueAt)}.`,
      next,
      `View the report: ${reportLink(clientUrl, report.id)}`,
    ].join('\n\n'),
  };
}

function ownerBreach(report: SlaReport, target: Target, dueAt: Date, clientUrl: string): { subject: string; body: string } {
  return {
    subject: `Report #${report.id} is past its ${target} target`,
    body: [
      `Hi ${report.user.firstName || 'there'},`,
      `Your report ${reportLabel(report)} has passed its ${target} target, which was due ${formatDue(dueAt)}.`,
      'The municipality has been notified.',
      `View the report: ${reportLink(clientUrl, report.id)}`,
    ].join('\n\n'),
  };
}

function adminBreach(report: SlaReport, target: Target, dueAt: Date, clientUrl: string): { subject: string; body: string } {
  return {
    subject: `SLA breach: report #${report.id} (${report.category})`,
    body: [
      `Report ${reportLabel(report)} has passed its ${target} target, due ${formatDue(dueAt)}.`,
      `Report owner: ${report.user.email}`,
      `Open the report: ${reportLink(clientUrl, report.id)}`,
    ].join('\n\n'),
  };
}

export function planSlaNotifications({
  now,
  reports,
  admins,
  clientUrl,
  warningRatio = SLA_WARNING_RATIO,
}: PlanOptions): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  const seen = new Set<string>();

  const push = (
    report: SlaReport,
    kind: NotificationKind,
    target: Target,
    recipient: SlaPerson,
    dueAt: Date,
    content: { subject: string; body: string },
  ) => {
    const email = recipient.email.trim().toLowerCase();
    if (!email) return;
    const dedupeKey = `sla:${kind}:r${report.id}:c${report.reopenCount}:${email}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    drafts.push({
      dedupeKey,
      kind,
      reportId: report.id,
      recipientEmail: email,
      subject: content.subject,
      body: content.body,
    });
  };

  const adminRecipients = Array.from(
    new Map(admins.map((admin) => [admin.email.trim().toLowerCase(), admin])).values(),
  );

  for (const report of reports) {
    if (!OPEN_STATUS_SET.has(report.status)) continue;

    if (report.status === 'PENDING' && !report.assignedAt && report.responseDueAt) {
      const warningAt = dueWarningAt(report.createdAt, report.responseDueAt, warningRatio);
      if (now >= report.responseDueAt) {
        push(report, 'SLA_RESPONSE_BREACH', 'response', report.user, report.responseDueAt, ownerBreach(report, 'response', report.responseDueAt, clientUrl));
        for (const admin of adminRecipients) {
          push(report, 'SLA_RESPONSE_BREACH', 'response', admin, report.responseDueAt, adminBreach(report, 'response', report.responseDueAt, clientUrl));
        }
      } else if (now >= warningAt) {
        push(report, 'SLA_RESPONSE_WARNING', 'response', report.user, report.responseDueAt, ownerWarning(report, 'response', report.responseDueAt, clientUrl));
      }
    }

    if (report.resolutionDueAt) {
      const start = report.slaCycleStartedAt ?? report.createdAt;
      const warningAt = dueWarningAt(start, report.resolutionDueAt, warningRatio);
      if (now >= report.resolutionDueAt) {
        push(report, 'SLA_RESOLUTION_BREACH', 'resolution', report.user, report.resolutionDueAt, ownerBreach(report, 'resolution', report.resolutionDueAt, clientUrl));
        for (const admin of adminRecipients) {
          push(report, 'SLA_RESOLUTION_BREACH', 'resolution', admin, report.resolutionDueAt, adminBreach(report, 'resolution', report.resolutionDueAt, clientUrl));
        }
      } else if (now >= warningAt) {
        push(report, 'SLA_RESOLUTION_WARNING', 'resolution', report.user, report.resolutionDueAt, ownerWarning(report, 'resolution', report.resolutionDueAt, clientUrl));
      }
    }
  }

  return drafts;
}
