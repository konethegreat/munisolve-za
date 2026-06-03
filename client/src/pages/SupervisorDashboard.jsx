import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  HardHat,
  Image,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Shield,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-ZA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const STATUS_META = {
  PENDING:     { label: 'Pending',     bg: 'bg-amber-100',   text: 'text-amber-800' },
  ASSIGNED:    { label: 'Assigned',    bg: 'bg-blue-100',    text: 'text-blue-800' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-orange-100',  text: 'text-orange-800' },
  RESOLVED:    { label: 'Resolved',    bg: 'bg-green-100',   text: 'text-green-800' },
  CLOSED:      { label: 'Closed',      bg: 'bg-slate-100',   text: 'text-slate-600' },
  REJECTED:    { label: 'Rejected',    bg: 'bg-red-100',     text: 'text-red-800' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

const NEXT_STATUS_OPTIONS = {
  ASSIGNED:    ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED:    ['CLOSED'],
};

const SPECIALIZATIONS = [
  'Roads & Infrastructure',
  'Water & Sanitation',
  'Electricity & Power',
  'Waste Management',
  'Parks & Recreation',
  'General Maintenance',
];

// ─── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({ report, onClose, onAssigned }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/supervisor/reports/${report.id}/suggestions`)
      .then(({ data }) => data.success && setTeams(data.data))
      .catch(() => setError('Failed to load team suggestions.'))
      .finally(() => setLoading(false));
  }, [report.id]);

  const handleAssign = async () => {
    if (!selectedTeam) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.patch(`/supervisor/reports/${report.id}/assign`, {
        teamId: selectedTeam.id,
        note,
      });
      if (data.success) {
        onAssigned(data.data);
        onClose();
      } else {
        setError(data.message || 'Assignment failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Assignment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#0d3b5c] text-lg">Assign Report</h2>
            <p className="text-slate-500 text-sm truncate max-w-xs">{report.title}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Report info strip */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="flex items-center gap-1"><MapPin size={13} />{report.municipality}</span>
          <span className="flex items-center gap-1"><Wrench size={13} />{report.category}</span>
          <span className="flex items-center gap-1"><Clock size={13} />{timeAgo(report.createdAt)}</span>
        </div>

        {/* Team list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading teams…
            </div>
          ) : teams.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No active teams found.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Teams — sorted by best match
              </p>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
                    selectedTeam?.id === team.id
                      ? 'border-[#0d3b5c] bg-[#0d3b5c]/5'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{team.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{team.specialization}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      {team.specScore === 2 && (
                        <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full mb-1 font-medium">
                          Best match
                        </span>
                      )}
                      {team.distanceKm !== null && (
                        <p className="text-xs text-slate-400">{team.distanceKm} km away</p>
                      )}
                      <p className="text-xs text-slate-400">{team.activeTickets} active ticket{team.activeTickets !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Note + actions */}
        <div className="px-6 py-4 border-t border-slate-100 space-y-3">
          <input
            type="text"
            placeholder="Optional note for the team…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3b5c]/30 focus:border-[#0d3b5c]"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedTeam || submitting}
              className="flex-1 bg-[#0d3b5c] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#0d3b5c]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <HardHat size={15} />}
              Assign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status Update Modal ──────────────────────────────────────────────────────

function StatusModal({ report, onClose, onUpdated }) {
  const options = NEXT_STATUS_OPTIONS[report.status] ?? [];
  const [status, setStatus] = useState(options[0] ?? '');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const needsPhoto = status === 'RESOLVED' && !report.afterPhotoUrl;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const body = { status, note };
      if (afterPhotoUrl) body.afterPhotoUrl = afterPhotoUrl;
      const { data } = await api.patch(`/supervisor/reports/${report.id}/status`, body);
      if (data.success) {
        onUpdated(data.data);
        onClose();
      } else {
        setError(data.message || 'Update failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#0d3b5c] text-lg">Update Status</h2>
            <p className="text-slate-500 text-sm truncate max-w-xs">{report.title}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Current:</span>
            <StatusBadge status={report.status} />
          </div>

          {options.length === 0 ? (
            <p className="text-slate-500 text-sm">No further transitions available from this status.</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  New Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {options.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                        status === s
                          ? 'border-[#0d3b5c] bg-[#0d3b5c] text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {STATUS_META[s]?.label ?? s}
                    </button>
                  ))}
                </div>
              </div>

              {needsPhoto && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    After-Photo URL <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-[#0d3b5c]/30 focus-within:border-[#0d3b5c]">
                    <Image size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="url"
                      placeholder="https://example.com/after-photo.jpg"
                      value={afterPhotoUrl}
                      onChange={(e) => setAfterPhotoUrl(e.target.value)}
                      className="flex-1 text-sm focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Required to mark as Resolved.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  placeholder="Add a brief note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3b5c]/30 focus:border-[#0d3b5c]"
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!status || (needsPhoto && !afterPhotoUrl) || submitting}
                  className="flex-1 bg-[#0d3b5c] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#0d3b5c]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  Update
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Team Modal ────────────────────────────────────────────────────────

function CreateTeamModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', specialization: '', municipality: '', latitude: '', longitude: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const body = { name: form.name.trim(), specialization: form.specialization };
      if (form.municipality.trim()) body.municipality = form.municipality.trim();
      if (form.latitude) body.latitude = parseFloat(form.latitude);
      if (form.longitude) body.longitude = parseFloat(form.longitude);

      const { data } = await api.post('/supervisor/teams', body);
      if (data.success) {
        onCreated(data.data);
        onClose();
      } else {
        setError(data.message || 'Failed to create team.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create team.');
    } finally {
      setSubmitting(false);
    }
  };

  const invalid = !form.name.trim() || !form.specialization;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-[#0d3b5c] text-lg">New Maintenance Crew</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Northern Roads Unit 3"
              value={form.name}
              onChange={set('name')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3b5c]/30 focus:border-[#0d3b5c]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Specialization <span className="text-red-500">*</span>
            </label>
            <select
              value={form.specialization}
              onChange={set('specialization')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3b5c]/30 focus:border-[#0d3b5c] bg-white"
            >
              <option value="">Select specialization…</option>
              {SPECIALIZATIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Municipality (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. City of Johannesburg"
              value={form.municipality}
              onChange={set('municipality')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3b5c]/30 focus:border-[#0d3b5c]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                placeholder="-26.2041"
                value={form.latitude}
                onChange={set('latitude')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3b5c]/30 focus:border-[#0d3b5c]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                placeholder="28.0473"
                value={form.longitude}
                onChange={set('longitude')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3b5c]/30 focus:border-[#0d3b5c]"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">Coordinates improve proximity matching suggestions.</p>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={invalid || submitting}
              className="flex-1 bg-[#0d3b5c] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#0d3b5c]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Create Crew
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Report Card (triage queue) ───────────────────────────────────────────────

function TriageCard({ report, onSelect }) {
  const ageMs = Date.now() - new Date(report.createdAt).getTime();
  const ageHrs = ageMs / 3600000;
  const urgent = ageHrs > 24;

  return (
    <button
      onClick={() => onSelect(report)}
      className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-[#0d3b5c]/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{report.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Wrench size={11} />{report.category}</span>
            <span className="flex items-center gap-1"><MapPin size={11} />{report.municipality}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          {urgent && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium mb-1">
              <AlertTriangle size={11} /> Overdue
            </span>
          )}
          <p className={`text-xs ${urgent ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
            {timeAgo(report.createdAt)}
          </p>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-[#0d3b5c] mt-1 ml-auto transition-colors" />
        </div>
      </div>
    </button>
  );
}

// ─── Active Report Card ───────────────────────────────────────────────────────

function ActiveCard({ report, onSelect }) {
  return (
    <button
      onClick={() => onSelect(report)}
      className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-[#0d3b5c]/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{report.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {report.team?.name ?? '—'}  ·  {report.category}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <StatusBadge status={report.status} />
          <p className="text-xs text-slate-400">{timeAgo(report.assignedAt ?? report.createdAt)}</p>
        </div>
      </div>
    </button>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

function TeamCard({ team }) {
  const load = team.activeTickets ?? 0;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{team.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{team.specialization}</p>
          {team.municipality && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <MapPin size={10} />{team.municipality}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-lg font-bold ${load > 3 ? 'text-red-600' : load > 1 ? 'text-amber-600' : 'text-green-600'}`}>
            {load}
          </p>
          <p className="text-xs text-slate-400">active</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${load > 3 ? 'bg-red-400' : load > 1 ? 'bg-amber-400' : 'bg-green-400'}`}
            style={{ width: `${Math.min(load * 20, 100)}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${!team.isActive ? 'text-slate-400' : 'text-green-600'}`}>
          {team.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function SupervisorDashboard() {
  const [stats, setStats] = useState(null);
  const [triageReports, setTriageReports] = useState([]);
  const [activeReports, setActiveReports] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadingTriage, setLoadingTriage] = useState(true);
  const [loadingActive, setLoadingActive] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const [assignTarget, setAssignTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadingTriage(true);
    setLoadingActive(true);
    setLoadingTeams(true);

    const [dashRes, triageRes, activeRes, teamsRes] = await Promise.allSettled([
      api.get('/supervisor/dashboard'),
      api.get('/supervisor/reports/triage'),
      api.get('/supervisor/reports/active'),
      api.get('/supervisor/teams'),
    ]);

    if (dashRes.status === 'fulfilled' && dashRes.value.data.success) {
      setStats(dashRes.value.data.data);
    }
    if (triageRes.status === 'fulfilled' && triageRes.value.data.success) {
      setTriageReports(triageRes.value.data.data);
    }
    setLoadingTriage(false);

    if (activeRes.status === 'fulfilled' && activeRes.value.data.success) {
      setActiveReports(activeRes.value.data.data);
    }
    setLoadingActive(false);

    if (teamsRes.status === 'fulfilled' && teamsRes.value.data.success) {
      setTeams(teamsRes.value.data.data);
    }
    setLoadingTeams(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // After assigning a report: move it from triage to active list
  const handleAssigned = (updatedReport) => {
    setTriageReports((prev) => prev.filter((r) => r.id !== updatedReport.id));
    setActiveReports((prev) => [updatedReport, ...prev]);
    setStats((s) => s && { ...s, pending: s.pending - 1, assigned: s.assigned + 1 });
  };

  // After status update: refresh active list
  const handleStatusUpdated = (updatedReport) => {
    const finished = ['RESOLVED', 'CLOSED', 'REJECTED'].includes(updatedReport.status);
    setActiveReports((prev) =>
      finished
        ? prev.filter((r) => r.id !== updatedReport.id)
        : prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
    );
    if (stats) {
      setStats((s) => {
        if (!s) return s;
        const next = { ...s };
        // crude counter update
        if (updatedReport.status === 'IN_PROGRESS') { next.assigned = Math.max(0, s.assigned - 1); next.inProgress = s.inProgress + 1; }
        if (updatedReport.status === 'RESOLVED')    { next.inProgress = Math.max(0, s.inProgress - 1); next.resolved = s.resolved + 1; }
        if (updatedReport.status === 'CLOSED')      { next.resolved = Math.max(0, s.resolved - 1); next.closed = s.closed + 1; }
        return next;
      });
    }
  };

  const handleTeamCreated = (team) => {
    setTeams((prev) => [...prev, { ...team, activeTickets: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    setStats((s) => s && { ...s, totalTeams: s.totalTeams + 1, activeTeams: s.activeTeams + 1 });
  };

  const statCards = [
    { label: 'Pending', value: stats?.pending ?? '—', icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50' },
    { label: 'Assigned', value: stats?.assigned ?? '—', icon: HardHat,   color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'In Progress', value: stats?.inProgress ?? '—', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Resolved', value: stats?.resolved ?? '—', icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Active Teams', value: stats?.activeTeams ?? '—', icon: Users, color: 'text-[#0d3b5c]',  bg: 'bg-slate-50' },
  ];

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-slate-50">
        {/* Page header */}
        <div className="bg-[#0d3b5c] text-white px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield size={24} className="text-[#e8b923]" />
              <div>
                <h1 className="text-xl font-bold">Supervisor Dashboard</h1>
                <p className="text-white/60 text-sm">Triage · Assign · Track</p>
              </div>
            </div>
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
                <Icon size={20} className={color} />
                <div>
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Three-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* ── Column 1: Triage Queue ── */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h2 className="font-bold text-slate-800 text-sm">Triage Queue</h2>
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {triageReports.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[480px]">
                {loadingTriage ? (
                  <div className="flex justify-center py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : triageReports.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <CheckCircle size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Queue is clear</p>
                  </div>
                ) : (
                  triageReports.map((r) => (
                    <TriageCard key={r.id} report={r} onSelect={setAssignTarget} />
                  ))
                )}
              </div>
            </div>

            {/* ── Column 2: Active Reports ── */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-orange-500" />
                  <h2 className="font-bold text-slate-800 text-sm">Active Reports</h2>
                  <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {activeReports.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[480px]">
                {loadingActive ? (
                  <div className="flex justify-center py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : activeReports.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Wrench size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No active reports</p>
                  </div>
                ) : (
                  activeReports.map((r) => (
                    <ActiveCard key={r.id} report={r} onSelect={setStatusTarget} />
                  ))
                )}
              </div>
            </div>

            {/* ── Column 3: Teams Panel ── */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#0d3b5c]" />
                  <h2 className="font-bold text-slate-800 text-sm">Maintenance Crews</h2>
                  <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {teams.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowCreateTeam(true)}
                  className="flex items-center gap-1 text-xs text-[#0d3b5c] hover:bg-[#0d3b5c]/10 px-2.5 py-1.5 rounded-lg transition-colors font-semibold"
                >
                  <Plus size={13} />
                  New Crew
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[480px]">
                {loadingTeams ? (
                  <div className="flex justify-center py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : teams.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <HardHat size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No crews yet</p>
                    <button
                      onClick={() => setShowCreateTeam(true)}
                      className="mt-3 text-[#0d3b5c] text-xs font-semibold hover:underline"
                    >
                      Create the first crew
                    </button>
                  </div>
                ) : (
                  teams.map((t) => <TeamCard key={t.id} team={t} />)
                )}
              </div>
            </div>
          </div>

          {/* Audit trail hint */}
          <p className="text-center text-xs text-slate-400">
            All assignments and status changes are recorded in the system audit log accessible from the Admin Panel.
          </p>
        </div>
      </main>

      <Footer />

      {/* Modals */}
      {assignTarget && (
        <AssignModal
          report={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
      )}
      {statusTarget && (
        <StatusModal
          report={statusTarget}
          onClose={() => setStatusTarget(null)}
          onUpdated={handleStatusUpdated}
        />
      )}
      {showCreateTeam && (
        <CreateTeamModal
          onClose={() => setShowCreateTeam(false)}
          onCreated={handleTeamCreated}
        />
      )}
    </>
  );
}
