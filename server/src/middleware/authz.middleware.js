// ==========================================
// AUTHORIZATION MIDDLEWARE (RBAC)
// ==========================================
// Role-Based Access Control for MuniSolve ZA
// This middleware controls WHAT authenticated users can do
// Must be used AFTER authenticate middleware
// Author: MuniSolve ZA Security Team
// Last Updated: February 2026

/**
 * ==========================================
 * UNDERSTANDING AUTHENTICATION vs AUTHORIZATION
 * ==========================================
 * 
 * AUTHENTICATION (auth.middleware.js):
 * - "Who are you?"
 * - Verifies user identity using JWT tokens
 * - Confirms: "You are John Doe, a valid user"
 * 
 * AUTHORIZATION (this file):
 * - "What are you allowed to do?"
 * - Checks user permissions based on role
 * - Confirms: "You are a CITIZEN, so you can create reports but not assign them"
 * 
 * WORKFLOW:
 * Request → authenticate (verify identity) → authorize (check permissions) → route handler
 */

/**
 * ==========================================
 * ROLE HIERARCHY IN MUNISOLVE ZA
 * ==========================================
 * 
 * 1. CITIZEN (lowest privileges)
 *    - Can: Create reports, view own reports, update own profile
 *    - Cannot: Assign reports, change report status, access admin dashboard
 * 
 * 2. MUNICIPAL_ADMIN (municipal officials)
 *    - Can: Everything CITIZEN can do, PLUS:
 *      - View all reports in their municipality
 *      - Assign reports to themselves or other officials
 *      - Update report status (Pending → In Progress → Resolved)
 *      - Add resolution notes
 *    - Cannot: Access super admin functions, manage other municipalities
 * 
 * 3. SUPER_ADMIN (system administrators)
 *    - Can: Everything MUNICIPAL_ADMIN can do, PLUS:
 *      - Manage all municipalities
 *      - Create/delete user accounts
 *      - View system-wide analytics
 *      - Access audit logs
 *      - Change any user's role
 *    - Responsibility: System-wide control, use with caution!
 */

/**
 * ==========================================
 * AUTHORIZATION MIDDLEWARE FACTORY
 * ==========================================
 * Purpose: Create middleware that checks if user has required role(s)
 * This is a "factory function" that returns middleware
 * 
 * Why factory pattern?
 * - Allows flexible role checking: authorize(['CITIZEN', 'MUNICIPAL_ADMIN'])
 * - Reusable: Create different authorization checks for different routes
 * - Clean: authorize(['SUPER_ADMIN']) is more readable than separate functions
 * 
 * @param {Array<string>} allowedRoles - Array of roles that can access the route
 * @returns {Function} Express middleware function
 * 
 * USAGE EXAMPLE:
 * router.post('/reports', 
 *   authenticate,                              // Step 1: Verify user identity
 *   authorize(['CITIZEN', 'MUNICIPAL_ADMIN']), // Step 2: Check if role is allowed
 *   createReport                               // Step 3: Execute route handler
 * );
 */
const authorize = (allowedRoles = []) => {
  // Return the actual middleware function
  // This function will be called when the route is accessed
  return (req, res, next) => {
    try {
      // STEP 1: Verify that user is authenticated
      // The authenticate middleware should run before this
      // It attaches the user object to req.user
      if (!req.user) {
        // User object doesn't exist = authenticate middleware didn't run
        // OR user is not authenticated
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please log in.',
          errorCode: 'NOT_AUTHENTICATED',
          // Helpful hint for developers
          hint: 'Ensure authenticate middleware runs before authorize'
        });
      }
      
      // STEP 2: Verify that user has a role
      // Defensive programming: ensure role field exists
      if (!req.user.role) {
        // User exists but has no role (database integrity issue)
        console.error(`[AUTHZ ERROR] User ${req.user.id} has no role assigned`);
        return res.status(403).json({
          success: false,
          message: 'User role not assigned. Contact system administrator.',
          errorCode: 'NO_ROLE_ASSIGNED'
        });
      }
      
      // STEP 3: Check if allowedRoles array is valid
      // Ensure developers passed a valid array
      if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        // Developer error: authorize() called without specifying roles
        console.error('[AUTHZ ERROR] No allowed roles specified for this route');
        return res.status(500).json({
          success: false,
          message: 'Authorization configuration error.',
          errorCode: 'INVALID_AUTH_CONFIG',
          // Only show in development
          ...(process.env.NODE_ENV === 'development' && {
            debug: 'allowedRoles must be a non-empty array'
          })
        });
      }
      
      // STEP 4: Check if user's role is in the allowed roles
      // Case-insensitive comparison for flexibility
      const userRole = req.user.role.toUpperCase();
      const isAuthorized = allowedRoles
        .map(role => role.toUpperCase()) // Convert all to uppercase
        .includes(userRole); // Check if user's role is in the list
      
      // STEP 5: Grant or deny access
      if (!isAuthorized) {
        // User is authenticated but doesn't have permission
        // This is a 403 Forbidden (not 401 Unauthorized)
        console.warn(
          `[AUTHZ] Access denied: User ${req.user.email} (${req.user.role}) ` +
          `attempted to access route requiring: ${allowedRoles.join(', ')}`
        );
        
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          errorCode: 'INSUFFICIENT_PERMISSIONS',
          required: allowedRoles,
          current: req.user.role,
          // Helpful message based on role
          hint: getRoleHint(req.user.role, allowedRoles)
        });
      }
      
      // STEP 6: Authorization successful!
      // User has the required role, allow request to proceed
      console.log(
        `[AUTHZ] Access granted: ${req.user.email} (${req.user.role}) ` +
        `to ${req.method} ${req.path}`
      );
      
      // Continue to next middleware or route handler
      next();
      
    } catch (error) {
      // Catch unexpected errors during authorization
      console.error('[AUTHZ ERROR]', error);
      
      return res.status(500).json({
        success: false,
        message: 'Authorization error. Please try again.',
        errorCode: 'AUTHZ_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
          debug: error.message
        })
      });
    }
  };
};

