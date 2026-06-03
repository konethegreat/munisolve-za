const { authenticate } = require('./auth.middleware');

const SUPERVISOR_ROLES = ['WORKER_SUPERVISOR', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN'];

const requireSupervisor = async (req, res, next) => {
  return authenticate(req, res, () => {
    try {
      const role = req.user?.role;
      if (!SUPERVISOR_ROLES.includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Supervisor privileges required.',
          errorCode: 'SUPERVISOR_ONLY',
        });
      }
      return next();
    } catch (error) {
      console.error('[REQUIRE_SUPERVISOR ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error.',
        errorCode: 'AUTHZ_ERROR',
      });
    }
  });
};

module.exports = { requireSupervisor };
