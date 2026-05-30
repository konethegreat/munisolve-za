// ==========================================
// PUBLIC CONTROLLER
// ==========================================
// Keyless, no-auth endpoints that power public-facing widgets:
//   - Community statistics (aggregate report data, no PII)
//   - Live air quality (Open-Meteo Air Quality API)
//   - South African public holidays (Nager.Date API)
// All external APIs used here are free and require no API key.
// ==========================================

const prisma = require('../config/db.config');

// Simple in-memory caches (avoids hammering free APIs)
const cache = {
  stats: { data: null, ts: 0 },
  holidays: { data: null, ts: 0, year: null },
  airQuality: {}, // keyed by "lat,lon"
};

const STATS_TTL = 60 * 1000; // 1 minute
const HOLIDAYS_TTL = 24 * 60 * 60 * 1000; // 1 day
const AIR_TTL = 30 * 60 * 1000; // 30 minutes

// ==========================================
// GET /api/public/stats
// Aggregate, anonymised platform statistics.
// ==========================================
const getStats = async (req, res) => {
  try {
    const now = Date.now();
    if (cache.stats.data && now - cache.stats.ts < STATS_TTL) {
      return res.status(200).json({ success: true, data: cache.stats.data, cached: true });
    }

    const [total, pending, inProgress, resolved, rejected, byCategory, byMunicipality] =
      await Promise.all([
        prisma.report.count(),
        prisma.report.count({ where: { status: 'PENDING' } }),
        prisma.report.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.report.count({ where: { status: 'RESOLVED' } }),
        prisma.report.count({ where: { status: 'REJECTED' } }),
        prisma.report.groupBy({ by: ['category'], _count: { category: true } }),
        prisma.report.groupBy({ by: ['municipality'], _count: { municipality: true } }),
      ]);

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const data = {
      totalReports: total,
      pending,
      inProgress,
      resolved,
      rejected,
      resolutionRate,
      municipalitiesServed: byMunicipality.length,
      categories: byCategory
        .map((c) => ({ category: c.category, count: c._count.category }))
        .sort((a, b) => b.count - a.count),
      topMunicipalities: byMunicipality
        .map((m) => ({ municipality: m.municipality, count: m._count.municipality }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      updatedAt: new Date().toISOString(),
    };

    cache.stats = { data, ts: now };
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[PUBLIC] Stats error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load statistics' });
  }
};

// ==========================================
// GET /api/public/air-quality?lat=&lon=
// Live air quality via Open-Meteo (keyless).
// ==========================================
const AQI_BANDS = [
  { max: 20, label: 'Good', color: '#16a34a' },
  { max: 40, label: 'Fair', color: '#65a30d' },
  { max: 60, label: 'Moderate', color: '#ca8a04' },
  { max: 80, label: 'Poor', color: '#ea580c' },
  { max: 100, label: 'Very Poor', color: '#dc2626' },
  { max: Infinity, label: 'Extremely Poor', color: '#7e22ce' },
];

function describeAqi(aqi) {
  if (aqi == null) return { label: 'Unknown', color: '#6b7280' };
  return AQI_BANDS.find((b) => aqi <= b.max) || AQI_BANDS[AQI_BANDS.length - 1];
}

const getAirQuality = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lon are required' });
    }

    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const now = Date.now();
    const cached = cache.airQuality[key];
    if (cached && now - cached.ts < AIR_TTL) {
      return res.status(200).json({ success: true, data: cached.data, cached: true });
    }

    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'Air quality service unavailable' });
    }
    const json = await response.json();
    const c = json.current || {};
    const band = describeAqi(c.european_aqi);

    const data = {
      europeanAqi: c.european_aqi ?? null,
      usAqi: c.us_aqi ?? null,
      pm25: c.pm2_5 ?? null,
      pm10: c.pm10 ?? null,
      no2: c.nitrogen_dioxide ?? null,
      ozone: c.ozone ?? null,
      label: band.label,
      color: band.color,
      updatedAt: c.time || new Date().toISOString(),
    };

    cache.airQuality[key] = { data, ts: now };
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[PUBLIC] Air quality error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load air quality' });
  }
};

// ==========================================
// GET /api/public/holidays
// South African public holidays via Nager.Date (keyless).
// ==========================================
const getHolidays = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const now = Date.now();
    if (cache.holidays.data && cache.holidays.year === year && now - cache.holidays.ts < HOLIDAYS_TTL) {
      return res.status(200).json({ success: true, data: cache.holidays.data, cached: true });
    }

    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ZA`);
    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'Holiday service unavailable' });
    }
    const holidays = await response.json();

    const today = new Date().toISOString().slice(0, 10);
    const todaysHoliday = holidays.find((h) => h.date === today) || null;
    const upcoming = holidays
      .filter((h) => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const nextHoliday = upcoming[0] || null;

    const data = {
      year,
      isPublicHolidayToday: Boolean(todaysHoliday),
      todaysHoliday: todaysHoliday ? { name: todaysHoliday.localName, date: todaysHoliday.date } : null,
      nextHoliday: nextHoliday
        ? {
            name: nextHoliday.localName,
            date: nextHoliday.date,
            daysUntil: Math.ceil((new Date(nextHoliday.date) - new Date(today)) / 86400000),
          }
        : null,
      all: holidays.map((h) => ({ name: h.localName, date: h.date })),
    };

    cache.holidays = { data, ts: now, year };
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[PUBLIC] Holidays error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load holidays' });
  }
};

module.exports = { getStats, getAirQuality, getHolidays };
