// ==========================================
// AIR QUALITY BADGE
// Fetches live air quality for a coordinate (Open-Meteo, keyless)
// and renders a compact, colour-coded badge with detail on hover.
// ==========================================
import { useEffect, useState } from 'react';
import { Wind } from 'lucide-react';
import { fetchAirQuality } from '../api/publicApi';

export default function AirQualityBadge({ lat, lon, compact = false }) {
  // The result is stored with the coordinates it was fetched for, so "loading" can be worked out
  // while rendering (no result for the current coordinates yet) instead of being set in the effect.
  const key = lat == null || lon == null ? null : `${lat},${lon}`;
  const [result, setResult] = useState({ key: null, data: null });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    fetchAirQuality(lat, lon)
      .then((res) => { if (active) setResult({ key, data: res }); })
      .catch(() => { if (active) setResult((prev) => ({ key, data: prev.data })); });
    return () => { active = false; };
  }, [key, lat, lon]);

  const { data } = result;
  const loading = key !== null && result.key !== key;

  if (lat == null || lon == null) return null;

  if (loading && !data) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
        <Wind size={13} className="animate-pulse" /> Checking air…
      </span>
    );
  }
  if (!data || data.europeanAqi == null) return null;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold cursor-default transition-all hover:shadow-md"
        style={{ backgroundColor: `${data.color}1a`, color: data.color, border: `1px solid ${data.color}55` }}
      >
        <Wind size={13} />
        AQI {Math.round(data.europeanAqi)} · {data.label}
      </span>

      {open && !compact && (
        <span className="absolute z-50 bottom-full left-0 mb-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg animate-scale-in">
          <span className="block text-xs font-semibold text-slate-700 mb-2">
            Air quality · <span style={{ color: data.color }}>{data.label}</span>
          </span>
          <span className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
            <span>PM2.5: {data.pm25 ?? '—'} µg/m³</span>
            <span>PM10: {data.pm10 ?? '—'} µg/m³</span>
            <span>NO₂: {data.no2 ?? '—'}</span>
            <span>O₃: {data.ozone ?? '—'}</span>
          </span>
          <span className="mt-2 block text-[10px] text-slate-400">Source: Open-Meteo</span>
        </span>
      )}
    </span>
  );
}