/**
 * ==========================================
 * HELPER: Generate Helpful Error Messages
 * ==========================================
 * Purpose: Provide context-aware hints when access is denied
 * This improves user experience and debugging
 * 
 * @param {string} userRole - User's current role
 * @param {Array<string>} requiredRoles - Roles needed for access
 * @returns {string} Helpful hint message
 */
const getRoleHint = (userRole, requiredRoles) => {
  // Convert to uppercase for comparison
  const role = userRole.toUpperCase();
  const required = requiredRoles.map(r => r.toUpperCase());
  
  // Provide specific hints based on the situation
  if (role === 'CITIZEN' && required.includes('MUNICIPAL_ADMIN')) {
    return 'This action requires municipal official privileges. Contact your local municipality.';
  }
  
  if (role === 'CITIZEN' && required.includes('SUPER_ADMIN')) {
    return 'This action requires system administrator privileges.';
  }
  
  if (role === 'MUNICIPAL_ADMIN' && required.includes('SUPER_ADMIN')) {
    return 'This action requires system administrator privileges. Contact MuniSolve support.';
  }
  
  // Generic hint
  return `Your current role (${userRole}) does not have access. Required: ${requiredRoles.join(' or ')}.`;
};

/**
 * ==========================================
 * RESOURCE-BASED AUTHORIZATION
 * ==========================================
 * Purpose: Check if user can access a specific resource
 * Example: Can this user edit THIS specific report?
 * 
 * Rules:
 * - CITIZENS can only edit their own reports
 * - MUNICIPAL_ADMINS can edit any report in their municipality
 * - SUPER_ADMINS can edit any report
 * 
 * @param {string} resourceType - Type of resource (e.g., 'Report', 'User')
 * @returns {Function} Middleware function
 */
const authorizeResource = (resourceType) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
          errorCode: 'NOT_AUTHENTICATED'
        });
      }
      
      // Get resource ID from request parameters
      // Assuming route is like: /reports/:id
      const resourceId = req.params.id;
      
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID not provided.',
          errorCode: 'MISSING_RESOURCE_ID'
        });
      }
      
      // SUPER_ADMIN has access to everything
      if (req.user.role === 'SUPER_ADMIN') {
        console.log(`[RESOURCE_AUTHZ] SUPER_ADMIN granted access to ${resourceType} ${resourceId}`);
        return next();
      }
      
      // Resource-specific authorization logic
      // This is a simplified version - expand based on your needs
      if (resourceType === 'Report') {
        // For reports, we need to check:
        // 1. CITIZEN: Can only access their own reports
        // 2. MUNICIPAL_ADMIN: Can access reports in their municipality
        
        // This would typically involve a database query
        // For now, we'll attach the resource check to the route handler
        // The route handler should implement the actual permission check
        
        // Store resource info for route handler to use
        req.resourceType = resourceType;
        req.resourceId = resourceId;
        
        return next();
      }
      
      // If resource type not recognized
      return res.status(500).json({
        success: false,
        message: 'Unknown resource type.',
        errorCode: 'UNKNOWN_RESOURCE_TYPE'
      });
      
    } catch (error) {
      console.error('[RESOURCE_AUTHZ ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Resource authorization error.',
        errorCode: 'RESOURCE_AUTHZ_ERROR'
      });
    }
  };
};

/**
 * ==========================================
 * MUNICIPALITY-SPECIFIC AUTHORIZATION
 * ==========================================
 * Purpose: Ensure municipal admins only access their municipality's data
 * 
 * Context: A municipal admin from Johannesburg should NOT see
 *          reports from Cape Town
 * 
 * @param {Function} getMunicipalityId - Function to extract municipality ID from request
 * @returns {Function} Middleware function
 */
