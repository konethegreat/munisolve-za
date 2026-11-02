// ==========================================
// USER ROUTES (Placeholder)
// ==========================================
// Defines user management endpoints
// This is a placeholder - full implementation coming next
// Author: MuniSolve ZA Development Team

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth.middleware');
const { superAdminOnly } = require('../middleware/authz.middleware');
const { generalLimiter } = require('../middleware/rateLimit.middleware');

// ==========================================
// PLACEHOLDER ROUTES
// ==========================================
// All user management routes require SUPER_ADMIN role

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Super Admin only)
 */
// Not mounted in server.js yet; when it is, the global /api limiter also applies.
router.get(
  '/',
  generalLimiter,
  authenticate,
  superAdminOnly,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'User management endpoint - Coming soon',
      data: [],
      hint: 'Full user management will be implemented after core features'
    });
  }
);

module.exports = router;