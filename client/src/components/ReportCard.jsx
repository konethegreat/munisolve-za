// ==========================================
// UPDATED REPORT CARD with Siyanda Chat
// ==========================================
// Replace the ReportCard component in Dashboard.jsx with this

import { useState } from 'react';
import api from '../api/axios';
import SiyandaChat from './SiyandaChat';

function categoryIcon(category) {
  const icons = {
    POTHOLE:            '🕳️',
    WATER_LEAK:         '💧',
    ELECTRICITY_OUTAGE: '⚡',
    REFUSE_COLLECTION:  '🗑️',
    STREETLIGHT:        '💡',
    SEWAGE:             '🚰',
    ILLEGAL_DUMPING:    '♻️',
    GRAFFITI:           '🎨',
    PARK_MAINTENANCE:   '🌳',
    TRAFFIC_LIGHT:      '🚦',
    OTHER:              '📋',
  };
  return icons[category] || '📋';
}

function StatusBadge({ status }) {
  const styles = {
    PENDING:     'bg-yellow-100 text-yellow-800 border border-yellow-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 border border-blue-200',
    RESOLVED:    'bg-green-100 text-green-800 border border-green-200',
    REJECTED:    'bg-red-100 text-red-800 border border-red-200',
  };
  const labels = {
    PENDING:     '⏳ Pending',
    IN_PROGRESS: '🔧 In Progress',
    RESOLVED:    '✅ Resolved',
    REJECTED:    '❌ Rejected',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.PENDING}`}>
      {labels[status] || status}
    </span>
  );
}

export default function ReportCard({ report, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    setDeleting(true);
    try {
      await api.delete(`/reports/${report.id}`);
      onDelete(report.id);
    } catch {
      alert('Failed to delete report. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const reference = `#${String(report.id).padStart(4, '0')}`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Main Card Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl mt-0.5">{categoryIcon(report.category)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 truncate">{report.title}</h3>
                <span className="text-xs text-slate-400 shrink-0">{reference}</span>
              </div>
              <p className="text-slate-500 text-sm mt-0.5 truncate">{report.address}</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {report.municipality} · {new Date(report.createdAt).toLocaleDateString('en-ZA', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={report.status} />
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {report.category.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Description preview */}
        <p className="text-slate-600 text-sm mt-3 line-clamp-2">{report.description}</p>
      </div>

      {/* Action Bar */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
        {/* Siyanda Chat Button */}
        <SiyandaChat
          report={report}
          initialMessage={report.aiResponse || null}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {expanded ? 'Less ↑' : 'More ↓'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 py-4 border-t border-slate-100 bg-white">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Full Description</h4>
          <p className="text-slate-700 text-sm leading-relaxed">{report.description}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400">Reference</span>
              <p className="font-semibold text-slate-700">{reference}</p>
            </div>
            <div>
              <span className="text-slate-400">Status</span>
              <p className="font-semibold text-slate-700">{report.status}</p>
            </div>
            <div>
              <span className="text-slate-400">Category</span>
              <p className="font-semibold text-slate-700">{report.category.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-slate-400">Municipality</span>
              <p className="font-semibold text-slate-700">{report.municipality}</p>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400">Location</span>
              <p className="font-semibold text-slate-700">{report.address}</p>
            </div>
            <div>
              <span className="text-slate-400">Submitted</span>
              <p className="font-semibold text-slate-700">
                {new Date(report.createdAt).toLocaleDateString('en-ZA', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
