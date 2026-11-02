import express from 'express';
import { generalLimiter } from '../middleware/rateLimit.middleware';
import { tick } from '../controllers/tick.controller';

const router = express.Router();

// Mounted before the global /api limiter so its own limiter is the only one that runs.
router.post('/tick', generalLimiter, tick);

export = router;
