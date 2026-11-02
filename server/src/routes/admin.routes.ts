import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin.middleware';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common';
import { adminReportStatusSchema } from '../schemas/report';
import {
  adminReportsQuerySchema,
  adminUsersQuerySchema,
  adminActivityLogsQuerySchema,
  adminUserRoleSchema,
  adminUserStatusSchema,
} from '../schemas/admin';
import {
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
} from '../controllers/admin.controller';
import { unmergeReport } from '../controllers/duplicate.controller';
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  rotateWebhookSecret,
  deleteWebhook,
  listWebhookDeliveries,
} from '../controllers/webhook.controller';
import { webhookCreateSchema, webhookUpdateSchema } from '../schemas/webhook';

const router = express.Router();

router.use(requireAdmin);

router.get('/dashboard', getAdminDashboard);

router.get('/reports', validate({ query: adminReportsQuerySchema }), getAdminReports);
router.get('/reports/:id', validate({ params: idParamSchema }), getAdminReport);
router.patch('/reports/:id/status', validate({ params: idParamSchema, body: adminReportStatusSchema }), patchAdminReportStatus);
router.post('/reports/:id/unmerge', validate({ params: idParamSchema }), unmergeReport);
router.delete('/reports/:id', validate({ params: idParamSchema }), deleteAdminReport);

router.get('/users', validate({ query: adminUsersQuerySchema }), getAdminUsers);
router.get('/users/:id', validate({ params: idParamSchema }), getAdminUser);
router.patch('/users/:id/status', validate({ params: idParamSchema, body: adminUserStatusSchema }), patchAdminUserStatus);
router.patch('/users/:id/role', validate({ params: idParamSchema, body: adminUserRoleSchema }), patchAdminUserRole);
router.delete('/users/:id', validate({ params: idParamSchema }), deleteAdminUser);

router.get('/activity-logs', validate({ query: adminActivityLogsQuerySchema }), getAdminActivityLogs);

router.get('/webhooks', listWebhooks);
router.post('/webhooks', validate({ body: webhookCreateSchema }), createWebhook);
router.patch('/webhooks/:id', validate({ params: idParamSchema, body: webhookUpdateSchema }), updateWebhook);
router.post('/webhooks/:id/rotate-secret', validate({ params: idParamSchema }), rotateWebhookSecret);
router.get('/webhooks/:id/deliveries', validate({ params: idParamSchema }), listWebhookDeliveries);
router.delete('/webhooks/:id', validate({ params: idParamSchema }), deleteWebhook);

export = router;
