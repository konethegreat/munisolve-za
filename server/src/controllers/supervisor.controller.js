const prisma = require('../config/db.config');
const { AppError } = require('../errors/AppError');
const { assignReport: assignReportService, transitionReport } = require('../services/report.service');

// Category → specialization keyword mapping for proximity suggestions
const CATEGORY_SPEC_KEYWORDS = {
  ROADS: ['Roads', 'Infrastructure'],
  POTHOLE: ['Roads', 'Infrastructure'],
  WATER: ['Water', 'Sanitation'],
  WATER_LEAK: ['Water', 'Sanitation'],
  ELECTRICITY: ['Electricity', 'Power'],
  POWER: ['Electricity', 'Power'],
  WASTE: ['Waste'],
  SEWAGE: ['Water', 'Sanitation'],
  LIGHTING: ['Electricity', 'Infrastructure'],
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function specializationMatchScore(category, specialization) {
  const upperCat = (category || '').toUpperCase();
  const upperSpec = (specialization || '').toUpperCase();
  for (const [key, keywords] of Object.entries(CATEGORY_SPEC_KEYWORDS)) {
    if (upperCat.includes(key)) {
      if (keywords.some((k) => upperSpec.includes(k.toUpperCase()))) return 2;
    }
  }
  return 1;
}

// ── Dashboard Overview ─────────────────────────────────────────────────────

const getSupervisorDashboard = async (req, res) => {
  const [pending, assigned, inProgress, resolved, closed, totalTeams, activeTeams] =
    await Promise.all([
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.report.count({ where: { status: 'ASSIGNED' } }),
      prisma.report.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.report.count({ where: { status: 'RESOLVED' } }),
      prisma.report.count({ where: { status: 'CLOSED' } }),
      prisma.team.count(),
      prisma.team.count({ where: { isActive: true } }),
    ]);

  return res.status(200).json({
    success: true,
    data: { pending, assigned, inProgress, resolved, closed, totalTeams, activeTeams },
  });
};

// ── Triage Queue — unassigned PENDING reports ──────────────────────────────

const getTriageReports = async (req, res) => {
  const { category, municipality, page, limit } = req.validated.query;
  const skip = (page - 1) * limit;

  const where = { status: 'PENDING' };
  if (category) where.category = { contains: category, mode: 'insensitive' };
  if (municipality) where.municipality = { contains: municipality, mode: 'insensitive' };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' }, // oldest first — highest urgency
      skip,
      take: limit,
    }),
    prisma.report.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    data: reports,
    count: reports.length,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
};

// ── Active Reports — ASSIGNED + IN_PROGRESS ────────────────────────────────

const getActiveReports = async (req, res) => {
  const { status, teamId, page, limit } = req.validated.query;
  const skip = (page - 1) * limit;

  const where = { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } };
  if (status) where.status = status;
  if (teamId) where.assignedTeamId = teamId;

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        team: { select: { id: true, name: true, specialization: true } },
      },
      orderBy: { assignedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.report.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    data: reports,
    count: reports.length,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
};

// ── Get single report ──────────────────────────────────────────────────────

const getSupervisorReport = async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.validated.params.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      team: true,
    },
  });
  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  return res.status(200).json({ success: true, data: report });
};

// ── Assign report to a team ────────────────────────────────────────────────

const assignReport = async (req, res) => {
  const { id } = req.validated.params;
  const { teamId, note } = req.validated.body;

  const updated = await assignReportService({
    reportId: id,
    teamId,
    note,
    actor: { id: req.user.id, role: req.user.role },
    requestId: req.id,
  });

  return res.status(200).json({
    success: true,
    message: `Report assigned to ${updated.team.name}`,
    data: updated,
  });
};

// ── Update report status (supervisor workflow) ─────────────────────────────

const updateSupervisorReportStatus = async (req, res) => {
  const { id } = req.validated.params;
  const { status, afterPhotoUrl, note } = req.validated.body;

  const updated = await transitionReport({
    reportId: id,
    actor: { id: req.user.id, role: req.user.role },
    nextStatus: status,
    afterPhotoUrl,
    note,
    requestId: req.id,
    source: 'supervisor',
  });

  return res.status(200).json({
    success: true,
    message: `Status updated to ${status}`,
    data: updated,
  });
};

// ── Proximity & category-match suggestions for a report ───────────────────

const getTeamSuggestions = async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.validated.params.id },
    select: { id: true, category: true, latitude: true, longitude: true, municipality: true },
  });

  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');

  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: { _count: { select: { reports: { where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } } } } },
  });

  const scored = teams.map((team) => {
    const specScore = specializationMatchScore(report.category, team.specialization);
    let distanceKm = null;
    if (report.latitude && report.longitude && team.latitude && team.longitude) {
      distanceKm = haversineKm(report.latitude, report.longitude, team.latitude, team.longitude);
    }
    const muniMatch = report.municipality && team.municipality
      ? report.municipality.toLowerCase() === team.municipality.toLowerCase()
      : false;

    return {
      ...team,
      activeTickets: team._count.reports,
      specScore,
      distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
      muniMatch,
      // Higher score = better suggestion
      sortScore: specScore * 10 + (muniMatch ? 5 : 0) - (distanceKm ?? 50),
    };
  });

  scored.sort((a, b) => b.sortScore - a.sortScore);
  const result = scored.map(({ sortScore, _count, ...rest }) => rest);

  return res.status(200).json({ success: true, data: result });
};

// ── Teams CRUD ─────────────────────────────────────────────────────────────

const getTeams = async (req, res) => {
  const { isActive } = req.validated.query;
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const teams = await prisma.team.findMany({
    where,
    include: {
      _count: {
        select: {
          reports: { where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const data = teams.map(({ _count, ...team }) => ({
    ...team,
    activeTickets: _count.reports,
  }));

  return res.status(200).json({ success: true, data, count: data.length });
};

const createTeam = async (req, res) => {
  const { name, specialization, municipality, latitude, longitude } = req.validated.body;

  const team = await prisma.team.create({
    data: {
      name,
      specialization,
      ...(municipality !== undefined && { municipality }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user.id,
      action: 'TEAM_CREATED',
      entity: 'Team',
      entityId: team.id,
      description: `Team "${name}" (${specialization}) created`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  return res.status(201).json({ success: true, message: 'Team created', data: team });
};

const updateTeam = async (req, res) => {
  const teamId = req.validated.params.id;
  const { name, specialization, municipality, latitude, longitude, isActive } = req.validated.body;

  const existing = await prisma.team.findUnique({ where: { id: teamId } });
  if (!existing) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found.');

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: {
      ...(name !== undefined && { name }),
      ...(specialization !== undefined && { specialization }),
      ...(municipality !== undefined && { municipality }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user.id,
      action: 'TEAM_UPDATED',
      entity: 'Team',
      entityId: teamId,
      description: `Team #${teamId} updated`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  return res.status(200).json({ success: true, message: 'Team updated', data: updated });
};

module.exports = {
  getSupervisorDashboard,
  getTriageReports,
  getActiveReports,
  getSupervisorReport,
  assignReport,
  updateSupervisorReportStatus,
  getTeamSuggestions,
  getTeams,
  createTeam,
  updateTeam,
};
