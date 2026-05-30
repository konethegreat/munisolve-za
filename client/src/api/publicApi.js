// ==========================================
// PUBLIC API HELPERS (keyless, no-auth endpoints)
// ==========================================
import api from './axios';

// Aggregate community statistics
export async function fetchStats() {
  const { data } = await api.get('/public/stats');
  return data.success ? data.data : null;
}

// Live air quality for a coordinate (Open-Meteo, keyless)
export async function fetchAirQuality(lat, lon) {
  if (lat == null || lon == null) return null;
  const { data } = await api.get('/public/air-quality', { params: { lat, lon } });
  return data.success ? data.data : null;
}

// South African public holidays (Nager.Date, keyless)
export async function fetchHolidays() {
  const { data } = await api.get('/public/holidays');
  return data.success ? data.data : null;
}
