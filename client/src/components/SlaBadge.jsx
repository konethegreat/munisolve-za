import { AlertTriangle, Clock, TimerReset } from 'lucide-react';
import { formatDueDate, slaState } from '../utils/sla';

const TONES = {
  ok: {
    icon: TimerReset,
    shell: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  warning: {
    icon: Clock,
    shell: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  overdue: {
    icon: AlertTriangle,
    shell: 'bg-red-50 text-red-700 border-red-200',
  },
};

export default function SlaBadge({ report, now, className = '' }) {
  const state = slaState(report, now);
  if (!state) return null;

  const tone = TONES[state.tone] ?? TONES.ok;
  const Icon = tone.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tone.shell} ${className}`}
      title={`${state.label} deadline: ${formatDueDate(state.dueAt)}`}
    >
      <Icon size={12} />
      {state.text}
    </span>
  );
}
