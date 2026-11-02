const express = require('express');
const router = express.Router();
const { requireSupervisor } = require('../middleware/requireSupervisor.middleware');
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../schemas/common');
const { assignReportSchema, supervisorStatusSchema } = require('../schemas/report');
const {
  triageQuerySchema,
  activeReportsQuerySchema,
  teamsQuerySchema,
  teamCreateSchema,
  teamUpdateSchema,
} = require('../schemas/supervisor');
const {
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
} = require('../controllers/supervisor.controller');

// All routes require WORKER_SUPERVISOR, MUNICIPAL_ADMIN, or SUPER_ADMIN
router.use(requireSupervisor);

// Dashboard
router.get('/dashboard', getSupervisorDashboard);

// Reports
router.get('/reports/triage', validate({ query: triageQuerySchema }), getTriageReports);
router.get('/reports/active', validate({ query: activeReportsQuerySchema }), getActiveReports);
router.get('/reports/:id', validate({ params: idParamSchema }), getSupervisorReport);
router.patch('/reports/:id/assign', validate({ params: idParamSchema, body: assignReportSchema }), assignReport);
router.patch('/reports/:id/status', validate({ params: idParamSchema, body: supervisorStatusSchema }), updateSupervisorReportStatus);
router.get('/reports/:id/suggestions', validate({ params: idParamSchema }), getTeamSuggestions);

// Teams
router.get('/teams', validate({ query: teamsQuerySchema }), getTeams);
router.post('/teams', validate({ body: teamCreateSchema }), createTeam);
router.patch('/teams/:id', validate({ params: idParamSchema, body: teamUpdateSchema }), updateTeam);

module.exports = router;
