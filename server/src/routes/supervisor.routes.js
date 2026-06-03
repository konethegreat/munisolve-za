const express = require('express');
const router = express.Router();
const { requireSupervisor } = require('../middleware/requireSupervisor.middleware');
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
router.patch('/reports/:id/assign',   assignReport);
router.patch('/reports/:id/status',   updateSupervisorReportStatus);
router.get('/reports/:id/suggestions', getTeamSuggestions);

// Teams
router.get('/teams',    getTeams);
router.post('/teams',   createTeam);
router.patch('/teams/:id', updateTeam);

module.exports = router;
