// ==========================================
// REPORT ROUTES
// ==========================================
// Defines all report-related endpoints
// Author: MuniSolve ZA Development Team

const express = require('express');
const router = express.Router();

// Import controllers
const {
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
} = require('../controllers/report.controller');

// Import middleware
const { authenticate } = require('../middleware/auth.middleware');
const {
  validateReportCreation,
  validateIdParam,
  handleValidationErrors,
} = require('../middleware/validation.middleware');
const { reportCreationLimiter } = require('../middleware/rateLimit.middleware');

// ==========================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ==========================================
// Apply authentication to all report routes
router.use(authenticate);

// ==========================================
// REPORT ROUTES
// ==========================================

/**
 * @route   POST /api/reports
 * @desc    Create a new report
 * @access  Private (any authenticated user)
 * 
 * Request body:
 * {
 *   "title": "Large pothole on Main Road",
 *   "description": "Deep pothole causing damage to vehicles",
 *   "category": "POTHOLE",
 *   "municipality": "City of Johannesburg",
 *   "address": "Corner of Main Road and Church Street"
 * }
 */
router.post(
  '/',
  reportCreationLimiter,      // Rate limit: 10 reports per hour
  validateReportCreation,      // Validate input
  handleValidationErrors,      // Check validation results
  createReport                 // Controller function
);

/**
 * @route   GET /api/reports
 * @desc    Get all reports for current user
 * @access  Private
 * 
 * Query parameters (optional):
 * - status: PENDING, IN_PROGRESS, RESOLVED
 * - category: POTHOLE, WATER_LEAK, etc.
 * - municipality: City name
 * 
 * Example: GET /api/reports?status=PENDING&category=POTHOLE
 */
router.get(
  '/',
  getAllReports
);

/**
 * @route   GET /api/reports/:id
 * @desc    Get single report by ID
 * @access  Private (user can only view their own reports)
 * 
 * URL parameters:
 * - id: Report ID (number)
 * 
 * Example: GET /api/reports/1
 */
router.get(
  '/:id',
  validateIdParam,
  handleValidationErrors,
  getReportById
);

/**
 * @route   PUT /api/reports/:id
 * @desc    Update report
 * @access  Private (user can only update their own reports)
 * 
 * Request body (all optional):
 * {
 *   "title": "Updated title",
 *   "description": "Updated description",
 *   "category": "WATER_LEAK",
 *   "municipality": "City of Tshwane",
 *   "address": "New address"
 * }
 */
router.put(
  '/:id',
  validateIdParam,
  handleValidationErrors,
  updateReport
);

/**
 * @route   DELETE /api/reports/:id
 * @desc    Delete report
 * @access  Private (user can only delete their own reports)
 * 
 * Example: DELETE /api/reports/1
 */
router.delete(
  '/:id',
  validateIdParam,
  handleValidationErrors,
  deleteReport
);

// Export the router
module.exports = router;

// ==========================================
// TESTING THESE ROUTES
// ==========================================
/*

Make sure you have a valid JWT token from login/register.

1. CREATE REPORT:
curl -X POST http://localhost:5000/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Large pothole on Main Road",
    "description": "Deep pothole causing damage to vehicles near intersection",
    "category": "POTHOLE",
    "municipality": "City of Johannesburg",
    "address": "Corner of Main Road and Church Street"
  }'

2. GET ALL REPORTS:
curl http://localhost:5000/api/reports \
  -H "Authorization: Bearer YOUR_TOKEN"

3. GET SINGLE REPORT:
curl http://localhost:5000/api/reports/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

4. UPDATE REPORT:
curl -X PUT http://localhost:5000/api/reports/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Updated: Massive pothole",
    "description": "Situation has worsened"
  }'

5. DELETE REPORT:
curl -X DELETE http://localhost:5000/api/reports/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

*/
