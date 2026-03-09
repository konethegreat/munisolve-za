// ==========================================
// ADMIN CONTROLLER
// ==========================================
const prisma = require('../config/db.config');

const getAdminReports = async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = reports.map((r) => ({
      ...r,
      user: {
        ...r.user,
        name: `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim(),
      },
    }));

    return res.status(200).json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('[ADMIN ERROR] Failed to fetch reports:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve reports.',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
    });
  }
};

const patchAdminReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        errorCode: 'INVALID_STATUS',
      });
    }

    const updated = await prisma.report.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_UPDATE_REPORT_STATUS',
        entity: 'Report',
        entityId: updated.id,
        description: `Admin set report status to ${status}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Report status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    // Prisma: "Record to update not found." => P2025
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    console.error('[ADMIN ERROR] Failed to update report status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update report status.',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
    });
  }
};

const deleteAdminReport = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.report.delete({ where: { id: parseInt(id) } });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_DELETE_REPORT',
        entity: 'Report',
        entityId: parseInt(id),
        description: `Admin deleted report #${id}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(200).json({ success: true, message: 'Report deleted' });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    console.error('[ADMIN ERROR] Failed to delete report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete report.',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
    });
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = users.map((u) => ({
      id: u.id,
      name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    }));

    return res.status(200).json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('[ADMIN ERROR] Failed to fetch users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users.',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
    });
  }
};

module.exports = {
  getAdminReports,
  patchAdminReportStatus,
  deleteAdminReport,
  getAdminUsers,
};

