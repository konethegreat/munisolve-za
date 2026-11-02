import prisma from '../config/db.config';
import { logger } from '../logger';
import { AppError } from '../errors/AppError';
import { OPEN_REPORT_STATUSES } from '../domain/sla';
import {
  AUTO_MERGE_SCORE,
  DUPLICATE_CANDIDATE_THRESHOLD,
  boundingBox,
  familyForCategory,
  scoreDuplicateCandidates,
} from '../domain/duplicates';
import type { DuplicateReport } from '../domain/duplicates';
import { slaWindowsForNewReport } from './sla.service';
import { enqueueReportEvent } from './webhook.service';

export interface DuplicateActor {
  id: number;
  role: string;
}

interface EventContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const OPEN_STATUSES = [...OPEN_REPORT_STATUSES];
const reportInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  team: { select: { id: true, name: true, specialization: true } },
};

const candidateSelect = {
  id: true,
  title: true,
  category: true,
  status: true,
  municipality: true,
  address: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  userId: true,
  duplicateOfId: true,
};

function isAdmin(role: string): boolean {
  return role === 'MUNICIPAL_ADMIN' || role === 'SUPER_ADMIN';
}

async function loadReportForActor(client: any, reportId: number, actor: DuplicateActor): Promise<any> {
  const report = await client.report.findUnique({ where: { id: reportId } });
  if (!report || (!isAdmin(actor.role) && report.userId !== actor.id)) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  }
  return report;
}

