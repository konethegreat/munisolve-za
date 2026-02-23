// ==========================================
// AI ROUTES
// ==========================================
const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/ai.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { generalLimiter } = require('../middleware/rateLimit.middleware');




// All AI routes require authentication
router.use(generalLimiter);
router.use(authenticate);

/**
 * @route  POST /api/ai/chat
 * @desc   Chat with Siyanda about a report
 * @access Private
 * 
 * Body: { reportId, message, history: [{role, content}] }
 */
router.post('/chat', chat);

module.exports = router;