// ==========================================
// REQUIRE ADMIN MIDDLEWARE
// ==========================================
// Purpose: Authenticate JWT and require MUNICIPAL_ADMIN or SUPER_ADMIN
// Must be used to protect admin-only routes

const { authenticate } = require('./auth.middleware');
const { AppError } = require('../errors/AppError');

const requireAdmin = async (req, res, next) => {
  return authenticate(req, res, () => {
    const role = req.user?.role;
    const isAdmin = role === 'MUNICIPAL_ADMIN' || role === 'SUPER_ADMIN';

    if (!isAdmin) {
      throw new AppError(403, 'ADMIN_ONLY', 'Access denied. Admin privileges required.');
    }

    return next();
  });
};

module.exports = { requireAdmin };
