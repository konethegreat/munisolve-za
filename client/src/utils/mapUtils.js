// Shared map constants and helpers for Incident Map / Map page
export const SOUTH_AFRICA_CENTER = [-28.4793, 24.6727];
export const MAP_ZOOM = 6;

export const STATUS_COLORS = {
  OPEN: '#ef4444',
  PENDING: '#ef4444',
  IN_PROGRESS: '#f97316',
  RESOLVED: '#22c55e',
};

export function getStatusColor(status) {
  return STATUS_COLORS[status] || '#6b7280';
}

export function categoryIcon(category) {
  const icons = {
    POTHOLE: '🚧',
    WATER_LEAK: '💧',
    ELECTRICITY_OUTAGE: '⚡',
    REFUSE_COLLECTION: '🗑️',
    STREETLIGHT: '💡',
    SEWAGE: '🚰',
    ILLEGAL_DUMPING: '🗑️',
    GRAFFITI: '🎨',
    PARK_MAINTENANCE: '🌳',
    TRAFFIC_LIGHT: '🚦',
    OTHER: '🏗️',
  };
  return icons[category] || '🏗️';
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function truncate(str, len = 100) {
  if (!str) return '';
  return str.length <= len ? str : str.slice(0, len).trim() + '…';
}
