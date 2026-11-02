const express = require('express');
const router = express.Router();

const { requireAdmin } = require('../middleware/requireAdmin.middleware');
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../schemas/common');
const { adminReportStatusSchema } = require('../schemas/report');
const {
  adminReportsQuerySchema,
  adminUsersQuerySchema,
  adminActivityLogsQuerySchema,
  adminUserRoleSchema,
  adminUserStatusSchema,
} = require('../schemas/admin');

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
router.get('/reports', validate({ query: adminReportsQuerySchema }), getAdminReports);
router.get('/reports/:id', validate({ params: idParamSchema }), getAdminReport);
router.patch('/reports/:id/status', validate({ params: idParamSchema, body: adminReportStatusSchema }), patchAdminReportStatus);
router.delete('/reports/:id', validate({ params: idParamSchema }), deleteAdminReport);

// Users
router.get('/users', validate({ query: adminUsersQuerySchema }), getAdminUsers);
router.get('/users/:id', validate({ params: idParamSchema }), getAdminUser);
router.patch('/users/:id/status', validate({ params: idParamSchema, body: adminUserStatusSchema }), patchAdminUserStatus);
router.patch('/users/:id/role', validate({ params: idParamSchema, body: adminUserRoleSchema }), patchAdminUserRole);
router.delete('/users/:id', validate({ params: idParamSchema }), deleteAdminUser);

// Activity logs
router.get('/activity-logs', validate({ query: adminActivityLogsQuerySchema }), getAdminActivityLogs);

module.exports = router;
