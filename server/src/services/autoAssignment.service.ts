import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.config';
import { logger } from '../logger';
import { AUTO_ASSIGN_MIN_AGE_MINUTES, planAssignment } from '../domain/assignment';
import type { AssignmentPlan, AssignmentReport, AssignmentTeam } from '../domain/assignment';
import type { NotificationDraft } from '../domain/sla';
import { assignReport } from './report.service';

export const AUTO_ASSIGN_BATCH_SIZE = 25;
const SYSTEM_EMAIL = 'system@munisolve.local';

export function autoAssignEnabled(value: string | undefined = process.env.AUTO_ASSIGN_ENABLED): boolean {
  return String(value ?? '').toLowerCase() === 'true';
}

export interface AutoAssignSummary {
  autoAssigned: number;
  decisions: number;
  notifications: NotificationDraft[];
}

async function ensureSystemUser(client: any): Promise<any> {
  const existing = await client.user.findUnique({ where: { email: SYSTEM_EMAIL } });
  if (existing) return existing;

  try {
    return await client.user.create({
      data: {
        email: SYSTEM_EMAIL,
        password: bcrypt.hashSync(crypto.randomUUID(), 10),
        firstName: 'System',
        lastName: 'Automation',
        role: 'SUPER_ADMIN',
        isActive: false,
        isVerified: true,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      const raced = await client.user.findUnique({ where: { email: SYSTEM_EMAIL } });
      if (raced) return raced;
    }
    throw error;
  }
}

function assignmentEmail(report: any, team: any, plan: AssignmentPlan, clientUrl: string): { subject: string; body: string } {
  return {
    subject: `Report #${report.id} auto-assigned to ${team?.name ?? 'a crew'}`,
    body: [
      `Report #${report.id} "${report.title}" (${report.category}) in ${report.municipality} was assigned automatically.`,
      `Team: ${team?.name ?? 'unknown'} — score ${plan.score}${plan.runnerUpScore == null ? '' : `, runner-up ${plan.runnerUpScore}`}.`,
      `Why: ${plan.reasons.join(', ')}.`,
      `Open the report: ${clientUrl}/reports/${report.id}`,
    ].join('\n\n'),
  };
}

// Evaluates the oldest unassigned PENDING reports once each. A report whose decision already
// exists is not evaluated again, so the table stays proportional to reports, not to ticks.
export async function evaluateAutoAssignments(options: {
  now: Date;
  client?: any;
  enabled?: boolean;
}): Promise<AutoAssignSummary> {
  const client = options.client ?? prisma;
  const enabled = options.enabled ?? autoAssignEnabled();
  if (!enabled) return { autoAssigned: 0, decisions: 0, notifications: [] };

  const cutoff = new Date(options.now.getTime() - AUTO_ASSIGN_MIN_AGE_MINUTES * 60 * 1000);
  const reports = await client.report.findMany({
    where: { status: 'PENDING', assignedTeamId: null, createdAt: { lte: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: AUTO_ASSIGN_BATCH_SIZE,
  });
  if (reports.length === 0) return { autoAssigned: 0, decisions: 0, notifications: [] };

  const decided = await client.assignmentDecision.findMany({
    where: { reportId: { in: reports.map((report: any) => report.id) } },
    select: { reportId: true },
  });
  const decidedIds = new Set(decided.map((row: any) => row.reportId));
  const evaluated = reports.filter((report: any) => !decidedIds.has(report.id));
  if (evaluated.length === 0) return { autoAssigned: 0, decisions: 0, notifications: [] };

  const [teams, suggestions, admins, system] = await Promise.all([
    client.team.findMany({
      where: { isActive: true },
      include: { _count: { select: { reports: { where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } } } } },
    }),
    client.duplicateCandidate.findMany({
      where: { reportId: { in: evaluated.map((report: any) => report.id) }, status: 'SUGGESTED' },
      select: { reportId: true },
    }),
    client.user.findMany({
      where: { role: { in: ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { email: true, firstName: true },
    }),
    ensureSystemUser(client),
  ]);

  const suggested = new Set(suggestions.map((row: any) => row.reportId));
  const scoredTeams: AssignmentTeam[] = teams.map((team: any) => ({
    ...team,
    activeTickets: team._count?.reports ?? 0,
  }));
  const clientUrl = String(process.env.CLIENT_URL ?? '').replace(/\/$/, '');
  const notifications: NotificationDraft[] = [];

  let autoAssigned = 0;
  let decisions = 0;

  for (const report of evaluated) {
    const plan = planAssignment({
      report: report as AssignmentReport,
      teams: scoredTeams,
      enabled: true,
      hasSuggestedDuplicate: suggested.has(report.id),
    });

    let outcome: AssignmentPlan = plan;
    if (plan.mode === 'AUTO' && plan.teamId != null) {
      try {
        await assignReport({
          reportId: report.id,
          teamId: plan.teamId,
          note: `Auto-assigned by SYSTEM (score ${plan.score}; ${plan.reasons.join(', ')})`,
          actor: { id: system.id, role: system.role, system: true },
        });
        autoAssigned += 1;

        const team = teams.find((entry: any) => entry.id === plan.teamId);
        for (const admin of admins) {
          const email = String(admin.email ?? '').trim().toLowerCase();
          if (!email) continue;
          const content = assignmentEmail(report, team, plan, clientUrl);
          notifications.push({
            dedupeKey: `autoassign:r${report.id}:t${plan.teamId}`,
            kind: 'REPORT_AUTO_ASSIGNED',
            reportId: report.id,
            recipientEmail: email,
            subject: content.subject,
            body: content.body,
          });
        }
      } catch (error) {
        logger.warn({ err: error, reportId: report.id }, 'Automatic assignment failed');
        outcome = {
          mode: 'SKIPPED',
          teamId: null,
          score: plan.score,
          runnerUpScore: plan.runnerUpScore,
          reasons: [...plan.reasons, 'ASSIGNMENT_FAILED'],
        };
      }
    }

    await client.assignmentDecision.create({
      data: {
        reportId: report.id,
        teamId: outcome.teamId,
        mode: outcome.mode,
        score: outcome.score,
        runnerUpScore: outcome.runnerUpScore,
        reasons: JSON.stringify(outcome.reasons),
      },
    });
    decisions += 1;
  }

  return { autoAssigned, decisions, notifications };
}
