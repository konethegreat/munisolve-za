export type ReportStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'CLOSED';
export type Role = 'CITIZEN' | 'WORKER_SUPERVISOR' | 'MUNICIPAL_ADMIN' | 'SUPER_ADMIN';

export const ALLOWED_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  PENDING: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  ASSIGNED: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
  REJECTED: ['PENDING'],
};

export interface TransitionInput {
  role: Role;
  actorId: number;
  report: {
    id: number;
    userId: number;
    status: ReportStatus;
    afterPhotoUrl?: string | null;
  };
  nextStatus: ReportStatus;
  afterPhotoUrl?: string;
  reason?: string;
}

export type TransitionDecision =
  | { allowed: true; forced: boolean }
  | { allowed: false; statusCode: number; errorCode: string; message: string };

const allow = (forced: boolean): TransitionDecision => ({ allowed: true, forced });

const deny = (statusCode: number, errorCode: string, message: string): TransitionDecision => ({
  allowed: false,
  statusCode,
  errorCode,
  message,
});

const invalidTransition = (from: ReportStatus, to: ReportStatus): TransitionDecision =>
  deny(409, 'INVALID_TRANSITION', `Cannot change status from ${from} to ${to}.`);

export function canTransition(input: TransitionInput): TransitionDecision {
  const { role, actorId, report, nextStatus } = input;

  if (role === 'CITIZEN') {
    if (report.userId !== actorId) {
      return deny(404, 'REPORT_NOT_FOUND', 'Report not found.');
    }
    if (nextStatus !== 'RESOLVED') {
      return deny(403, 'INSUFFICIENT_PERMISSIONS', 'Citizens can only mark their own reports as resolved.');
    }
    if (!['PENDING', 'IN_PROGRESS'].includes(report.status)) {
      return invalidTransition(report.status, nextStatus);
    }
    return allow(false);
  }

  const canonical = ALLOWED_TRANSITIONS[report.status].includes(nextStatus);

  if (role === 'SUPER_ADMIN' && !canonical) {
    const reason = (input.reason ?? '').trim();
    if (reason.length >= 10) return allow(true);
    return deny(400, 'OVERRIDE_REASON_REQUIRED', 'A force override requires a reason of at least 10 characters.');
  }

  if (!canonical) return invalidTransition(report.status, nextStatus);

  if (role === 'WORKER_SUPERVISOR' && nextStatus === 'RESOLVED' && !input.afterPhotoUrl && !report.afterPhotoUrl) {
    return deny(400, 'AFTER_PHOTO_REQUIRED', 'An after-photo URL is required to mark a report as Resolved.');
  }

  return allow(false);
}
