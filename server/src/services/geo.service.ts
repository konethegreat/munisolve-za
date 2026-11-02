// Nominatim proxy. Its usage policy requires an identifying User-Agent, at
// most one request per second, and OpenStreetMap attribution. Responses are
// cached for a day because addresses do not move.
import { logger } from '../logger';
import { AppError } from '../errors/AppError';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 500;
const MIN_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_USER_AGENT = 'MuniSolveZA/1.0 (+https://github.com/konethegreat/munisolve-za)';
export const ATTRIBUTION = '© OpenStreetMap contributors, ODbL';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

interface NominatimPlace {
  display_name?: string;
  lat?: string;
  lon?: string;
  category?: string;
  type?: string;
  boundingbox?: unknown[];
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface Place {
  displayName: string;
  latitude: number;
  longitude: number;
  category: string | null;
  type: string | null;
  boundingBox: number[] | null;
}

export interface ReversePlace {
  displayName: string;
  latitude: number;
  longitude: number;
  address: {
    houseNumber: string | null;
    road: string | null;
    suburb: string | null;
    city: string | null;
    municipality: string | null;
    state: string | null;
    postcode: string | null;
    country: string | null;
  };
  attribution: string;
}

const cache = new Map<string, CacheEntry>();
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function enabled() {
  return String(process.env.GEO_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function userAgent() {
  return process.env.GEO_USER_AGENT || DEFAULT_USER_AGENT;
}

function countryCodes() {
  return process.env.GEO_COUNTRY_CODES || 'za';
}

function validCoordinate(value: number, limit: number) {
  return Number.isFinite(value) && Math.abs(value) <= limit;
}

function remember(key: string, data: unknown, now: number) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: now });
}

// Serializes calls so at most one request per second reaches Nominatim even
// when several users search at once.
function scheduled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function requestJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': userAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn({ err: error }, 'Nominatim request failed');
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', 'Location service unavailable');
  }

  if (!response.ok) {
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', 'Location service unavailable');
  }

  try {
    return await response.json();
  } catch (error) {
    logger.warn({ err: error }, 'Nominatim returned invalid JSON');
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', 'Location service unavailable');
  }
}

function mapPlace(row: NominatimPlace): Place {
  return {
    displayName: row.display_name ?? '',
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    category: row.category ?? null,
    type: row.type ?? null,
    boundingBox: Array.isArray(row.boundingbox) && row.boundingbox.length === 4
      ? row.boundingbox.map(Number)
      : null,
  };
}

export async function searchPlaces(query: string, options: { limit?: number } = {}) {
  if (!enabled()) {
    throw new AppError(503, 'GEO_DISABLED', 'Location search is disabled');
  }

  const q = String(query ?? '').trim();
  if (q.length < 2 || q.length > 200) {
    throw new AppError(400, 'INVALID_QUERY', 'Search text must be between 2 and 200 characters.');
  }

  const limit = Math.min(Math.max(Number(options.limit) || 5, 1), 10);
  const key = `search:${countryCodes()}:${limit}:${q.toLowerCase()}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return { data: cached.data as { results: Place[]; attribution: string }, cached: true };
  }

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: String(limit),
    countrycodes: countryCodes(),
    'accept-language': 'en',
  });

  const rows = await scheduled(() => requestJson(`${NOMINATIM_BASE}/search?${params}`));
  const data = {
    results: Array.isArray(rows) ? (rows as NominatimPlace[]).map(mapPlace) : [],
    attribution: ATTRIBUTION,
  };

  remember(key, data, Date.now());
  return { data, cached: false };
}

export async function reversePlace(latitude: number, longitude: number) {
  if (!enabled()) {
    throw new AppError(503, 'GEO_DISABLED', 'Reverse geocoding is disabled');
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!validCoordinate(lat, 90) || !validCoordinate(lon, 180)) {
    throw new AppError(400, 'INVALID_COORDINATES', 'Latitude must be -90 to 90 and longitude -180 to 180.');
  }

  const key = `reverse:${lat.toFixed(4)},${lon.toFixed(4)}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return { data: cached.data as ReversePlace, cached: true };
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    'accept-language': 'en',
  });

  const row = await scheduled(() => requestJson(`${NOMINATIM_BASE}/reverse?${params}`)) as {
    address?: NominatimAddress;
    display_name?: string;
    lat?: string;
    lon?: string;
  };
  const address = row?.address ?? {};

  const data: ReversePlace = {
    displayName: row?.display_name ?? '',
    latitude: Number(row?.lat ?? lat),
    longitude: Number(row?.lon ?? lon),
    address: {
      houseNumber: address.house_number ?? null,
      road: address.road ?? null,
      suburb: address.suburb ?? address.neighbourhood ?? null,
      city: address.city ?? address.town ?? address.village ?? null,
      municipality: address.municipality ?? null,
      state: address.state ?? null,
      postcode: address.postcode ?? null,
      country: address.country ?? null,
    },
    attribution: ATTRIBUTION,
  };

  remember(key, data, Date.now());
  return { data, cached: false };
}
