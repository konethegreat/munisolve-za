const prisma = require('../config/db.config');

// Status transitions allowed by supervisors
const SUPERVISOR_VALID_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'];

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
  try {
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
  } catch (error) {
    console.error('[SUPERVISOR] getDashboard:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard.' });
  }
};

// ── Triage Queue — unassigned PENDING reports ──────────────────────────────

const getTriageReports = async (req, res) => {
  try {
    const { category, municipality, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { status: 'PENDING' };
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (municipality) where.municipality = { contains: municipality, mode: 'insensitive' };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'asc' }, // oldest first — highest urgency
        skip,
        take: parseInt(limit),
      }),
      prisma.report.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: reports,
      count: reports.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('[SUPERVISOR] getTriageReports:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve triage queue.' });
  }
};

// ── Active Reports — ASSIGNED + IN_PROGRESS ────────────────────────────────

const getActiveReports = async (req, res) => {
  try {
    const { status, teamId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } };
    if (status && ['ASSIGNED', 'IN_PROGRESS'].includes(status)) where.status = status;
    if (teamId) where.assignedTeamId = parseInt(teamId);

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          team: { select: { id: true, name: true, specialization: true } },
        },
        orderBy: { assignedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.report.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: reports,
      count: reports.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('[SUPERVISOR] getActiveReports:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve active reports.' });
  }
};

// ── Get single report ──────────────────────────────────────────────────────

const getSupervisorReport = async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        team: true,
      },
    });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('[SUPERVISOR] getSupervisorReport:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve report.' });
  }
};

// ── Assign report to a team ────────────────────────────────────────────────

const assignReport = async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { teamId, note } = req.body;

    if (!teamId) {
      return res.status(400).json({ success: false, message: 'teamId is required.' });
    }

    const [report, team] = await Promise.all([
      prisma.report.findUnique({ where: { id: reportId } }),
      prisma.team.findUnique({ where: { id: parseInt(teamId) } }),
    ]);

    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
    if (!team.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot assign to an inactive team.' });
    }
    if (!['PENDING', 'ASSIGNED'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign a report with status ${report.status}.`,
      });
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status: 'ASSIGNED', assignedTeamId: parseInt(teamId), assignedAt: new Date() },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        team: { select: { id: true, name: true, specialization: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'REPORT_ASSIGNED',
        entity: 'Report',
        entityId: reportId,
        description: `Report #${reportId} assigned to team "${team.name}"${note ? `: ${note}` : ''}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Report assigned to ${team.name}`,
      data: updated,
    });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    console.error('[SUPERVISOR] assignReport:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign report.' });
  }
};

// ── Update report status (supervisor workflow) ─────────────────────────────

const updateSupervisorReportStatus = async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const { status, afterPhotoUrl, note } = req.body;

    if (!SUPERVISOR_VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${SUPERVISOR_VALID_STATUSES.join(', ')}`,
      });
    }

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });

    // Enforce afterPhotoUrl when moving to RESOLVED
    if (status === 'RESOLVED' && !afterPhotoUrl && !report.afterPhotoUrl) {
      return res.status(400).json({
        success: false,
        message: 'An after-photo URL is required to mark a report as Resolved.',
        errorCode: 'AFTER_PHOTO_REQUIRED',
      });
    }

    const updateData = { status };
    if (afterPhotoUrl) updateData.afterPhotoUrl = afterPhotoUrl;

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: updateData,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        team: { select: { id: true, name: true, specialization: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'REPORT_STATUS_CHANGED',
        entity: 'Report',
        entityId: reportId,
        description: `Report #${reportId} status changed: ${report.status} → ${status}${note ? ` — ${note}` : ''}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    console.error('[SUPERVISOR] updateSupervisorReportStatus:', error);
    return res.status(500).json({ success: false, message: 'Failed to update report status.' });
  }
};

// ── Proximity & category-match suggestions for a report ───────────────────

const getTeamSuggestions = async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { id: true, category: true, latitude: true, longitude: true, municipality: true },
    });

    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });

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
  } catch (error) {
    console.error('[SUPERVISOR] getTeamSuggestions:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve suggestions.' });
  }
};

// ── Teams CRUD ─────────────────────────────────────────────────────────────

const getTeams = async (req, res) => {
  try {
    const { isActive } = req.query;
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
  } catch (error) {
    console.error('[SUPERVISOR] getTeams:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve teams.' });
  }
};

const createTeam = async (req, res) => {
  try {
    const { name, specialization, municipality, latitude, longitude } = req.body;

    if (!name || !specialization) {
      return res.status(400).json({ success: false, message: 'name and specialization are required.' });
    }

    const team = await prisma.team.create({
      data: {
        name,
        specialization,
        ...(municipality && { municipality }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
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
  } catch (error) {
    console.error('[SUPERVISOR] createTeam:', error);
    return res.status(500).json({ success: false, message: 'Failed to create team.' });
  }
};

const updateTeam = async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const { name, specialization, municipality, latitude, longitude, isActive } = req.body;

    const existing = await prisma.team.findUnique({ where: { id: teamId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Team not found.' });

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name && { name }),
        ...(specialization && { specialization }),
        ...(municipality !== undefined && { municipality }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
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
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }
    console.error('[SUPERVISOR] updateTeam:', error);
    return res.status(500).json({ success: false, message: 'Failed to update team.' });
  }
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
