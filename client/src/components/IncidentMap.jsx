// ==========================================
// INCIDENT MAP - Reports on Leaflet map
// ==========================================
import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WeatherBadge from './WeatherBadge';

// Fix default Leaflet marker icon broken image (webpack/vite path issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const JOHANNESBURG_CENTER = [-26.2041, 28.0473];
const DEFAULT_ZOOM = 11;

const STATUS_COLORS = {
  OPEN: '#ef4444',
  PENDING: '#ef4444',
  IN_PROGRESS: '#f97316',
  RESOLVED: '#22c55e',
};

function getStatusColor(status) {
  return STATUS_COLORS[status] || '#6b7280';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getWeatherEmoji(condition) {
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
}

function MapLegend() {
  return (
    <div
      className="leaflet-legend"
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        background: 'white',
        padding: '8px 12px',
        borderRadius: 8,
        boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Status</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
        <span>Open / Pending</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
        <span>In Progress</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
        <span>Resolved</span>
      </div>
    </div>
  );
}

export default function IncidentMap({ reports = [] }) {
  const reportsWithCoords = useMemo(
    () =>
      reports.filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          Number.isFinite(Number(r.latitude)) &&
          Number.isFinite(Number(r.longitude))
      ),
    [reports]
  );

  return (
    <div className="relative w-full" style={{ height: 350 }}>
      <MapContainer
        center={JOHANNESBURG_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full rounded-lg"
        style={{ height: 350 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {reportsWithCoords.map((report) => (
          <CircleMarker
            key={report.id}
            center={[Number(report.latitude), Number(report.longitude)]}
            pathOptions={{
              color: getStatusColor(report.status),
              fillColor: getStatusColor(report.status),
              fillOpacity: 0.8,
              weight: 2,
              radius: 8,
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {report.title}
                  {report.category && (
                    <span style={{ color: '#64748b', fontWeight: 400, fontSize: 12 }}>
                      {' '}
                      · {report.category}
                    </span>
                  )}
                </div>
                {report.address && (
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    {report.address}
                  </div>
                )}
                <div style={{ fontSize: 12, marginBottom: 2 }}>
                  <span style={{ fontWeight: 500 }}>Status:</span>{' '}
                  {report.status.replace(/_/g, ' ')}
                </div>
                {/* Weather information */}
                {report.weatherCondition && (
                  <div style={{ fontSize: 12, marginBottom: 2 }}>
                    <span style={{ fontWeight: 500 }}>Weather:</span>{' '}
                    {getWeatherEmoji(report.weatherCondition)} {report.weatherCondition}
                    {report.weatherTemp !== null && report.weatherTemp !== undefined && (
                      <span> · {Math.round(report.weatherTemp)}°C</span>
                    )}
                  </div>
                )}
                {report.weatherRainfall > 20 && (
                  <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 500, marginBottom: 2 }}>
                    ⚠️ Flood Risk
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Submitted: {formatDate(report.createdAt)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <MapLegend />
    </div>
  );
}
