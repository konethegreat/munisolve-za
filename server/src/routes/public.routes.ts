import express from 'express';
import { validate } from '../middleware/validate';
import { airQualityQuerySchema } from '../schemas/public';
import { getStats, getAirQuality, getHolidays } from '../controllers/public.controller';

const router = express.Router();

router.get('/stats', getStats);
router.get('/air-quality', validate({ query: airQualityQuerySchema }), getAirQuality);
router.get('/holidays', getHolidays);

export = router;
