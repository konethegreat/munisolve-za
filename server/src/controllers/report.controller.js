// ==========================================
// REPORT CONTROLLER (with status updates)
// ==========================================
const prisma = require('../config/db.config');
const { AppError } = require('../errors/AppError');
const { generateAutoResponse } = require('./ai.controller');
const { getWeatherForLocation } = require('../services/weather.service');
const { transitionReport } = require('../services/report.service');
const { slaWindowsForNewReport } = require('../services/sla.service');
const { suggestDuplicates, autoMergeSameReporter } = require('../services/duplicate.service');

const createReport = async (req, res) => {
  const { title, description, category, municipality, address, latitude, longitude } = req.validated.body;
  const userId = req.user.id;

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
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  let aiResponse = null;
  try {
    aiResponse = await generateAutoResponse(report, req.user);
  } catch { /* Don't fail if AI is down */ }

  await prisma.activityLog.create({
    data: {
      userId, action: 'CREATE_REPORT', entity: 'Report', entityId: report.id,
      description: `Report created: ${title}`, ipAddress: req.ip, userAgent: req.get('User-Agent'),
      requestId: req.id,
    },
  });

  // Duplicate detection is advisory: a failure here must never fail the report.
  let duplicates = [];
  let mergedInto = null;
  try {
    duplicates = await suggestDuplicates({ report });
    if (duplicates.length > 0) {
      mergedInto = await autoMergeSameReporter(report, duplicates, {
        actor: { id: userId, role: req.user.role },
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }
  } catch { /* Keep the report even when duplicate detection fails. */ }

  const finalReport = mergedInto
    ? await prisma.report.findUnique({
        where: { id: report.id },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      })
    : report;

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

const getAllReports = async (req, res) => {
  const { status, category, municipality } = req.validated.query;
  const userId = req.user.id;
  const isAdmin = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

  // Admins see ALL reports, citizens see only their own
  const where = isAdmin ? {} : { userId };
  if (status) where.status = status;
  if (category) where.category = category;
  if (municipality) where.municipality = municipality;

  const reports = await prisma.report.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ success: true, data: reports, count: reports.length });
};

const getReportById = async (req, res) => {
  const id = req.validated.params.id;
  const userId = req.user.id;
  const isAdmin = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

  const where = isAdmin ? { id } : { id, userId };

  const report = await prisma.report.findFirst({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
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
const updateStatus = async (req, res) => {
  const { id } = req.validated.params;
  const { status, note } = req.validated.body;

  const updated = await transitionReport({
    reportId: id,
    actor: { id: req.user.id, role: req.user.role },
    nextStatus: status,
    note,
    requestId: req.id,
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

const updateReport = async (req, res) => {
  const id = req.validated.params.id;
  const userId = req.user.id;

  const existing = await prisma.report.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

  const data = { ...req.validated.body };
  const updated = await prisma.report.update({ where: { id }, data });

  res.status(200).json({ success: true, message: 'Report updated', data: updated });
};

const deleteReport = async (req, res) => {
  const id = req.validated.params.id;
  const userId = req.user.id;

  const existing = await prisma.report.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

  await prisma.report.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Report deleted' });
};

module.exports = { createReport, getAllReports, getReportById, updateStatus, updateReport, deleteReport };