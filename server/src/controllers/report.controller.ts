// ==========================================
// REPORT CONTROLLER (with status updates)
// ==========================================
import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../config/db.config';
import { AppError } from '../errors/AppError';
import { generateAutoResponse } from './ai.controller';
import { getWeatherForLocation } from '../services/weather.service';
import { transitionReport } from '../services/report.service';
import { slaWindowsForNewReport } from '../services/sla.service';
import { suggestDuplicates, autoMergeSameReporter } from '../services/duplicate.service';
import { enqueueReportEvent } from '../services/webhook.service';
import { logger } from '../logger';

const REPORT_USER_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

export const createReport: RequestHandler = async (req, res) => {
  const { title, description, category, municipality, address, latitude, longitude } = req.validated.body;
  const userId = req.user!.id;

  // Fetch weather data if coordinates are provided
  let weatherData = null;
  if (latitude !== undefined && longitude !== undefined) {
    try {
      weatherData = await getWeatherForLocation(latitude, longitude);
    } catch {
      weatherData = null;
    }
  }

  const slaWindows = await slaWindowsForNewReport(category);

  const report = await prisma.report.create({
    data: {
      title,
      description,
      category,
      municipality,
      ...(address !== undefined && { address }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(weatherData && {
        weatherTemp: weatherData.weatherTemp,
        weatherCondition: weatherData.weatherCondition,
        weatherRainfall: weatherData.weatherRainfall,
        weatherWind: weatherData.weatherWind,
        weatherHumidity: weatherData.weatherHumidity,
      }),
      status: 'PENDING',
      userId,
      ...slaWindows,
    },
    include: {
      user: { select: REPORT_USER_SELECT },
    },
  });

  let aiResponse = null;
  try {
    aiResponse = await generateAutoResponse(report, req.user!);
  } catch { /* Don't fail if AI is down */ }

  await prisma.activityLog.create({
    data: {
      userId, action: 'CREATE_REPORT', entity: 'Report', entityId: report.id,
      description: `Report created: ${title}`, ipAddress: req.ip, userAgent: req.get('User-Agent'),
      requestId: String(req.id),
    },
  });

  // Duplicate detection is advisory: a failure here must never fail the report.
  let duplicates: any[] = [];
  let mergedInto: any = null;
  try {
    duplicates = await suggestDuplicates({ report });
    if (duplicates.length > 0) {
      mergedInto = await autoMergeSameReporter(report, duplicates, {
        actor: { id: userId, role: req.user!.role },
        requestId: String(req.id),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }
  } catch { /* Keep the report even when duplicate detection fails. */ }

  const finalReport = mergedInto
    ? await prisma.report.findUnique({
        where: { id: report.id },
        include: { user: { select: REPORT_USER_SELECT } },
      })
    : report;

  try {
    await enqueueReportEvent({
      event: 'report.created',
      report: finalReport,
      extra: { duplicateSuggestions: duplicates.length, mergedIntoId: mergedInto?.id ?? null },
    });
  } catch (error) {
    logger.warn({ err: error, reportId: report.id }, 'Webhook enqueue failed');
  }

  res.status(201).json({
    success: true,
    message: mergedInto ? `Report merged into existing report #${mergedInto.id}` : 'Report created successfully',
    data: {
      ...finalReport,
      aiResponse,
      duplicates,
      mergedInto: mergedInto ? { id: mergedInto.id, title: mergedInto.title, status: mergedInto.status } : null,
    },
  });
};

export const getAllReports: RequestHandler = async (req, res) => {
  const { status, category, municipality } = req.validated.query;
  const userId = req.user!.id;
  const isAdmin = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(req.user!.role);

  // Admins see ALL reports, citizens see only their own
  const where: Prisma.ReportWhereInput = isAdmin ? {} : { userId };
  if (status) where.status = status;
  if (category) where.category = category;
  if (municipality) where.municipality = municipality;

  const reports = await prisma.report.findMany({
    where,
    include: {
      user: { select: REPORT_USER_SELECT },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ success: true, data: reports, count: reports.length });
};

export const getReportById: RequestHandler = async (req, res) => {
  const id = req.validated.params.id;
  const userId = req.user!.id;
  const isAdmin = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(req.user!.role);

  const where = isAdmin ? { id } : { id, userId };

  const report = await prisma.report.findFirst({
    where,
    include: {
      user: { select: REPORT_USER_SELECT },
    },
  });

  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

  res.status(200).json({ success: true, data: report });
};

// ==========================================
// UPDATE STATUS - Role-based permissions
// ==========================================
/**
 * Status transition rules:
 *
 * CITIZEN:
 *   PENDING     → RESOLVED  (they confirm it was fixed)
 *   IN_PROGRESS → RESOLVED  (they confirm it was fixed)
 *
 * MUNICIPAL_ADMIN / SUPER_ADMIN:
 *   PENDING     → IN_PROGRESS (they start working on it)
 *   PENDING     → RESOLVED
 *   PENDING     → REJECTED
 *   IN_PROGRESS → RESOLVED
 *   IN_PROGRESS → REJECTED
 *   RESOLVED    → IN_PROGRESS (re-open if citizen disputes)
 */
export const updateStatus: RequestHandler = async (req, res) => {
  const { id } = req.validated.params;
  const { status, note } = req.validated.body;

  const updated = await transitionReport({
    reportId: id,
    actor: { id: req.user!.id, role: req.user!.role },
    nextStatus: status,
    note,
    requestId: String(req.id),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    source: 'reports',
  });

  res.status(200).json({
    success: true,
    message: `Report marked as ${status}`,
    data: updated,
  });
};

export const updateReport: RequestHandler = async (req, res) => {
  const id = req.validated.params.id;
  const userId = req.user!.id;

  const existing = await prisma.report.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

  const data = { ...req.validated.body };
  const updated = await prisma.report.update({ where: { id }, data });

  res.status(200).json({ success: true, message: 'Report updated', data: updated });
};

export const deleteReport: RequestHandler = async (req, res) => {
  const id = req.validated.params.id;
  const userId = req.user!.id;

  const existing = await prisma.report.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

  await prisma.report.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Report deleted' });
};
