// ==========================================
// REPORT CONTROLLER
// ==========================================
// Handles report creation, retrieval, and management
// Author: MuniSolve ZA Development Team

const prisma = require('../config/db.config');

// ==========================================
// CREATE REPORT
// ==========================================
/**
 * Create a new service delivery report
 * 
 * @route POST /api/reports
 * @access Private (requires authentication)
 */
const createReport = async (req, res) => {
  try {
    const { title, description, category, municipality, address } = req.body;
    const userId = req.user.id; // From auth middleware

    // Create the report
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

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

    console.log(`[REPORT] Report created by ${req.user.email}: ${title}`);

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      data: report,
    });
  } catch (error) {
    console.error('[REPORT ERROR] Create failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create report. Please try again.',
      errorCode: 'CREATE_REPORT_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error.message,
      }),
    });
  }
};

// ==========================================
// GET ALL REPORTS
// ==========================================
/**
 * Get all reports (with filters)
 * 
 * @route GET /api/reports
 * @access Private
 */
const getAllReports = async (req, res) => {
  try {
    const { status, category, municipality } = req.query;
    const userId = req.user.id;

    // Build filter
    const where = {
      userId, // Only show user's own reports
    };

    if (status) where.status = status;
    if (category) where.category = category;
    if (municipality) where.municipality = municipality;

    // Get reports
    const reports = await prisma.report.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      data: reports,
      count: reports.length,
    });
  } catch (error) {
    console.error('[REPORT ERROR] Get all failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reports',
      errorCode: 'GET_REPORTS_ERROR',
    });
  }
};

// ==========================================
// GET SINGLE REPORT
// ==========================================
/**
 * Get single report by ID
 * 
 * @route GET /api/reports/:id
 * @access Private
 */
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const report = await prisma.report.findFirst({
      where: {
        id: parseInt(id),
        userId, // Only show user's own report
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
        errorCode: 'REPORT_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[REPORT ERROR] Get by ID failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve report',
      errorCode: 'GET_REPORT_ERROR',
    });
  }
};

// ==========================================
// UPDATE REPORT
// ==========================================
/**
 * Update report (user can only update their own)
 * 
 * @route PUT /api/reports/:id
 * @access Private
 */
const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, category, municipality, address } = req.body;

    // Check if report exists and belongs to user
    const existingReport = await prisma.report.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
    });

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or you do not have permission to update it',
        errorCode: 'REPORT_NOT_FOUND',
      });
    }

    // Update report
    const updatedReport = await prisma.report.update({
      where: { id: parseInt(id) },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(category && { category }),
        ...(municipality && { municipality }),
        ...(address && { address }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE_REPORT',
        entity: 'Report',
        entityId: updatedReport.id,
        description: `Report updated: ${updatedReport.title}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Report updated successfully',
      data: updatedReport,
    });
  } catch (error) {
    console.error('[REPORT ERROR] Update failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update report',
      errorCode: 'UPDATE_REPORT_ERROR',
    });
  }
};

// ==========================================
// DELETE REPORT
// ==========================================
/**
 * Delete report (user can only delete their own)
 * 
 * @route DELETE /api/reports/:id
 * @access Private
 */
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if report exists and belongs to user
    const existingReport = await prisma.report.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
    });

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or you do not have permission to delete it',
        errorCode: 'REPORT_NOT_FOUND',
      });
    }

    // Delete report
    await prisma.report.delete({
      where: { id: parseInt(id) },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETE_REPORT',
        entity: 'Report',
        entityId: parseInt(id),
        description: `Report deleted: ${existingReport.title}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('[REPORT ERROR] Delete failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete report',
      errorCode: 'DELETE_REPORT_ERROR',
    });
  }
};

// ==========================================
// EXPORT CONTROLLER FUNCTIONS
// ==========================================
module.exports = {
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
};