async function detectCandidates(
  report: DuplicateReport,
  client: any,
  now: Date,
  threshold: number,
): Promise<any[]> {
  if (report.latitude == null || report.longitude == null) return [];

  const family = familyForCategory(report.category);
  const createdAt = new Date(report.createdAt);
  const box = boundingBox(report.latitude, report.longitude, family.radiusMeters);

  const candidates = await client.report.findMany({
    where: {
      id: { not: report.id },
      category: { in: [...family.categories] },
      status: { in: OPEN_STATUSES },
      createdAt: { gte: new Date(createdAt.getTime() - family.windowMinutes * 60 * 1000) },
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLon, lte: box.maxLon },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const scored = scoreDuplicateCandidates({
    report,
    candidates: candidates as DuplicateReport[],
    threshold,
  });

  if (scored.length > 0) {
    await client.duplicateCandidate.createMany({
      data: scored.map((entry) => ({
        reportId: report.id,
        candidateId: entry.report.id,
        score: entry.score,
        distanceM: Math.round(entry.distanceMeters),
        status: 'SUGGESTED',
      })),
      skipDuplicates: true,
    });
  }

  return client.duplicateCandidate.findMany({
    where: { reportId: report.id, status: 'SUGGESTED' },
    include: { candidate: { select: candidateSelect } },
    orderBy: { score: 'desc' },
  });
}

// Suggests duplicates for a freshly created report and returns the stored suggestions. Detection
// never blocks reporting: a failure here is the caller's to swallow.
export async function suggestDuplicates(options: {
  report: DuplicateReport & { id: number };
  client?: any;
  now?: Date;
  threshold?: number;
}): Promise<any[]> {
  return detectCandidates(
    options.report,
    options.client ?? prisma,
    options.now ?? new Date(),
    options.threshold ?? DUPLICATE_CANDIDATE_THRESHOLD,
  );
}

export async function listDuplicates(reportId: number, actor: DuplicateActor) {
  const report = await loadReportForActor(prisma, reportId, actor);
  return prisma.duplicateCandidate.findMany({
    where: { reportId: report.id },
    include: { candidate: { select: candidateSelect } },
    orderBy: { score: 'desc' },
  });
}

async function canonicalRoot(tx: any, start: any): Promise<any> {
  let current = start;
  for (let hops = 0; current?.duplicateOfId && hops < 5; hops += 1) {
    const next = await tx.report.findUnique({ where: { id: current.duplicateOfId } });
    if (!next) break;
    current = next;
  }
  return current;
}

export async function confirmDuplicate(options: {
  reportId: number;
  candidateId: number;
  actor: DuplicateActor;
  now?: Date;
} & EventContext) {
  const now = options.now ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    const report = await loadReportForActor(tx, options.reportId, options.actor);
    if (report.id === options.candidateId) {
      throw new AppError(400, 'SELF_MERGE', 'A report cannot be merged into itself.');
    }

    const link = await tx.duplicateCandidate.findFirst({
      where: { reportId: report.id, candidateId: options.candidateId },
    });
    if (!link) throw new AppError(404, 'DUPLICATE_NOT_FOUND', 'Duplicate suggestion not found.');
    if (link.status !== 'SUGGESTED') {
      throw new AppError(409, 'DUPLICATE_ALREADY_RESOLVED', 'This duplicate suggestion has already been resolved.');
    }
    if (!OPEN_STATUSES.includes(report.status)) {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot merge a report with status ${report.status}.`);
    }

    const candidate = await tx.report.findUnique({ where: { id: options.candidateId } });
    if (!candidate) throw new AppError(404, 'REPORT_NOT_FOUND', 'The original report no longer exists.');
    const canonical = await canonicalRoot(tx, candidate);
    if (canonical.id === report.id) {
      throw new AppError(409, 'DUPLICATE_CYCLE', 'That report already points back at this one.');
    }

    const guard = await tx.report.updateMany({
      where: { id: report.id, status: report.status },
      data: {
        status: 'CLOSED',
        closureReason: 'DUPLICATE',
        duplicateOfId: canonical.id,
        closedAt: now,
        resolvedAt: null,
        assignedTeamId: null,
        assignedAt: null,
        responseDueAt: null,
        resolutionDueAt: null,
        slaCycleStartedAt: null,
      },
    });
    if (guard.count !== 1) {
      throw new AppError(409, 'INVALID_TRANSITION', 'Report status changed. Refresh and try again.');
    }

    await tx.duplicateCandidate.update({
      where: { id: link.id },
      data: { status: 'MERGED', resolvedAt: now },
    });
    await tx.duplicateCandidate.updateMany({
      where: { reportId: report.id, status: 'SUGGESTED', id: { not: link.id } },
      data: { status: 'DISMISSED', resolvedAt: now },
    });

    const existingMerge = await tx.mergeRecord.findFirst({ where: { duplicateId: report.id } });
    if (existingMerge) {
      await tx.mergeRecord.update({
        where: { id: existingMerge.id },
        data: { canonicalId: canonical.id, mergedById: options.actor.id, undoneAt: null, undoneById: null },
      });
    } else {
      await tx.mergeRecord.create({
        data: { duplicateId: report.id, canonicalId: canonical.id, mergedById: options.actor.id },
      });
    }

    await tx.reportFollower.createMany({
      data: [{ reportId: canonical.id, userId: report.userId }],
      skipDuplicates: true,
    });

    await tx.reportStatusHistory.create({
      data: {
        reportId: report.id,
        fromStatus: report.status,
        toStatus: 'CLOSED',
        actorId: options.actor.id,
        actorRole: options.actor.role,
        note: `Merged into report #${canonical.id}`,
        requestId: options.requestId ?? null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: options.actor.id,
        action: 'REPORT_MERGED',
        entity: 'Report',
        entityId: report.id,
        description: `Report #${report.id} merged as a duplicate of #${canonical.id}`,
        requestId: options.requestId ?? null,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
      },
    });

    const updated = await tx.report.findUnique({ where: { id: report.id }, include: reportInclude });
    return { report: updated, canonical };
  });

  try {
    await enqueueReportEvent({
      event: 'report.merged',
      report: result.report,
      extra: { canonicalId: result.canonical.id },
    });
  } catch (error) {
    logger.warn({ err: error, reportId: options.reportId }, 'Webhook enqueue failed');
  }

  return result;
}

