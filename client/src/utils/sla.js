// SLA display helpers. Dates come from the API as ISO strings.
// Open reports show a response deadline while pending and a resolution deadline once assigned.

export const OPEN_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'];
const WARNING_RATIO = 0.2;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function time(value) {
  if (value == null || value === '') return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isOpenReport(report) {
  return Boolean(report && OPEN_STATUSES.includes(report.status));
}

// Picks the deadline that matters for the current status.
export function slaDeadline(report) {
  if (!isOpenReport(report)) return null;

  const responseDue = time(report.responseDueAt);
  const resolutionDue = time(report.resolutionDueAt);
  const assigned = time(report.assignedAt);

  if (report.status === 'PENDING' && !assigned && responseDue) {
    return {
      kind: 'response',
      label: 'Response',
      dueAt: responseDue,
      startedAt: time(report.createdAt),
    };
  }

  if (resolutionDue) {
    return {
      kind: 'resolution',
      label: 'Resolution',
      dueAt: resolutionDue,
      startedAt: time(report.slaCycleStartedAt) ?? time(report.assignedAt) ?? time(report.createdAt),
    };
  }

  return null;
}

export function formatDuration(ms) {
  const value = Math.max(0, Math.floor(ms));
  if (value < HOUR) {
    const minutes = Math.max(0, Math.round(value / 60000));
    return `${minutes}m`;
  }
  if (value < DAY) return `${Math.floor(value / HOUR)}h`;
  const days = Math.floor(value / DAY);
  const hours = Math.floor((value % DAY) / HOUR);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

// tone: overdue | warning | ok
export function slaState(report, now = Date.now()) {
  const deadline = slaDeadline(report);
  if (!deadline) return null;

  const remaining = deadline.dueAt - now;
  const startedAt = deadline.startedAt ?? deadline.dueAt - DAY;
  const windowMs = deadline.dueAt - startedAt;
  const ratio = windowMs > 0 ? remaining / windowMs : 0;

  let tone = 'ok';
  if (remaining <= 0) tone = 'overdue';
  else if (ratio <= WARNING_RATIO) tone = 'warning';

  const verb = tone === 'overdue' ? 'overdue by' : 'left';
  const text =
    tone === 'overdue'
      ? `${deadline.label} ${verb} ${formatDuration(Math.abs(remaining))}`
      : `${deadline.label} due in ${formatDuration(remaining)}`;

  return {
    ...deadline,
    remaining,
    tone,
    text,
  };
}

export function formatDueDate(value, locale = 'en-ZA') {
  const ms = time(value);
  if (!ms) return '';
  return new Date(ms).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
