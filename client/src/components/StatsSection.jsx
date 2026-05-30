// ==========================================
// STATS SECTION (landing page)
// Live community statistics with animated counters.
// Data: GET /api/public/stats (keyless aggregate).
// ==========================================
import { useEffect, useState } from 'react';
import { FileText, CheckCircle2, TrendingUp, Building2 } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';
import { fetchStats } from '../api/publicApi';

const CATEGORY_LABELS = {
  POTHOLE: '🕳️ Potholes', WATER_LEAK: '💧 Water Leaks', ELECTRICITY_OUTAGE: '⚡ Power',
  REFUSE_COLLECTION: '🗑️ Refuse', STREETLIGHT: '💡 Streetlights', SEWAGE: '🚰 Sewage',
  ILLEGAL_DUMPING: '♻️ Dumping', GRAFFITI: '🎨 Graffiti', PARK_MAINTENANCE: '🌳 Parks',
  TRAFFIC_LIGHT: '🚦 Traffic Lights', OTHER: '📋 Other',
};

export default function StatsSection() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchStats()
      .then((res) => { if (active) res ? setStats(res) : setError(true); })
      .catch(() => active && setError(true));
    return () => { active = false; };
  }, []);

  if (error) return null;

  const cards = [
    { key: 'totalReports', label: 'Reports logged', icon: FileText, color: 'var(--navy)', suffix: '' },
    { key: 'resolved', label: 'Issues resolved', icon: CheckCircle2, color: 'var(--green)', suffix: '' },
    { key: 'resolutionRate', label: 'Resolution rate', icon: TrendingUp, color: '#ca8a04', suffix: '%' },
    { key: 'municipalitiesServed', label: 'Municipalities', icon: Building2, color: 'var(--navy-soft)', suffix: '' },
  ];

  const maxCat = stats?.categories?.[0]?.count || 1;

  return (
    <section className="bg-mesh py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-[#1a5f3c]">
            <span className="live-dot" /> Live community impact
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-[#0d3b5c]">
            Real reports, real results
          </h2>
          <div className="accent-underline mx-auto mt-4" />
        </div>

        {/* Counter cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={c.key}
                className="card card-hover stat-card animate-fade-up p-6 text-center"
                style={{ '--edge': c.color, animationDelay: `${i * 0.09}s` }}
              >
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${c.color}14`, color: c.color }}
                >
                  <Icon size={22} />
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[#0d3b5c]">
                  {stats ? (
                    <AnimatedCounter value={stats[c.key]} suffix={c.suffix} />
                  ) : (
                    <span className="skeleton inline-block h-9 w-16 rounded align-middle" />
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{c.label}</p>
              </div>
            );
          })}
        </div>

        {/* Category breakdown */}
        {stats?.categories?.length > 0 && (
          <div className="card animate-fade-up delay-3 mt-8 p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Most reported issues</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.categories.slice(0, 6).map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-slate-600">
                    {CATEGORY_LABELS[c.category] || c.category}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0d3b5c] to-[#1a5f3c] transition-all duration-700"
                      style={{ width: `${Math.max(8, (c.count / maxCat) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-slate-700">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