export async function dismissDuplicate(options: {
  reportId: number;
  candidateId: number;
  actor: DuplicateActor;
  now?: Date;
} & EventContext) {
  const now = options.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const report = await loadReportForActor(tx, options.reportId, options.actor);
    const link = await tx.duplicateCandidate.findFirst({
      where: { reportId: report.id, candidateId: options.candidateId },
    });
    if (!link) throw new AppError(404, 'DUPLICATE_NOT_FOUND', 'Duplicate suggestion not found.');
    if (link.status !== 'SUGGESTED') {
      throw new AppError(409, 'DUPLICATE_ALREADY_RESOLVED', 'This duplicate suggestion has already been resolved.');
    }

    const updated = await tx.duplicateCandidate.update({
      where: { id: link.id },
      data: { status: 'DISMISSED', resolvedAt: now },
    });

    await tx.activityLog.create({
      data: {
        userId: options.actor.id,
        action: 'DUPLICATE_DISMISSED',
        entity: 'Report',
        entityId: report.id,
        description: `Report #${report.id} kept separate from #${options.candidateId}`,
        requestId: options.requestId ?? null,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
      },
    });

    return updated;
  });
}

export async function unmergeReport(options: {
  reportId: number;
  actor: DuplicateActor;
  now?: Date;
} & EventContext) {
  const now = options.now ?? new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id: options.reportId } });
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');
    if (!report.duplicateOfId || report.closureReason !== 'DUPLICATE') {
      throw new AppError(409, 'NOT_MERGED', 'That report is not linked to a duplicate.');
    }

    const merge = await tx.mergeRecord.findFirst({ where: { duplicateId: report.id, undoneAt: null } });
    if (!merge) throw new AppError(409, 'NOT_MERGED', 'No active merge record was found.');

    const windows = await slaWindowsForNewReport(report.category, now, tx);

    const guard = await tx.report.updateMany({
      where: { id: report.id, status: 'CLOSED' },
      data: {
        status: 'PENDING',
        closureReason: null,
        duplicateOfId: null,
        closedAt: null,
        resolvedAt: null,
        assignedTeamId: null,
        assignedAt: null,
        ...windows,
      },
    });
    if (guard.count !== 1) {
      throw new AppError(409, 'INVALID_TRANSITION', 'Report status changed. Refresh and try again.');
    }

    const updated = await tx.report.findUnique({ where: { id: report.id }, include: reportInclude });

    await tx.reportStatusHistory.create({
      data: {
        reportId: report.id,
        fromStatus: 'CLOSED',
        toStatus: 'PENDING',
        actorId: options.actor.id,
        actorRole: options.actor.role,
        note: `Duplicate link to #${report.duplicateOfId} undone`,
        requestId: options.requestId ?? null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: options.actor.id,
        action: 'REPORT_UNMERGED',
        entity: 'Report',
        entityId: report.id,
        description: `Report #${report.id} restored from duplicate link to #${report.duplicateOfId}`,
        requestId: options.requestId ?? null,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
      },
    });

    await tx.mergeRecord.update({
      where: { id: merge.id },
      data: { undoneAt: now, undoneById: options.actor.id },
    });

    const follower = await tx.reportFollower.findFirst({
      where: { reportId: report.duplicateOfId, userId: report.userId },
    });
    if (follower) await tx.reportFollower.delete({ where: { id: follower.id } });

    await tx.duplicateCandidate.updateMany({
      where: { reportId: report.id, candidateId: report.duplicateOfId },
      data: { status: 'DISMISSED', resolvedAt: now },
    });

    return updated;
  });

  try {
    await enqueueReportEvent({ event: 'report.unmerged', report: updated });
  } catch (error) {
    logger.warn({ err: error, reportId: options.reportId }, 'Webhook enqueue failed');
  }

  return updated;
}

// Used by report creation: a same-reporter match that is nearly certain is merged immediately.
export async function autoMergeSameReporter(
  report: DuplicateReport & { id: number },
  suggestions: any[],
  options: { actor: DuplicateActor; now?: Date } & EventContext,
): Promise<any | null> {
  const best = suggestions.find(
    (row) => row.candidate?.userId === report.userId && row.score >= AUTO_MERGE_SCORE,
  );
  if (!best) return null;

  const result = await confirmDuplicate({
    reportId: report.id,
    candidateId: best.candidateId,
    actor: options.actor,
    now: options.now,
    requestId: options.requestId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  });
  return result.canonical;
}
