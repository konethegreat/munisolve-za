// ==========================================
// HOLIDAY BANNER
// Shows a notice when today is a SA public holiday (response times
// may be affected) or, otherwise, a subtle "next holiday" chip.
// Data: Nager.Date (keyless).
// ==========================================
import { useEffect, useState } from 'react';
import { CalendarDays, PartyPopper } from 'lucide-react';
import { fetchHolidays } from '../api/publicApi';

export default function HolidayBanner({ variant = 'banner' }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    fetchHolidays()
      .then((res) => { if (active) setData(res); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!data) return null;

  // Today is a public holiday — prominent banner
  if (data.isPublicHolidayToday && data.todaysHoliday) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#e8b923]/40 bg-[#e8b923]/10 px-4 py-3 text-sm animate-fade-in">
        <PartyPopper size={18} className="text-[#b8901a] shrink-0" />
        <p className="text-[#7a5e10]">
          <span className="font-semibold">{data.todaysHoliday.name}</span> — today is a public holiday in South Africa.
          Municipal response times may be slower than usual.
        </p>
      </div>
    );
  }

  // Compact "next holiday" chip
  if (variant === 'chip' && data.nextHoliday) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/85">
        <CalendarDays size={13} />
        Next holiday: {data.nextHoliday.name} · {data.nextHoliday.daysUntil}d
      </span>
    );
  }

  if (data.nextHoliday) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-sm">
        <CalendarDays size={16} className="text-[#0d3b5c] shrink-0" />
        <span>
          Next public holiday: <span className="font-medium text-slate-800">{data.nextHoliday.name}</span>{' '}
          ({new Date(data.nextHoliday.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })}
          {' · '}{data.nextHoliday.daysUntil} day{data.nextHoliday.daysUntil === 1 ? '' : 's'} away)
        </span>
      </div>
    );
  }

  return null;
}
