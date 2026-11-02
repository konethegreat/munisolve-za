import express from 'express';
import { requireSupervisor } from '../middleware/requireSupervisor.middleware';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common';
import { assignReportSchema, supervisorStatusSchema } from '../schemas/report';
import {
  triageQuerySchema,
  activeReportsQuerySchema,
  teamsQuerySchema,
  teamCreateSchema,
  teamUpdateSchema,
} from '../schemas/supervisor';
import {
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
} from '../controllers/supervisor.controller';

const router = express.Router();

router.use(requireSupervisor);

router.get('/dashboard', getSupervisorDashboard);

router.get('/reports/triage', validate({ query: triageQuerySchema }), getTriageReports);
router.get('/reports/active', validate({ query: activeReportsQuerySchema }), getActiveReports);
router.get('/reports/:id', validate({ params: idParamSchema }), getSupervisorReport);
router.patch('/reports/:id/assign', validate({ params: idParamSchema, body: assignReportSchema }), assignReport);
router.patch('/reports/:id/status', validate({ params: idParamSchema, body: supervisorStatusSchema }), updateSupervisorReportStatus);
router.get('/reports/:id/suggestions', validate({ params: idParamSchema }), getTeamSuggestions);

router.get('/teams', validate({ query: teamsQuerySchema }), getTeams);
router.post('/teams', validate({ body: teamCreateSchema }), createTeam);
router.patch('/teams/:id', validate({ params: idParamSchema, body: teamUpdateSchema }), updateTeam);

export = router;
