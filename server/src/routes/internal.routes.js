const express = require('express');
const { generalLimiter } = require('../middleware/rateLimit.middleware');
const { tick } = require('../controllers/tick.controller');

const router = express.Router();

// This router is mounted before the global /api limiter so its own limiter is the only one that runs.
router.post('/tick', generalLimiter, tick);

module.exports = router;
