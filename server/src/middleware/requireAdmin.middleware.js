// ==========================================
// REQUIRE ADMIN MIDDLEWARE
// ==========================================
// Purpose: Authenticate JWT and require MUNICIPAL_ADMIN or SUPER_ADMIN
// Must be used to protect admin-only routes

const { authenticate } = require('./auth.middleware');

const requireAdmin = async (req, res, next) => {
  return authenticate(req, res, () => {
    try {
      const role = req.user?.role;
      const isAdmin = role === 'MUNICIPAL_ADMIN' || role === 'SUPER_ADMIN';

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
          errorCode: 'ADMIN_ONLY',
        });
      }

      return next();
    } catch (error) {
      console.error('[REQUIRE_ADMIN ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error. Please try again.',
        errorCode: 'AUTHZ_ERROR',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
      });
    }
  });
};

module.exports = { requireAdmin };

