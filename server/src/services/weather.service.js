const weatherCache = {};

const getWeatherCondition = (weatherCode) => {
  switch (weatherCode) {
    case 0:
      return "Clear Sky";
    case 1:
    case 2:
    case 3:
      return "Partly Cloudy";
    case 45:
    case 48:
      return "Foggy";
    case 51:
    case 53:
    case 55:
      return "Drizzle";
    case 61:
    case 63:
    case 65:
      return "Rainy";
    case 71:
    case 73:
    case 75:
      return "Snowy";
    case 80:
    case 81:
    case 82:
      return "Rain Showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorm with Hail";
    default:
      return "Cloudy";
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getWeatherForLocation = async (latitude, longitude) => {
  try {
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

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=Africa/Johannesburg`;
    
    const headers = {
      'User-Agent': 'MuniSolveZA/1.0 (erictshivhinda@gmail.com)',
      'Accept': 'application/json'
    };

    let response;
    let attempts = 0;
    const maxAttempts = 3;
    const delays = [0, 2000, 3000]; // delays between attempts

    while (attempts < maxAttempts) {
      try {
        response = await fetch(url, { headers });
        console.log('[WEATHER] Response status:', response.status);
        
        if (response.status === 429) {
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`[WEATHER] Rate limited, attempt ${attempts}/${maxAttempts}, waiting ${delays[attempts]}ms`);
            await sleep(delays[attempts]);
            continue;
          }
          console.log('[WEATHER] Rate limited, skipping');
          return null;
        }
        
        break; // Success or non-429 error, exit retry loop
      } catch (fetchError) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`[WEATHER] Fetch error, attempt ${attempts}/${maxAttempts}, waiting ${delays[attempts]}ms:`, fetchError.message);
          await sleep(delays[attempts]);
          continue;
        }
        throw fetchError; // Re-throw after max attempts
      }
    }

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
      weatherTemp: current.temperature_2m,
      weatherCondition: getWeatherCondition(current.weather_code),
      weatherRainfall: current.precipitation,
      weatherWind: current.wind_speed_10m,
      weatherHumidity: current.relative_humidity_2m
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
