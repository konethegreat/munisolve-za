// ==========================================
// WEATHER SERVICE
// ==========================================
// Fetches current weather for a report location via WeatherAPI.
// Weather is a non-critical enhancement: any failure returns null
// so report creation always succeeds.
// ==========================================

const weatherCache = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const getWeatherForLocation = async (latitude, longitude) => {
  try {
    if (!process.env.WEATHER_API_KEY) return null;
    if (!latitude || !longitude) return null;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;

    const now = Date.now();
    const cached = weatherCache[cacheKey];
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const url = `http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.current) return null;

    const current = data.current;
    const result = {
      weatherTemp: current.temp_c,
      weatherCondition: current.condition.text,
      weatherRainfall: current.precip_mm,
      weatherWind: current.wind_kph,
      weatherHumidity: current.humidity,
    };

    weatherCache[cacheKey] = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.error('[WEATHER] Error:', error.message);
    return null; // Weather is non-critical
  }
};

module.exports = { getWeatherForLocation };
