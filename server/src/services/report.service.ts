import prisma from '../config/db.config';
import { AppError } from '../errors/AppError';
import { ALLOWED_TRANSITIONS, canTransition } from '../domain/reportStateMachine';
import type { ReportStatus, Role } from '../domain/reportStateMachine';
import { resetResolutionWindow } from './sla.service';

export type TransitionSource = 'reports' | 'supervisor' | 'admin';

interface Actor {
  id: number;
  role: Role;
}

interface TransitionOptions {
  reportId: number;
  actor: Actor;
  nextStatus: ReportStatus;
  note?: string;
  afterPhotoUrl?: string;
  reason?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  source: TransitionSource;
}

interface AssignOptions {
  reportId: number;
  teamId: number;
  note?: string;
  actor: Actor;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const ACTION_BY_SOURCE: Record<TransitionSource, string> = {
  reports: 'UPDATE_STATUS',
  supervisor: 'REPORT_STATUS_CHANGED',
  admin: 'ADMIN_UPDATE_REPORT_STATUS',
};

const reportInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  team: { select: { id: true, name: true, specialization: true } },
};

// Assignment is its own route, so the current statuses that may be assigned are the ones the
// matrix lets reach ASSIGNED. Deriving them keeps this guard in step with the state machine.
const ASSIGNABLE_STATUSES: readonly string[] = (Object.keys(ALLOWED_TRANSITIONS) as ReportStatus[]).filter(
  (status) => ALLOWED_TRANSITIONS[status].includes('ASSIGNED'),
);

// A move back to PENDING or IN_PROGRESS from any finished state is a reopen, including a
// rejected report that is sent back to triage.
const REOPEN_SOURCES: readonly string[] = ['RESOLVED', 'CLOSED', 'REJECTED'];

// Two requests can read the same status and both pass the matrix, so the write is conditional on
// the status that was read. A lost race becomes a 409 instead of a false "from" history row.
const STALE_STATUS_MESSAGE = 'Report status changed. Refresh and try again.';

function transitionDescription(source: TransitionSource, reportId: number, from: string, to: string, note?: string): string {
  if (source === 'supervisor') {
    return `Report #${reportId} status changed: ${from} → ${to}${note ? ` — ${note}` : ''}`;
  }
  if (source === 'admin') {
    return `Admin set report #${reportId} status to ${to}${note ? `: ${note}` : ''}`;
  }
  return `Status changed from ${from} → ${to}${note ? `: ${note}` : ''}`;
}

export async function transitionReport(options: TransitionOptions) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id: options.reportId } });
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');

    // The citizen route ("reports", source of PATCH /api/reports/:id/status) is auth-only, so it must
    // not disclose whether a foreign report exists. Check ownership before any other guard (including
    // the ASSIGNED guard) so ownership failures stay indistinguishable from a missing report.
    // The supervisor and admin routes keep their global scope.
    if (
      options.source === 'reports' &&
      !['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(options.actor.role) &&
      report.userId !== options.actor.id
    ) {
      throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');
    }

    if (options.nextStatus === 'ASSIGNED') {
      throw new AppError(400, 'ASSIGNMENT_REQUIRED', 'Use the assignment endpoint to assign a team.');
    }

    const decision = canTransition({
      role: options.actor.role,
      actorId: options.actor.id,
      report: {
        id: report.id,
        userId: report.userId,
        status: report.status as ReportStatus,
        afterPhotoUrl: report.afterPhotoUrl,
      },
      nextStatus: options.nextStatus,
      afterPhotoUrl: options.afterPhotoUrl,
      reason: options.reason,
    });

    if (decision.allowed === false) {
      throw new AppError(decision.statusCode, decision.errorCode, decision.message);
    }

    const data: Record<string, unknown> = { status: options.nextStatus };
    if (options.afterPhotoUrl) data.afterPhotoUrl = options.afterPhotoUrl;

    if (options.nextStatus === 'RESOLVED') {
      data.resolvedAt = new Date();
      data.closedAt = null;
    } else if (options.nextStatus === 'CLOSED') {
      data.closedAt = new Date();
    } else if (options.nextStatus === 'PENDING' || options.nextStatus === 'IN_PROGRESS') {
      data.resolvedAt = null;
      data.closedAt = null;
    } else if (options.nextStatus === 'REJECTED') {
      data.resolvedAt = null;
    }

    if (
      (options.nextStatus === 'PENDING' || options.nextStatus === 'IN_PROGRESS') &&
      REOPEN_SOURCES.includes(report.status)
    ) {
      const windows = await resetResolutionWindow(report.category, new Date(), tx);
      data.reopenCount = { increment: 1 };
      data.resolutionDueAt = windows.resolutionDueAt;
      data.slaCycleStartedAt = windows.slaCycleStartedAt;
    }

    const guard = await tx.report.updateMany({
      where: { id: report.id, status: report.status },
      data,
    });
    if (guard.count !== 1) {
      throw new AppError(409, 'INVALID_TRANSITION', STALE_STATUS_MESSAGE);
    }

    const updated = await tx.report.findUnique({ where: { id: report.id }, include: reportInclude });

    await tx.reportStatusHistory.create({
      data: {
        reportId: report.id,
        fromStatus: report.status,
        toStatus: options.nextStatus,
        actorId: options.actor.id,
        actorRole: options.actor.role,
        note: options.note ?? null,
        requestId: options.requestId ?? null,
      },
    });

    const action = decision.forced ? 'OVERRIDE_STATUS' : ACTION_BY_SOURCE[options.source];
    const description = decision.forced
      ? `Status override: report #${report.id} ${report.status} → ${options.nextStatus}: ${options.reason ?? ''}`
      : transitionDescription(options.source, report.id, report.status, options.nextStatus, options.note);

    await tx.activityLog.create({
      data: {
        userId: options.actor.id,
        action,
        entity: 'Report',
        entityId: report.id,
        description,
        requestId: options.requestId ?? null,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
      },
    });

    return updated;
  });
}

export async function assignReport(options: AssignOptions) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id: options.reportId } });
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');

    const team = await tx.team.findUnique({ where: { id: options.teamId } });
    if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found.');
    if (!team.isActive) throw new AppError(400, 'INACTIVE_TEAM', 'Cannot assign to an inactive team.');

    if (!ASSIGNABLE_STATUSES.includes(report.status)) {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot assign a report with status ${report.status}.`);
    }

    const guard = await tx.report.updateMany({
      where: { id: report.id, status: report.status },
      data: {
        status: 'ASSIGNED',
        assignedTeamId: options.teamId,
        assignedAt: new Date(),
      },
    });
    if (guard.count !== 1) {
      throw new AppError(409, 'INVALID_TRANSITION', STALE_STATUS_MESSAGE);
    }

    const updated = await tx.report.findUnique({ where: { id: report.id }, include: reportInclude });

    await tx.reportStatusHistory.create({
      data: {
        reportId: report.id,
        fromStatus: report.status,
        toStatus: 'ASSIGNED',
        actorId: options.actor.id,
        actorRole: options.actor.role,
        note: options.note ?? null,
        requestId: options.requestId ?? null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: options.actor.id,
        action: 'REPORT_ASSIGNED',
        entity: 'Report',
        entityId: report.id,
        description: `Report #${report.id} assigned to team "${team.name}"${options.note ? `: ${options.note}` : ''}`,
        requestId: options.requestId ?? null,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
      },
    });

    return updated;
  });
}
