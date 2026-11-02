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
const { unmergeReport } = require('../controllers/duplicate.controller');
const {
  listWebhooks,
  createWebhook,
  updateWebhook,
  rotateWebhookSecret,
  deleteWebhook,
  listWebhookDeliveries,
} = require('../controllers/webhook.controller');
const { webhookCreateSchema, webhookUpdateSchema } = require('../schemas/webhook');

router.use(requireAdmin);

// Dashboard
router.get('/dashboard', getAdminDashboard);

// Reports
router.get('/reports', validate({ query: adminReportsQuerySchema }), getAdminReports);
router.get('/reports/:id', validate({ params: idParamSchema }), getAdminReport);
router.patch('/reports/:id/status', validate({ params: idParamSchema, body: adminReportStatusSchema }), patchAdminReportStatus);
router.post('/reports/:id/unmerge', validate({ params: idParamSchema }), unmergeReport);
router.delete('/reports/:id', validate({ params: idParamSchema }), deleteAdminReport);

// Users
router.get('/users', validate({ query: adminUsersQuerySchema }), getAdminUsers);
router.get('/users/:id', validate({ params: idParamSchema }), getAdminUser);
router.patch('/users/:id/status', validate({ params: idParamSchema, body: adminUserStatusSchema }), patchAdminUserStatus);
router.patch('/users/:id/role', validate({ params: idParamSchema, body: adminUserRoleSchema }), patchAdminUserRole);
router.delete('/users/:id', validate({ params: idParamSchema }), deleteAdminUser);

// Activity logs
router.get('/activity-logs', validate({ query: adminActivityLogsQuerySchema }), getAdminActivityLogs);

// Outbound webhooks
router.get('/webhooks', listWebhooks);
router.post('/webhooks', validate({ body: webhookCreateSchema }), createWebhook);
router.patch('/webhooks/:id', validate({ params: idParamSchema, body: webhookUpdateSchema }), updateWebhook);
router.post('/webhooks/:id/rotate-secret', validate({ params: idParamSchema }), rotateWebhookSecret);
router.get('/webhooks/:id/deliveries', validate({ params: idParamSchema }), listWebhookDeliveries);
router.delete('/webhooks/:id', validate({ params: idParamSchema }), deleteWebhook);

module.exports = router;
