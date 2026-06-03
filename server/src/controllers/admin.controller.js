const prisma = require('../config/db.config');

const VALID_REPORT_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
const VALID_ROLES = ['CITIZEN', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN', 'WORKER_SUPERVISOR'];

// ── Reports ────────────────────────────────────────────────────────────────

const getAdminReports = async (req, res) => {
  try {
    const { status, category, municipality, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (municipality) where.municipality = { contains: municipality, mode: 'insensitive' };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.report.count({ where }),
    ]);

    const data = reports.map((r) => ({
      ...r,
      user: {
        ...r.user,
        name: `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim(),
      },
    }));

    return res.status(200).json({
      success: true,
      data,
      count: data.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('[ADMIN] getAdminReports:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reports.' });
  }
};

const getAdminReport = async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('[ADMIN] getAdminReport:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve report.' });
  }
};

const patchAdminReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!VALID_REPORT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_REPORT_STATUSES.join(', ')}`,
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
        description: `Admin set report #${id} status to ${status}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(200).json({ success: true, message: `Status updated to ${status}`, data: updated });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    console.error('[ADMIN] patchAdminReportStatus:', error);
    return res.status(500).json({ success: false, message: 'Failed to update report status.' });
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
    console.error('[ADMIN] deleteAdminReport:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete report.' });
  }
};

// ── Users ──────────────────────────────────────────────────────────────────

const getAdminUsers = async (req, res) => {
  try {
    const { role, isActive, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLogin: true,
          _count: { select: { reports: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      ...u,
      name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
      reportCount: u._count.reports,
      _count: undefined,
    }));

    return res.status(200).json({
      success: true,
      data,
      count: data.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('[ADMIN] getAdminUsers:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
};

const getAdminUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true,
        reports: {
          select: { id: true, title: true, status: true, category: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { reports: true } },
      },
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('[ADMIN] getAdminUser:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve user.' });
  }
};

const patchAdminUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account.' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, email: true } });
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !target.isActive },
      select: { id: true, email: true, isActive: true, role: true },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: updated.isActive ? 'ADMIN_ACTIVATE_USER' : 'ADMIN_DEACTIVATE_USER',
        entity: 'User',
        entityId: userId,
        description: `Admin ${updated.isActive ? 'activated' : 'deactivated'} user ${target.email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(200).json({
      success: true,
      message: `User ${updated.isActive ? 'activated' : 'deactivated'}`,
      data: updated,
    });
  } catch (error) {
    console.error('[ADMIN] patchAdminUserStatus:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
};

const patchAdminUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const userId = parseInt(id);

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_CHANGE_USER_ROLE',
        entity: 'User',
        entityId: userId,
        description: `Admin changed user ${updated.email} role to ${role}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(200).json({ success: true, message: `Role updated to ${role}`, data: updated });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.error('[ADMIN] patchAdminUserRole:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
};

const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    await prisma.user.delete({ where: { id: userId } });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_DELETE_USER',
        entity: 'User',
        entityId: userId,
        description: `Admin deleted user ${target.email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.error('[ADMIN] deleteAdminUser:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
};

// ── Activity Logs ──────────────────────────────────────────────────────────

const getAdminActivityLogs = async (req, res) => {
  try {
    const { userId, action, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.activityLog.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('[ADMIN] getAdminActivityLogs:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve activity logs.' });
  }
};

// ── Dashboard Overview ─────────────────────────────────────────────────────

const getAdminDashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalReports,
      pending,
      inProgress,
      resolved,
      rejected,
      recentReports,
      recentLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.report.count(),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.report.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.report.count({ where: { status: 'RESOLVED' } }),
      prisma.report.count({ where: { status: 'REJECTED' } }),
      prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, inactive: totalUsers - activeUsers },
        reports: {
          total: totalReports,
          pending,
          inProgress,
          resolved,
          rejected,
          resolutionRate: totalReports > 0 ? Math.round((resolved / totalReports) * 100) : 0,
        },
        recentReports,
        recentActivity: recentLogs,
      },
    });
  } catch (error) {
    console.error('[ADMIN] getAdminDashboard:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard data.' });
  }
};

module.exports = {
  getAdminDashboard,
  getAdminReports,
  getAdminReport,
  patchAdminReportStatus,
  deleteAdminReport,
  getAdminUsers,
  getAdminUser,
  patchAdminUserStatus,
  patchAdminUserRole,
  deleteAdminUser,
  getAdminActivityLogs,
};
