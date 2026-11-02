// ==========================================
// REPORT CARD (with View Details + inline Resolved button)
// ==========================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitMerge } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import { normalizeApiError } from '../api/errors';
import SiyandaChat from './SiyandaChat';
import WeatherBadge from './WeatherBadge';
import StatusBadge from './StatusBadge';
import SlaBadge from './SlaBadge';

function categoryIcon(category) {
  const icons = {
    POTHOLE: '🕳️', WATER_LEAK: '💧', ELECTRICITY_OUTAGE: '⚡',
    REFUSE_COLLECTION: '🗑️', STREETLIGHT: '💡', SEWAGE: '🚰',
    ILLEGAL_DUMPING: '♻️', GRAFFITI: '🎨', PARK_MAINTENANCE: '🌳',
    TRAFFIC_LIGHT: '🚦', OTHER: '📋',
  };
  return icons[category] || '📋';
}

export default function ReportCard({ report: initialReport, onDelete }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(initialReport);
  const [deleting, setDeleting] = useState(false);
  const [markingResolved, setMarkingResolved] = useState(false);

  const isAdmin = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const reference = `#${String(report.id).padStart(4, '0')}`;

  const handleDelete = async () => {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/reports/${report.id}`);
      toast.success('Report deleted.');
      onDelete(report.id);
    } catch (err) {
      toast.error(normalizeApiError(err, 'Failed to delete report.'));
    } finally {
      setDeleting(false);
    }
  };

  // Quick "Mark as Resolved" for citizens on the card
  const handleMarkResolved = async () => {
    setMarkingResolved(true);
    try {
      const { data } = await api.patch(`/reports/${report.id}/status`, { status: 'RESOLVED' });
      if (data.success) {
        setReport(data.data);
        toast.success('Thanks for confirming. This report is now marked as resolved.');
      }
    } catch (err) {
      toast.error(normalizeApiError(err, 'Failed to update status.'));
    } finally {
      setMarkingResolved(false);
    }
  };

  // Quick admin actions on the card
  const handleAdminStatus = async (newStatus) => {
    try {
      const { data } = await api.patch(`/reports/${report.id}/status`, { status: newStatus });
      if (data.success) {
        setReport(data.data);
        toast.success(`Report moved to ${newStatus.replace(/_/g, ' ').toLowerCase()}.`);
      }
    } catch (err) {
      toast.error(normalizeApiError(err, 'Failed to update status.'));
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Main Content */}
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
            <SlaBadge report={report} />
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {report.category.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {report.duplicateOfId && (
          <button
            type="button"
            onClick={() => navigate(`/reports/${report.duplicateOfId}`)}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-[#0d3b5c]/30 hover:text-[#0d3b5c]"
          >
            <GitMerge size={13} />
            Merged into report #{String(report.duplicateOfId).padStart(4, '0')}. Open the main
            report for updates.
          </button>
        )}

        <WeatherBadge 
          weatherCondition={report.weatherCondition}
          weatherTemp={report.weatherTemp}
          weatherRainfall={report.weatherRainfall}
          weatherWind={report.weatherWind}
          weatherHumidity={report.weatherHumidity}
        />

        <p className="text-slate-600 text-sm mt-3 line-clamp-2">{report.description}</p>
      </div>

      {/* Quick Status Actions (inline on card) */}
      {isAdmin && report.status === 'PENDING' && (
        <div className="px-5 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
          <span className="text-xs text-blue-600 font-medium">Admin:</span>
          <button
            onClick={() => handleAdminStatus('IN_PROGRESS')}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full transition-colors"
          >
            🔧 Start Working
          </button>
          <button
            onClick={() => handleAdminStatus('RESOLVED')}
            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-full transition-colors"
          >
            ✅ Resolve
          </button>
          <button
            onClick={() => handleAdminStatus('REJECTED')}
            className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full transition-colors"
          >
            ❌ Reject
          </button>
        </div>
      )}

      {isAdmin && report.status === 'IN_PROGRESS' && (
        <div className="px-5 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
          <span className="text-xs text-blue-600 font-medium">Admin:</span>
          <button
            onClick={() => handleAdminStatus('RESOLVED')}
            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-full transition-colors"
          >
            ✅ Mark Resolved
          </button>
          <button
            onClick={() => handleAdminStatus('REJECTED')}
            className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full transition-colors"
          >
            ❌ Reject
          </button>
        </div>
      )}

      {!isAdmin && ['PENDING', 'IN_PROGRESS'].includes(report.status) && (
        <div className="px-5 py-2 bg-green-50 border-t border-green-100 flex items-center gap-2">
          <span className="text-xs text-slate-500">Was this fixed?</span>
          <button
            onClick={handleMarkResolved}
            disabled={markingResolved}
            className="text-xs bg-[#1a5f3c] hover:bg-[#145230] text-white px-3 py-1 rounded-full transition-colors disabled:opacity-50"
          >
            {markingResolved ? 'Updating...' : '✅ Yes, mark as resolved'}
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
        <SiyandaChat report={report} initialMessage={report.aiResponse || null} />

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/reports/${report.id}`)}
            className="text-xs text-[#0d3b5c] hover:underline font-medium transition-colors"
          >
            View Details →
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
    </div>
  );
}
