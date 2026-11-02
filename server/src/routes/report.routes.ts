import express from 'express';
import {
  createReport,
  getAllReports,
  getReportById,
  updateStatus,
  updateReport,
  deleteReport,
} from '../controllers/report.controller';
import { getDuplicates, confirmDuplicate, dismissDuplicate } from '../controllers/duplicate.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/common';
import {
  createReportSchema,
  updateReportSchema,
  reportStatusBodySchema,
  reportListQuerySchema,
  duplicateParamsSchema,
} from '../schemas/report';

const router = express.Router();

router.use(authenticate);

router.post('/', validate({ body: createReportSchema }), createReport);
router.get('/', validate({ query: reportListQuerySchema }), getAllReports);
router.get('/:id', validate({ params: idParamSchema }), getReportById);
router.get('/:id/duplicates', validate({ params: idParamSchema }), getDuplicates);
router.post('/:id/duplicates/:candidateId/confirm', validate({ params: duplicateParamsSchema }), confirmDuplicate);
router.post('/:id/duplicates/:candidateId/dismiss', validate({ params: duplicateParamsSchema }), dismissDuplicate);
router.patch('/:id/status', validate({ params: idParamSchema, body: reportStatusBodySchema }), updateStatus);
router.put('/:id', validate({ params: idParamSchema, body: updateReportSchema }), updateReport);
router.delete('/:id', validate({ params: idParamSchema }), deleteReport);

export = router;
