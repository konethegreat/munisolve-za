// ==========================================
// GEO ROUTES (no authentication required)
// ==========================================
//   GET /api/geo/search?q=&limit=   -> place autocomplete (Nominatim)
//   GET /api/geo/reverse?lat=&lon=  -> address for a point (Nominatim)
// Results include OpenStreetMap attribution and are cached server-side.
// ==========================================

const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validate');
const { geoSearchQuerySchema, geoReverseQuerySchema } = require('../schemas/geo');
const { search, reverse } = require('../controllers/geo.controller');

router.get('/search', validate({ query: geoSearchQuerySchema }), search);
router.get('/reverse', validate({ query: geoReverseQuerySchema }), reverse);

module.exports = router;