const authorizeMunicipality = (getMunicipalityId) => {
  return async (req, res, next) => {
    try {
      // SUPER_ADMIN bypasses municipality restrictions
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }
      
      // CITIZENS don't have municipality restrictions (they report to any)
      if (req.user.role === 'CITIZEN') {
        return next();
      }
      
      // For MUNICIPAL_ADMIN, check municipality access
      if (req.user.role === 'MUNICIPAL_ADMIN') {
        // Get the municipality ID from the request
        // This function is provided when creating the middleware
        const requestedMunicipalityId = getMunicipalityId(req);
        
        // In a real implementation, we'd check user's assigned municipality
        // For now, this is a placeholder
        // You would fetch this from user.municipality in the database
        
        // Example check:
        // if (req.user.municipalityId !== requestedMunicipalityId) {
        //   return res.status(403).json({
        //     success: false,
        //     message: 'Access denied. You can only manage your own municipality.',
        //     errorCode: 'WRONG_MUNICIPALITY'
        //   });
        // }
        
        return next();
      }
      
      // Unknown role
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
        errorCode: 'AUTHZ_FAILED'
      });
      
    } catch (error) {
      console.error('[MUNICIPALITY_AUTHZ ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Municipality authorization error.',
        errorCode: 'MUNICIPALITY_AUTHZ_ERROR'
      });
    }
  };
};

// ==========================================
// CONVENIENCE MIDDLEWARE (Predefined Role Checks)
// ==========================================
// These are commonly-used authorization patterns
// Saves developers from writing authorize(['ROLE']) every time

/**
 * Only citizens can access
 * Use case: Citizen-specific features like "My Reports"
 */
const citizenOnly = authorize(['CITIZEN']);

/**
 * Only municipal officials can access
 * Use case: Admin dashboard, report management
 */
const adminOnly = authorize(['MUNICIPAL_ADMIN', 'SUPER_ADMIN']);

/**
 * Only super administrators can access
 * Use case: System settings, user management, audit logs
 */
const superAdminOnly = authorize(['SUPER_ADMIN']);

/**
 * Citizens and municipal admins can access
 * Use case: Creating reports (both can create)
 */
const citizenOrAdmin = authorize(['CITIZEN', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN']);

// ==========================================
// EXPORT ALL AUTHORIZATION FUNCTIONS
// ==========================================
module.exports = {
  // Main authorization function
  authorize,
  
  // Resource-based authorization
  authorizeResource,
  authorizeMunicipality,
  
  // Convenience middleware
  citizenOnly,
  adminOnly,
  superAdminOnly,
  citizenOrAdmin,
  
  // Helper function (exported for testing)
  getRoleHint
};

// ==========================================
// USAGE EXAMPLES
// ==========================================
/*

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, adminOnly, citizenOnly } = require('../middleware/authz.middleware');

// Example 1: Only municipal admins and super admins can access
router.get('/admin/dashboard', 
  authenticate,           // Step 1: Verify user is logged in
  adminOnly,             // Step 2: Check if user is admin
  getDashboard           // Step 3: Execute route handler
);

// Example 2: Only citizens can access (view their own reports)
router.get('/my-reports',
  authenticate,
  citizenOnly,
  getMyReports
);

// Example 3: Custom role combination
router.post('/reports',
  authenticate,
  authorize(['CITIZEN', 'MUNICIPAL_ADMIN']), // Citizens and admins can create
  createReport
);

// Example 4: Super admin only
router.delete('/users/:id',
  authenticate,
  authorize(['SUPER_ADMIN']), // Only super admins can delete users
  deleteUser
);

// Example 5: Resource-specific authorization
router.put('/reports/:id',
  authenticate,
  authorizeResource('Report'), // Check if user can edit THIS report
  updateReport
);

*/

// ==========================================
// SECURITY BEST PRACTICES
// ==========================================
/*

1. ALWAYS use authenticate before authorize
   ❌ BAD:  router.get('/admin', adminOnly, handler);
   ✅ GOOD: router.get('/admin', authenticate, adminOnly, handler);

2. Use specific role checks, not blanket permissions
   ❌ BAD:  if (req.user) { // Any logged-in user }
   ✅ GOOD: authorize(['MUNICIPAL_ADMIN']) // Specific role

3. Implement principle of least privilege
   - Give users minimum permissions needed
   - Don't make everyone SUPER_ADMIN

4. Log authorization failures for security auditing
   - Track who tried to access what
   - Detect potential attacks or misuse

5. Keep authorization logic in middleware, not route handlers
   - Centralized security is easier to maintain
   - Prevents forgetting to add checks

6. Test authorization thoroughly
   - Try accessing routes with different roles
   - Ensure proper error messages
   - Verify logs are created

*/