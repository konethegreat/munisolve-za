// ==========================================
// REPORT CONTROLLER (with AI auto-response)
// ==========================================
const prisma = require('../config/db.config');
const { generateAutoResponse } = require('./ai.controller');

const createReport = async (req, res) => {
  try {
    const { title, description, category, municipality, address } = req.body;
    const userId = req.user.id;

    const report = await prisma.report.create({
      data: {
        title,
        description,
        category,
        municipality,
        address,
        status: 'PENDING',
        userId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Generate Siyanda's auto-response (non-blocking)
    let aiResponse = null;
    try {
      aiResponse = await generateAutoResponse(report, req.user);
    } catch {
      // Don't fail the report creation if AI is down
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE_REPORT',
        entity: 'Report',
        entityId: report.id,
        description: `Report created: ${title}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      data: {
        ...report,
        aiResponse, // Include Siyanda's first message
      },
    });

  } catch (error) {
    console.error('[REPORT ERROR] Create failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create report. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
    });
  }
};

const getAllReports = async (req, res) => {
  try {
    const { status, category, municipality } = req.query;
    const userId = req.user.id;

    const where = { userId };
    if (status) where.status = status;
    if (category) where.category = category;
    if (municipality) where.municipality = municipality;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, data: reports, count: reports.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve reports' });
  }
};

const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const report = await prisma.report.findFirst({
      where: { id: parseInt(id), userId },
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve report' });
  }
};

const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, category, municipality, address } = req.body;

    const existing = await prisma.report.findFirst({
      where: { id: parseInt(id), userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const updated = await prisma.report.update({
      where: { id: parseInt(id) },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(category && { category }),
        ...(municipality && { municipality }),
        ...(address && { address }),
      },
    });

    res.status(200).json({ success: true, message: 'Report updated', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update report' });
  }
};

const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await prisma.report.findFirst({
      where: { id: parseInt(id), userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await prisma.report.delete({ where: { id: parseInt(id) } });

    res.status(200).json({ success: true, message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete report' });
  }
};

module.exports = { createReport, getAllReports, getReportById, updateReport, deleteReport };