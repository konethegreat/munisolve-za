import type { RequestHandler } from 'express';
import { searchPlaces, reversePlace } from '../services/geo.service';

export const search: RequestHandler = async (req, res) => {
  const { q, limit } = req.validated.query;
  const { data, cached } = await searchPlaces(q, { limit });
  res.status(200).json({ success: true, data: data.results, count: data.results.length, attribution: data.attribution, cached });
};

export const reverse: RequestHandler = async (req, res) => {
  const { lat, lon } = req.validated.query;
  const { data, cached } = await reversePlace(lat, lon);
  res.status(200).json({ success: true, data, attribution: data.attribution, cached });
};
