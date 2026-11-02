import express from 'express';
import { validate } from '../middleware/validate';
import { geoSearchQuerySchema, geoReverseQuerySchema } from '../schemas/geo';
import { search, reverse } from '../controllers/geo.controller';

const router = express.Router();

router.get('/search', validate({ query: geoSearchQuerySchema }), search);
router.get('/reverse', validate({ query: geoReverseQuerySchema }), reverse);

export = router;
