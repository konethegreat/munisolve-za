// ==========================================
// MAP PAGE - Full-page incident map with filters and layers
// ==========================================
import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import {
  SOUTH_AFRICA_CENTER,
  MAP_ZOOM,
  getStatusColor,
  categoryIcon,
  formatDate,
  truncate,
} from '../utils/mapUtils';
import WeatherBadge from '../components/WeatherBadge';

// Fix default Leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
];

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

function StatusBadge({ status }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 border border-blue-200',
    RESOLVED: 'bg-green-100 text-green-800 border border-green-200',
  };
  const labels = {
    PENDING: 'Open',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.PENDING}`}
    >
      {labels[status] || status?.replace(/_/g, ' ')}
    </span>
  );
}

// Heatmap layer: adds L.heatLayer to the map for the given latlngs
function HeatmapLayer({ latlngs, visible }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!visible || !latlngs.length) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }
    const heat = L.heatLayer(
      latlngs.map(([lat, lng]) => [lat, lng, 0.5]),
      { radius: 25, blur: 15, maxZoom: 14 }
    );
    heat.addTo(map);
    layerRef.current = heat;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, visible, latlngs]);

  return null;
}

export default function MapPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState(['ALL']);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [viewMode, setViewMode] = useState('pins'); // 'pins' | 'heatmap'

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/reports');
      if (data.success) {
        setReports(data.data);
      }
    } catch (err) {
      setError('Failed to load reports. Please refresh.');
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const uniqueCategories = useMemo(() => {
    const cats = [...new Set(reports.map((r) => r.category).filter(Boolean))].sort();
    return cats;
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const statusOk =
        statusFilter.includes('ALL') || statusFilter.includes(r.status);
      const categoryOk =
        categoryFilter.length === 0 || categoryFilter.includes(r.category);
      return statusOk && categoryOk;
    });
  }, [reports, statusFilter, categoryFilter]);

  const reportsWithCoords = useMemo(
    () =>
      filteredReports.filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          Number.isFinite(Number(r.latitude)) &&
          Number.isFinite(Number(r.longitude))
      ),
    [filteredReports]
  );

  const heatmapLatLngs = useMemo(
    () =>
      reportsWithCoords.map((r) => [
        Number(r.latitude),
        Number(r.longitude),
      ]),
    [reportsWithCoords]
  );

  const toggleStatus = (value) => {
    if (value === 'ALL') {
      setStatusFilter(['ALL']);
      return;
    }
    setStatusFilter((prev) => {
      const next = prev.filter((s) => s !== 'ALL');
      if (next.includes(value)) {
        const n = next.filter((s) => s !== value);
        return n.length ? n : ['ALL'];
      }
      return [...next, value];
    });
  };

  const toggleCategory = (cat) => {
    setCategoryFilter((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const resetFilters = () => {
    setStatusFilter(['ALL']);
    setCategoryFilter([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex-1 flex overflow-hidden min-h-0" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Filter panel - left sidebar 280px */}
        <aside className="w-[280px] flex-shrink-0 bg-white border-r border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h1 className="text-xl font-bold text-[#0d3b5c]">Incident Map</h1>
          </div>
          <div className="p-4 space-y-6 overflow-y-auto">
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Status</h2>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(opt.value)}
                      onChange={() => toggleStatus(opt.value)}
                      className="rounded border-slate-300 text-[#0d3b5c] focus:ring-[#0d3b5c]"
                    />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Category</h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uniqueCategories.length === 0 && !loading && (
                  <p className="text-slate-500 text-sm">No categories in data</p>
                )}
                {uniqueCategories.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoryFilter.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="rounded border-slate-300 text-[#0d3b5c] focus:ring-[#0d3b5c]"
                    />
                    <span className="text-sm text-slate-700">
                      {categoryIcon(cat)} {cat.replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="w-full py-2 px-4 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </aside>

        {/* Map area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Layer toggle above map */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-100 shadow-sm">
            <span className="text-sm font-medium text-slate-600 mr-2">View:</span>
            <button
              type="button"
              onClick={() => setViewMode('pins')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'pins'
                  ? 'bg-[#0d3b5c] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pins
            </button>
            <button
              type="button"
              onClick={() => setViewMode('heatmap')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'heatmap'
                  ? 'bg-[#0d3b5c] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Heatmap
            </button>
          </div>

          <div className="flex-1 relative min-h-0">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0d3b5c]"></div>
              </div>
            ) : (
              <MapContainer
                center={SOUTH_AFRICA_CENTER}
                zoom={MAP_ZOOM}
                className="h-full w-full"
                style={{ height: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <HeatmapLayer latlngs={heatmapLatLngs} visible={viewMode === 'heatmap'} />
                {viewMode === 'pins' &&
                  reportsWithCoords.map((report) => (
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
                        <div className="min-w-[220px] text-left">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{categoryIcon(report.category)}</span>
                            <span className="font-medium text-slate-800">
                              {report.category?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            {truncate(report.description, 100)}
                          </p>
                          {report.address && (
                            <p className="text-xs text-slate-500 mb-2">{report.address}</p>
                          )}
                          <div className="flex items-center justify-between flex-wrap gap-1 mb-2">
                            <StatusBadge status={report.status} />
                            <span className="text-xs text-slate-400">
                              {formatDate(report.createdAt)}
                            </span>
                          </div>
                          {/* Weather information */}
                          {report.weatherCondition && (
                            <div className="text-xs text-slate-600 mb-1">
                              <span className="font-medium">Weather:</span>{' '}
                              {getWeatherEmoji(report.weatherCondition)} {report.weatherCondition}
                              {report.weatherTemp !== null && report.weatherTemp !== undefined && (
                                <span> · {Math.round(report.weatherTemp)}°C</span>
                              )}
                            </div>
                          )}
                          {report.weatherRainfall > 20 && (
                            <div className="text-xs text-red-600 font-medium mb-1">
                              ⚠️ Flood Risk
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
              </MapContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
