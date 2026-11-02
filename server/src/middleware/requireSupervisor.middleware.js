const { authenticate } = require('./auth.middleware');
const { AppError } = require('../errors/AppError');

const SUPERVISOR_ROLES = ['WORKER_SUPERVISOR', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN'];

const requireSupervisor = async (req, res, next) => {
  return authenticate(req, res, () => {
    const role = req.user?.role;
    if (!SUPERVISOR_ROLES.includes(role)) {
      throw new AppError(403, 'SUPERVISOR_ONLY', 'Access denied. Supervisor privileges required.');
    }
    return next();
  });
};

module.exports = { requireSupervisor };
