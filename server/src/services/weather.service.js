console.log('[WEATHER] API KEY:', process.env.WEATHER_API_KEY ? 'LOADED' : 'MISSING')
const weatherCache = {};

const getWeatherForLocation = async (latitude, longitude) => {
  try {
    if (!process.env.WEATHER_API_KEY) {
      console.log('[WEATHER] No API key set, skipping');
      return null;
    }

    if (!latitude || !longitude) {
      return null;
    }

    // Round coordinates to 2 decimal places for cache key
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    
    // Check cache (10 minute expiry)
    const now = Date.now();
    const cached = weatherCache[cacheKey];
    if (cached && (now - cached.timestamp) < 10 * 60 * 1000) {
      console.log('[WEATHER] Cache hit for:', cacheKey);
      return cached.data;
    }

    console.log('[WEATHER] Fetching for:', latitude, longitude);

    const url = `http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
    
    const response = await fetch(url);
    
    console.log('[WEATHER] Response status:', response.status);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    console.log('[WEATHER] Raw data:', JSON.stringify(data));
    
    if (!data.current) {
      return null;
    }

    const current = data.current;
    
    const result = {
      weatherTemp: current.temp_c,
      weatherCondition: current.condition.text,
      weatherRainfall: current.precip_mm,
      weatherWind: current.wind_kph,
      weatherHumidity: current.humidity
    };
    
    // Cache the successful result
    weatherCache[cacheKey] = {
      data: result,
      timestamp: now
    };
    
    console.log('[WEATHER] Result:', result);
    
    return result;
  } catch (error) {
    console.log('[WEATHER] Error:', error);
    // Weather is non-critical, so we return null on any error
    return null;
  }
};

module.exports = { getWeatherForLocation };
