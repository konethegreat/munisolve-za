const express = require('express');
const router = express.Router();

const {
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
} = require('../controllers/report.controller');

const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// CRUD Routes
router.post('/', createReport);
router.get('/', getAllReports);
router.get('/:id', getReportById);
router.put('/:id', updateReport);
router.delete('/:id', deleteReport);

module.exports = router;