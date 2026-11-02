// ==========================================
// AI ROUTES
// ==========================================
const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/ai.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate');
const { aiChatLimiter } = require('../middleware/rateLimit.middleware');
const { aiChatSchema } = require('../schemas/ai');

// Authenticate first so the rate limiter can key by user ID, not just IP
router.use(authenticate);
router.use(aiChatLimiter);

/**
 * @route  POST /api/ai/chat
 * @desc   Chat with Siyanda about a report
 * @access Private
 * 
 * Body: { reportId, message, history: [{role, content}] }
 */
router.post('/chat', validate({ body: aiChatSchema }), chat);

module.exports = router;