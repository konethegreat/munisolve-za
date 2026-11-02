import express from 'express';
import { chat } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { aiChatLimiter } from '../middleware/rateLimit.middleware';
import { aiChatSchema } from '../schemas/ai';

const router = express.Router();

// Authenticate first so the rate limiter can key by user ID, not just IP.
router.use(authenticate);
router.use(aiChatLimiter);

router.post('/chat', validate({ body: aiChatSchema }), chat);

export = router;
