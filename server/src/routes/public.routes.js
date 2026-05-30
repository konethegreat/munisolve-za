// ==========================================
// PUBLIC ROUTES (no authentication required)
// ==========================================
// Powers public-facing widgets using free, keyless data sources:
//   GET /api/public/stats         -> aggregate community statistics
//   GET /api/public/air-quality   -> live air quality (Open-Meteo)
//   GET /api/public/holidays      -> SA public holidays (Nager.Date)
// ==========================================

const express = require('express');
const router = express.Router();
const { generalLimiter } = require('../middleware/rateLimit.middleware');
const { getStats, getAirQuality, getHolidays } = require('../controllers/public.controller');

router.use(generalLimiter);

router.get('/stats', getStats);
router.get('/air-quality', getAirQuality);
router.get('/holidays', getHolidays);

module.exports = router;
