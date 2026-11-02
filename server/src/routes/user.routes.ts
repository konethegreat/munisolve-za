import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { superAdminOnly } from '../middleware/authz.middleware';
import { generalLimiter } from '../middleware/rateLimit.middleware';

const router = express.Router();

// Not mounted in server.ts yet; when it is, the global /api limiter also applies.
router.get('/', generalLimiter, authenticate, superAdminOnly, (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'User management endpoint - Coming soon',
    data: [],
    hint: 'Full user management will be implemented after core features',
  });
});

export = router;
