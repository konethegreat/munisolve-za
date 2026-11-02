const express = require('express');
const router = express.Router();
const { requireSupervisor } = require('../middleware/requireSupervisor.middleware');
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../schemas/common');
const { assignReportSchema, supervisorStatusSchema } = require('../schemas/report');
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
router.get('/reports/triage',         getTriageReports);
router.get('/reports/active',         getActiveReports);
router.get('/reports/:id',            getSupervisorReport);
router.patch('/reports/:id/assign',   validate({ params: idParamSchema, body: assignReportSchema }), assignReport);
router.patch('/reports/:id/status',   validate({ params: idParamSchema, body: supervisorStatusSchema }), updateSupervisorReportStatus);
router.get('/reports/:id/suggestions', getTeamSuggestions);

// Teams
router.get('/teams',    getTeams);
router.post('/teams',   createTeam);
router.patch('/teams/:id', updateTeam);

module.exports = router;
