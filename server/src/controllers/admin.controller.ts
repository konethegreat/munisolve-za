import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../config/db.config';
import { AppError } from '../errors/AppError';
import { transitionReport } from '../services/report.service';

// ── Reports ────────────────────────────────────────────────────────────────

export const getAdminReports: RequestHandler = async (req, res) => {
  const { status, category, municipality, page, limit } = req.validated.query;
  const skip = (page - 1) * limit;

  const where: Prisma.ReportWhereInput = {};
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
      take: limit,
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
    page,
    pages: Math.ceil(total / limit),
  });
};

export const getAdminReport: RequestHandler = async (req, res) => {
  const { id } = req.validated.params;

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  });

  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

  return res.status(200).json({ success: true, data: report });
};

export const patchAdminReportStatus: RequestHandler = async (req, res) => {
  const { id } = req.validated.params;
  const { status, reason } = req.validated.body;

  const updated = await transitionReport({
    reportId: id,
    actor: { id: req.user!.id, role: req.user!.role },
    nextStatus: status,
    reason,
    requestId: String(req.id),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    source: 'admin',
  });

  return res.status(200).json({ success: true, message: `Status updated to ${status}`, data: updated });
};

export const deleteAdminReport: RequestHandler = async (req, res) => {
  const { id } = req.validated.params;

  await prisma.report.delete({ where: { id } });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.id,
      action: 'ADMIN_DELETE_REPORT',
      entity: 'Report',
      entityId: id,
      description: `Admin deleted report #${id}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: String(req.id),
    },
  });

  return res.status(200).json({ success: true, message: 'Report deleted' });
};

// ── Users ──────────────────────────────────────────────────────────────────

export const getAdminUsers: RequestHandler = async (req, res) => {
  const { role, isActive, page, limit } = req.validated.query;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};
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
      take: limit,
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
    page,
    pages: Math.ceil(total / limit),
  });
};

export const getAdminUser: RequestHandler = async (req, res) => {
  const { id } = req.validated.params;

  const user = await prisma.user.findUnique({
    where: { id },
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

  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  return res.status(200).json({ success: true, data: user });
};

export const patchAdminUserStatus: RequestHandler = async (req, res) => {
  const { id: userId } = req.validated.params;

  if (userId === req.user!.id) {
    throw new AppError(400, 'SELF_PROTECTED', 'Cannot deactivate your own account.');
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, email: true } });
  if (!target) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const nextValue = req.validated.body.isActive ?? !target.isActive;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: nextValue },
    select: { id: true, email: true, isActive: true, role: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.id,
      action: updated.isActive ? 'ADMIN_ACTIVATE_USER' : 'ADMIN_DEACTIVATE_USER',
      entity: 'User',
      entityId: userId,
      description: `Admin ${updated.isActive ? 'activated' : 'deactivated'} user ${target.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: String(req.id),
    },
  });

  return res.status(200).json({
    success: true,
    message: `User ${updated.isActive ? 'activated' : 'deactivated'}`,
    data: updated,
  });
};

export const patchAdminUserRole: RequestHandler = async (req, res) => {
  const { id: userId } = req.validated.params;
  const { role } = req.validated.body;

  if (userId === req.user!.id) {
    throw new AppError(400, 'SELF_PROTECTED', 'Cannot change your own role.');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, role: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.id,
      action: 'ADMIN_CHANGE_USER_ROLE',
      entity: 'User',
      entityId: userId,
      description: `Admin changed user ${updated.email} role to ${role}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: String(req.id),
    },
  });

  return res.status(200).json({ success: true, message: `Role updated to ${role}`, data: updated });
};

export const deleteAdminUser: RequestHandler = async (req, res) => {
  const { id: userId } = req.validated.params;

  if (userId === req.user!.id) {
    throw new AppError(400, 'SELF_PROTECTED', 'Cannot delete your own account.');
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!target) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  await prisma.user.delete({ where: { id: userId } });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.id,
      action: 'ADMIN_DELETE_USER',
      entity: 'User',
      entityId: userId,
      description: `Admin deleted user ${target.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: String(req.id),
    },
  });

  return res.status(200).json({ success: true, message: 'User deleted' });
};

// ── Activity Logs ──────────────────────────────────────────────────────────

export const getAdminActivityLogs: RequestHandler = async (req, res) => {
  const { userId, action, entity, page, limit } = req.validated.query;
  const skip = (page - 1) * limit;

  const where: Prisma.ActivityLogWhereInput = {};
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (entity) where.entity = { contains: entity, mode: 'insensitive' };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    data: logs,
    count: logs.length,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
};

// ── Dashboard Overview ─────────────────────────────────────────────────────

export const getAdminDashboard: RequestHandler = async (_req, res) => {
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
};
