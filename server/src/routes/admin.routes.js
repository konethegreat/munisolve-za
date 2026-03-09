// ==========================================
// ADMIN ROUTES
// ==========================================
const express = require('express');
const router = express.Router();

const { generalLimiter } = require('../middleware/rateLimit.middleware');
const { requireAdmin } = require('../middleware/requireAdmin.middleware');

const {
  getAdminReports,
  patchAdminReportStatus,
  deleteAdminReport,
  getAdminUsers,
} = require('../controllers/admin.controller');

router.use(generalLimiter);
router.use(requireAdmin);

// 1) GET /api/admin/reports
router.get('/reports', getAdminReports);

// 2) PATCH /api/admin/reports/:id/status
router.patch('/reports/:id/status', patchAdminReportStatus);

// 3) DELETE /api/admin/reports/:id
router.delete('/reports/:id', deleteAdminReport);

// 4) GET /api/admin/users
router.get('/users', getAdminUsers);

module.exports = router;

