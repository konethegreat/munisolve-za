import React, { useState } from 'react';

const WeatherBadge = ({ 
  weatherCondition, 
  weatherTemp, 
  weatherRainfall, 
  weatherWind, 
  weatherHumidity 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Return null if all weather data is missing
  if (!weatherCondition && !weatherTemp && !weatherRainfall && !weatherWind && !weatherHumidity) {
    return null;
  }

  // Get weather emoji based on condition
  const getWeatherEmoji = (condition) => {
    switch (condition) {
      case "Clear Sky":
        return "☀️";
      case "Partly Cloudy":
        return "⛅";
      case "Foggy":
        return "🌫️";
      case "Drizzle":
        return "🌦️";
      case "Rainy":
      case "Rain Showers":
        return "🌧️";
      case "Snowy":
        return "❄️";
      case "Thunderstorm":
        return "⛈️";
      case "Thunderstorm with Hail":
        return "⛈️";
      default:
        return "🌤️";
    }
  };

  // Determine background color based on rainfall
  const getBadgeStyles = () => {
    if (weatherRainfall > 20) {
      return {
        backgroundColor: '#fee2e2',
        color: '#dc2626',
        border: '1px solid #fca5a5'
      };
    } else if (weatherRainfall > 10) {
      return {
        backgroundColor: '#fef9c3',
        color: '#ca8a04',
        border: '1px solid #fde047'
      };
    } else {
      return {
        backgroundColor: '#e0f2fe',
        color: '#0369a1',
        border: '1px solid #7dd3fc'
      };
    }
  };

  const weatherEmoji = getWeatherEmoji(weatherCondition);
  const badgeStyles = getBadgeStyles();
  const hasHeavyRain = weatherRainfall > 20;

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Main badge */}
      <div 
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-all hover:shadow-md"
        style={badgeStyles}
      >
        <span className="text-base">
          {hasHeavyRain && "⚠️"}
          {weatherEmoji}
        </span>
        {weatherTemp !== null && weatherTemp !== undefined && (
          <span>{Math.round(weatherTemp)}°C</span>
        )}
        {weatherCondition && (
          <span>{weatherCondition}</span>
        )}
      </div>

      {/* Hover tooltip with details */}
      {showDetails && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[200px]">
          <div className="space-y-1 text-sm">
            {weatherRainfall !== null && weatherRainfall !== undefined && (
              <div className="flex items-center gap-2">
                <span>🌧️</span>
                <span>Rainfall: {weatherRainfall}mm</span>
              </div>
            )}
            {weatherWind !== null && weatherWind !== undefined && (
              <div className="flex items-center gap-2">
                <span>💨</span>
                <span>Wind: {weatherWind} km/h</span>
              </div>
            )}
            {weatherHumidity !== null && weatherHumidity !== undefined && (
              <div className="flex items-center gap-2">
                <span>💧</span>
                <span>Humidity: {weatherHumidity}%</span>
              </div>
            )}
          </div>
          
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-white border-r border-b border-gray-200 transform rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherBadge;
