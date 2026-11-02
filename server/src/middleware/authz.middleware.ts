import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

// Role-based access control. Always mount authenticate before these guards.
const authorize = (allowedRoles: string[] = []): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) throw new AppError(401, 'NOT_AUTHENTICATED', 'Authentication required. Please log in.');
    if (!req.user.role) throw new AppError(403, 'NO_ROLE_ASSIGNED', 'User role not assigned. Contact system administrator.');
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      throw new AppError(500, 'INVALID_AUTH_CONFIG', 'Authorization configuration error.');
    }

    const userRole = req.user.role.toUpperCase();
    const isAuthorized = allowedRoles.map((role) => role.toUpperCase()).includes(userRole);
    if (!isAuthorized) throw new AppError(403, 'INSUFFICIENT_PERMISSIONS', 'Access denied. Insufficient permissions.');

    next();
  };
};

const getRoleHint = (userRole: string, requiredRoles: string[]): string => {
  const role = userRole.toUpperCase();
  const required = requiredRoles.map((r) => r.toUpperCase());

  if (role === 'CITIZEN' && required.includes('MUNICIPAL_ADMIN')) {
    return 'This action requires municipal official privileges. Contact your local municipality.';
  }
  if (role === 'CITIZEN' && required.includes('SUPER_ADMIN')) {
    return 'This action requires system administrator privileges.';
  }
  if (role === 'MUNICIPAL_ADMIN' && required.includes('SUPER_ADMIN')) {
    return 'This action requires system administrator privileges. Contact MuniSolve support.';
  }
  return `Your current role (${userRole}) does not have access. Required: ${requiredRoles.join(' or ')}.`;
};

const authorizeResource = (resourceType: string): RequestHandler => {
  return (req: Request, _res, next) => {
    if (!req.user) throw new AppError(401, 'NOT_AUTHENTICATED', 'Authentication required.');

    const resourceId = String(req.params.id ?? '');
    if (!resourceId) throw new AppError(400, 'MISSING_RESOURCE_ID', 'Resource ID not provided.');
    if (req.user.role === 'SUPER_ADMIN') return next();

    if (resourceType === 'Report') {
      req.resourceType = resourceType;
      req.resourceId = resourceId;
      return next();
    }

    throw new AppError(500, 'UNKNOWN_RESOURCE_TYPE', 'Unknown resource type.');
  };
};

const authorizeMunicipality = (getMunicipalityId: (req: Request) => unknown): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) throw new AppError(401, 'NOT_AUTHENTICATED', 'Authentication required.');
    if (req.user.role === 'SUPER_ADMIN') return next();
    if (req.user.role === 'CITIZEN') return next();
    if (req.user.role === 'MUNICIPAL_ADMIN') {
      getMunicipalityId(req);
      return next();
    }
    throw new AppError(403, 'AUTHZ_FAILED', 'Access denied.');
  };
};

const citizenOnly = authorize(['CITIZEN']);
const adminOnly = authorize(['MUNICIPAL_ADMIN', 'SUPER_ADMIN']);
const superAdminOnly = authorize(['SUPER_ADMIN']);
const citizenOrAdmin = authorize(['CITIZEN', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN']);

export {
  authorize,
  authorizeResource,
  authorizeMunicipality,
  citizenOnly,
  adminOnly,
  superAdminOnly,
  citizenOrAdmin,
  getRoleHint,
};
