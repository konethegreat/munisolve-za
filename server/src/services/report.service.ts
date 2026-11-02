import prisma from '../config/db.config';
import { AppError } from '../errors/AppError';
import { canTransition } from '../domain/reportStateMachine';
import type { ReportStatus, Role } from '../domain/reportStateMachine';

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
  source: TransitionSource;
}

interface AssignOptions {
  reportId: number;
  teamId: number;
  note?: string;
  actor: Actor;
  requestId?: string;
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
    }

    if (
      (options.nextStatus === 'PENDING' || options.nextStatus === 'IN_PROGRESS') &&
      (report.status === 'RESOLVED' || report.status === 'CLOSED')
    ) {
      data.reopenCount = { increment: 1 };
    }

    const updated = await tx.report.update({
      where: { id: report.id },
      data,
      include: reportInclude,
    });

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

    if (!['PENDING', 'ASSIGNED'].includes(report.status)) {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot assign a report with status ${report.status}.`);
    }

    const updated = await tx.report.update({
      where: { id: report.id },
      data: {
        status: 'ASSIGNED',
        assignedTeamId: options.teamId,
        assignedAt: new Date(),
      },
      include: reportInclude,
    });

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
      },
    });

    return updated;
  });
}
