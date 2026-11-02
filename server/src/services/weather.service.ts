// Open-Meteo current weather. Keyless and free; weather is a non-critical
// enhancement, so any failure returns null and report creation still succeeds.
import { logger } from '../logger';

const CACHE_TTL = 10 * 60 * 1000;
const CACHE_LIMIT = 200;

interface WeatherResult {
  weatherTemp: number | null;
  weatherCondition: string;
  weatherRainfall: number | null;
  weatherWind: number | null;
  weatherHumidity: number | null;
}

const weatherCache = new Map<string, { data: WeatherResult; timestamp: number }>();

const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export function describeWeather(code: number | null | undefined): string {
  if (code == null) return 'Unknown';
  return WMO_CONDITIONS[code] ?? `Weather code ${code}`;
}

function enabled() {
  return String(process.env.WEATHER_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function validCoordinate(value: number, limit: number) {
  return Number.isFinite(value) && Math.abs(value) <= limit;
}

function remember(key: string, data: WeatherResult, now: number) {
  if (weatherCache.size >= CACHE_LIMIT) {
    const oldest = weatherCache.keys().next().value;
    if (oldest !== undefined) weatherCache.delete(oldest);
  }
  weatherCache.set(key, { data, timestamp: now });
}

export async function getWeatherForLocation(latitude: number, longitude: number): Promise<WeatherResult | null> {
  try {
    if (!enabled()) return null;

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!validCoordinate(lat, 90) || !validCoordinate(lon, 180)) return null;

    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const now = Date.now();
    const cached = weatherCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL) return cached.data;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&wind_speed_unit=kmh&timezone=auto`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const data = await response.json() as { current?: Record<string, number | null> };
    if (!data.current) return null;

    const current = data.current;
    const result: WeatherResult = {
      weatherTemp: current.temperature_2m ?? null,
      weatherCondition: describeWeather(current.weather_code as number | null),
      weatherRainfall: current.precipitation ?? null,
      weatherWind: current.wind_speed_10m ?? null,
      weatherHumidity: current.relative_humidity_2m ?? null,
    };

    remember(cacheKey, result, now);
    return result;
  } catch (error) {
    logger.warn({ err: error }, 'Weather lookup failed');
    return null;
  }
}
