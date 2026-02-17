// ==========================================
// REPORT DETAIL PAGE
// ==========================================
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SiyandaChat from '../components/SiyandaChat';

// ==========================================
// STATUS TIMELINE
// ==========================================
const STEPS = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];

function StatusTimeline({ status }) {
  const isRejected = status === 'REJECTED';
  const currentIndex = STEPS.indexOf(status);

  if (isRejected) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-xl">❌</span>
          <div>
            <p className="font-semibold text-red-700">Report Rejected</p>
            <p className="text-red-600 text-sm">This report was reviewed and rejected by municipal officials.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isDone = currentIndex >= i;
          const isCurrent = currentIndex === i;
          return (
            <div key={step} className="flex flex-col items-center flex-1">
              {/* Connector line */}
              {i > 0 && (
                <div className={`absolute h-0.5 top-4 transition-all duration-500
                  ${isDone ? 'bg-[#1a5f3c]' : 'bg-slate-200'}`}
                  style={{
                    left: `${(i - 1) * 50 + 25}%`,
                    width: '50%',
                  }}
                />
              )}
              {/* Circle */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 text-sm font-bold border-2 transition-all duration-300
                ${isDone
                  ? 'bg-[#1a5f3c] border-[#1a5f3c] text-white'
                  : 'bg-white border-slate-300 text-slate-400'
                }
                ${isCurrent ? 'ring-4 ring-[#1a5f3c]/20' : ''}
              `}>
                {isDone ? '✓' : i + 1}
              </div>
              {/* Label */}
              <p className={`text-xs mt-2 font-medium text-center
                ${isDone ? 'text-[#1a5f3c]' : 'text-slate-400'}
              `}>
                {step === 'PENDING' && '⏳ Pending'}
                {step === 'IN_PROGRESS' && '🔧 In Progress'}
                {step === 'RESOLVED' && '✅ Resolved'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// STATUS UPDATE BUTTONS
// ==========================================
function StatusActions({ report, onStatusUpdate, userRole }) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const isAdmin = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(userRole);

  const handleUpdate = async (newStatus) => {
    setLoading(true);
    try {
      const { data } = await api.patch(`/reports/${report.id}/status`, {
        status: newStatus,
        note,
      });
      if (data.success) {
        onStatusUpdate(data.data);
        setNote('');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  // What buttons to show based on role and current status
  const getActions = () => {
    if (report.status === 'RESOLVED' || report.status === 'REJECTED') {
      if (!isAdmin) return null;
    }

    if (isAdmin) {
      return (
        <div className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)..."
            rows={2}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#0d3b5c] resize-none"
          />
          <div className="flex gap-2 flex-wrap">
            {report.status === 'PENDING' && (
              <button
                onClick={() => handleUpdate('IN_PROGRESS')}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                🔧 Start Working
              </button>
            )}
            {['PENDING', 'IN_PROGRESS'].includes(report.status) && (
              <button
                onClick={() => handleUpdate('RESOLVED')}
                disabled={loading}
                className="bg-[#1a5f3c] hover:bg-[#145230] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                ✅ Mark Resolved
              </button>
            )}
            {['PENDING', 'IN_PROGRESS'].includes(report.status) && (
              <button
                onClick={() => handleUpdate('REJECTED')}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                ❌ Reject
              </button>
            )}
            {report.status === 'RESOLVED' && (
              <button
                onClick={() => handleUpdate('IN_PROGRESS')}
                disabled={loading}
                className="bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                🔄 Re-open
              </button>
            )}
          </div>
        </div>
      );
    }

    // Citizen actions
    if (['PENDING', 'IN_PROGRESS'].includes(report.status)) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Has your issue been fixed? Let us know!
          </p>
          <button
            onClick={() => handleUpdate('RESOLVED')}
            disabled={loading}
            className="bg-[#1a5f3c] hover:bg-[#145230] text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : '✅ Yes, this has been fixed!'}
          </button>
        </div>
      );
    }

    return null;
  };

  const actions = getActions();
  if (!actions) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-3">
        {isAdmin ? '⚙️ Update Status' : '📢 Has this been fixed?'}
      </h3>
      {actions}
    </div>
  );
}

// ==========================================
// CATEGORY ICON
// ==========================================
function categoryIcon(category) {
  const icons = {
    POTHOLE: '🕳️', WATER_LEAK: '💧', ELECTRICITY_OUTAGE: '⚡',
    REFUSE_COLLECTION: '🗑️', STREETLIGHT: '💡', SEWAGE: '🚰',
    ILLEGAL_DUMPING: '♻️', GRAFFITI: '🎨', PARK_MAINTENANCE: '🌳',
    TRAFFIC_LIGHT: '🚦', OTHER: '📋',
  };
  return icons[category] || '📋';
}

// ==========================================
// MAIN REPORT DETAIL PAGE
// ==========================================
export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
  const fetchReport = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/reports/${id}`);
      if (data.success) setReport(data.data);
    } catch {
      setError('Report not found or you do not have permission to view it.');
    } finally {
      setLoading(false);
    }
  };

  fetchReport();
}, [id]); // Now 'fetchReport' isn't a dependency because it's local to the effect

  const handleStatusUpdate = (updatedReport) => {
    setReport(updatedReport);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0d3b5c] mx-auto mb-3" />
            <p className="text-slate-500">Loading report...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">😕</p>
            <p className="text-slate-600">{error || 'Report not found'}</p>
            <button onClick={() => navigate('/dashboard')} className="mt-4 text-[#0d3b5c] hover:underline text-sm">
              ← Back to Dashboard
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const reference = `#${String(report.id).padStart(4, '0')}`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 px-4 py-10">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Back button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1 transition-colors"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="text-4xl">{categoryIcon(report.category)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-800">{report.title}</h1>
                  <span className="text-sm text-slate-400">{reference}</span>
                </div>
                <p className="text-slate-500 text-sm mt-1">{report.address}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {report.municipality} · Submitted {new Date(report.createdAt).toLocaleDateString('en-ZA', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Status Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-6">Progress</h2>
            <StatusTimeline status={report.status} />
          </div>

          {/* Status Actions */}
          <StatusActions
            report={report}
            onStatusUpdate={handleStatusUpdate}
            userRole={user?.role}
          />

          {/* Report Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-4">Report Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-slate-400">Category</p>
                <p className="font-medium text-slate-700">{report.category.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-slate-400">Municipality</p>
                <p className="font-medium text-slate-700">{report.municipality}</p>
              </div>
              <div>
                <p className="text-slate-400">Location</p>
                <p className="font-medium text-slate-700">{report.address}</p>
              </div>
              <div>
                <p className="text-slate-400">Last Updated</p>
                <p className="font-medium text-slate-700">
                  {new Date(report.updatedAt).toLocaleDateString('en-ZA')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Description</p>
              <p className="text-slate-700 text-sm leading-relaxed">{report.description}</p>
            </div>
          </div>

          {/* Siyanda Chat */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-3">💬 Chat with Siyanda</h2>
            <p className="text-slate-500 text-sm mb-4">
              Ask Siyanda anything about this report — timelines, escalation, what to expect next.
            </p>
            <SiyandaChat report={report} />
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}