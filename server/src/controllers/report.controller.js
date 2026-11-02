// ==========================================
// REPORT CONTROLLER (with status updates)
// ==========================================
const prisma = require('../config/db.config');
const { AppError } = require('../errors/AppError');
const { generateAutoResponse } = require('./ai.controller');
const { getWeatherForLocation } = require('../services/weather.service');

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
    },
  });

  res.status(201).json({
    success: true,
    message: 'Report created successfully',
    data: { ...report, aiResponse },
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
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(userRole);

    // Valid statuses
    const validStatuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Find the report
    const report = await prisma.report.findFirst({
      where: isAdmin ? { id: parseInt(id) } : { id: parseInt(id), userId },
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Citizen permission check
    if (!isAdmin) {
      const allowedForCitizen = ['RESOLVED'];
      if (!allowedForCitizen.includes(status)) {
        return res.status(403).json({
          success: false,
          message: 'Citizens can only mark reports as Resolved.',
          errorCode: 'INSUFFICIENT_PERMISSIONS',
        });
      }
      if (!['PENDING', 'IN_PROGRESS'].includes(report.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from ${report.status} to ${status}.`,
        });
      }
    }

    // Update the report status
    const updated = await prisma.report.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE_STATUS',
        entity: 'Report',
        entityId: updated.id,
        description: `Status changed from ${report.status} → ${status}${note ? `: ${note}` : ''}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    console.log(`[REPORT] Status updated: #${id} ${report.status} → ${status} by ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: `Report marked as ${status}`,
      data: updated,
    });
  } catch (error) {
    console.error('[REPORT ERROR] Status update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
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