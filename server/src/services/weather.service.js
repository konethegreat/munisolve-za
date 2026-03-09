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

const getWeatherForLocation = async (latitude, longitude) => {
  try {
    if (!latitude || !longitude) {
      return null;
    }

    console.log('[WEATHER] Fetching for:', latitude, longitude);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=Africa/Johannesburg`;
    
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
      weatherTemp: current.temperature_2m,
      weatherCondition: getWeatherCondition(current.weather_code),
      weatherRainfall: current.precipitation,
      weatherWind: current.wind_speed_10m,
      weatherHumidity: current.relative_humidity_2m
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
