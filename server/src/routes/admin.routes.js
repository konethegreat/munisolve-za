const express = require('express');
const router = express.Router();

const { requireAdmin } = require('../middleware/requireAdmin.middleware');
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../schemas/common');
const { adminReportStatusSchema } = require('../schemas/report');

const {
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
} = require('../controllers/admin.controller');

router.use(requireAdmin);

// Dashboard
router.get('/dashboard', getAdminDashboard);

// Reports
router.get('/reports',                    getAdminReports);
router.get('/reports/:id',                getAdminReport);
router.patch('/reports/:id/status',       validate({ params: idParamSchema, body: adminReportStatusSchema }), patchAdminReportStatus);
router.delete('/reports/:id',             deleteAdminReport);

// Users
router.get('/users',                      getAdminUsers);
router.get('/users/:id',                  getAdminUser);
router.patch('/users/:id/status',         patchAdminUserStatus);
router.patch('/users/:id/role',           patchAdminUserRole);
router.delete('/users/:id',               deleteAdminUser);

// Activity logs
router.get('/activity-logs',              getAdminActivityLogs);

module.exports = router;
