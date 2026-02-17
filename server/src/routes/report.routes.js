// ==========================================
// REPORT ROUTES
// ==========================================
const express = require('express');
const router = express.Router();

const {
  createReport,
  getAllReports,
  getReportById,
  updateStatus,
  updateReport,
  deleteReport,
} = require('../controllers/report.controller');

const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/',              createReport);
router.get('/',               getAllReports);
router.get('/:id',            getReportById);
router.patch('/:id/status',   updateStatus);   // ← Status updates
router.put('/:id',            updateReport);
router.delete('/:id',         deleteReport);

module.exports = router;