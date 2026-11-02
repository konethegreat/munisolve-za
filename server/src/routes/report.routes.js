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
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../schemas/common');
const {
  createReportSchema,
  updateReportSchema,
  reportStatusBodySchema,
  reportListQuerySchema,
} = require('../schemas/report');

router.use(authenticate);

router.post('/',            validate({ body: createReportSchema }), createReport);
router.get('/',             validate({ query: reportListQuerySchema }), getAllReports);
router.get('/:id',          validate({ params: idParamSchema }), getReportById);
router.patch('/:id/status', validate({ params: idParamSchema, body: reportStatusBodySchema }), updateStatus);
router.put('/:id',          validate({ params: idParamSchema, body: updateReportSchema }), updateReport);
router.delete('/:id',       validate({ params: idParamSchema }), deleteReport);

module.exports = router;