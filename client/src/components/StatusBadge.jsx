const STATUS_META = {
  PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  ASSIGNED: { label: 'Assigned', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  RESOLVED: { label: 'Resolved', className: 'bg-green-100 text-green-800 border-green-200' },
  CLOSED: { label: 'Closed', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200' },
};

export default function StatusBadge({ status, className = '' }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className} ${className}`}
    >
      {meta.label}
    </span>
  );
}
