import { useEffect, useMemo, useState } from 'react';
import { Shield, Trash2 } from 'lucide-react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const REPORT_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
];

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadgeClasses(status) {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'IN_PROGRESS':
      return 'bg-orange-100 text-orange-800';
    case 'RESOLVED':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function roleBadgeClasses(role) {
  switch (role) {
    case 'CITIZEN':
      return 'bg-slate-100 text-slate-700';
    case 'MUNICIPAL_ADMIN':
      return 'bg-blue-100 text-blue-800';
    case 'SUPER_ADMIN':
      return 'bg-[#0d3b5c]/10 text-[#0d3b5c]';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function normalize(str) {
  return String(str ?? '').trim().toLowerCase();
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState('REPORTS'); // REPORTS | USERS

  const [reports, setReports] = useState([]);
  const [reportsCount, setReportsCount] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('ALL'); // ALL | PENDING | IN_PROGRESS | RESOLVED
  const [reportUpdatingId, setReportUpdatingId] = useState(null);
  const [reportDeletingId, setReportDeletingId] = useState(null);

  const [users, setUsers] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  const fetchReports = async () => {
    try {
      setReportsError('');
      setReportsLoading(true);
      const { data } = await api.get('/admin/reports');
      if (data?.success) {
        setReports(Array.isArray(data.data) ? data.data : []);
        setReportsCount(typeof data.count === 'number' ? data.count : (data.data?.length ?? 0));
      } else {
        setReportsError(data?.message || 'Failed to load reports.');
      }
    } catch (err) {
      setReportsError(err.response?.data?.message || 'Failed to load reports. Please try again.');
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersError('');
      setUsersLoading(true);
      const { data } = await api.get('/admin/users');
      if (data?.success) {
        setUsers(Array.isArray(data.data) ? data.data : []);
        setUsersCount(typeof data.count === 'number' ? data.count : (data.data?.length ?? 0));
      } else {
        setUsersError(data?.message || 'Failed to load users.');
      }
    } catch (err) {
      setUsersError(err.response?.data?.message || 'Failed to load users. Please try again.');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    // Load current tab data on first render
    if (activeTab === 'REPORTS') fetchReports();
    if (activeTab === 'USERS') fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Lazy load when switching tabs
    if (activeTab === 'REPORTS' && reports.length === 0 && !reportsLoading && !reportsError) fetchReports();
    if (activeTab === 'USERS' && users.length === 0 && !usersLoading && !usersError) fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const reportStats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.status === 'PENDING').length;
    const inProgress = reports.filter((r) => r.status === 'IN_PROGRESS').length;
    const resolved = reports.filter((r) => r.status === 'RESOLVED').length;
    return { total, pending, inProgress, resolved };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const q = normalize(reportSearch);
    return reports.filter((r) => {
      const statusOk = reportStatusFilter === 'ALL' ? true : r.status === reportStatusFilter;
      if (!statusOk) return false;
      if (!q) return true;
      const category = normalize(r.category);
      const status = normalize(r.status);
      return category.includes(q) || status.includes(q);
    });
  }, [reports, reportSearch, reportStatusFilter]);

  const handleReportStatusChange = async (reportId, newStatus) => {
    setReportUpdatingId(reportId);
    setReportsError('');
    try {
      const { data } = await api.patch(`/admin/reports/${reportId}/status`, { status: newStatus });
      if (data?.success && data?.data) {
        setReports((prev) => prev.map((r) => (r.id === reportId ? data.data : r)));
      } else {
        setReportsError(data?.message || 'Failed to update report status.');
      }
    } catch (err) {
      setReportsError(err.response?.data?.message || 'Failed to update report status.');
    } finally {
      setReportUpdatingId(null);
    }
  };

  const handleReportDelete = async (reportId) => {
    const ok = window.confirm('Delete this report? This action cannot be undone.');
    if (!ok) return;

    setReportDeletingId(reportId);
    setReportsError('');
    try {
      const { data } = await api.delete(`/admin/reports/${reportId}`);
      if (data?.success) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        setReportsCount((c) => (typeof c === 'number' ? Math.max(0, c - 1) : c));
      } else {
        setReportsError(data?.message || 'Failed to delete report.');
      }
    } catch (err) {
      setReportsError(err.response?.data?.message || 'Failed to delete report.');
    } finally {
      setReportDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#0d3b5c]/10 flex items-center justify-center">
                  <Shield className="text-[#0d3b5c]" size={20} />
                </div>
                <h1 className="text-3xl font-bold text-[#0d3b5c]">Admin Panel</h1>
              </div>
              <p className="text-slate-500 mt-1">
                Manage reports and users.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('REPORTS')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'REPORTS'
                    ? 'bg-[#0d3b5c] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Reports
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('USERS')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'USERS'
                    ? 'bg-[#0d3b5c] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Users
              </button>
            </div>
          </div>

          {activeTab === 'REPORTS' && (
            <div className="space-y-6">
              {/* Summary Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 text-center">
                  <p className="text-3xl font-bold text-[#0d3b5c]">{reportStats.total}</p>
                  <p className="text-slate-500 text-sm mt-1">Total Reports</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 text-center">
                  <p className="text-3xl font-bold text-yellow-600">{reportStats.pending}</p>
                  <p className="text-slate-500 text-sm mt-1">Pending</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 text-center">
                  <p className="text-3xl font-bold text-orange-600">{reportStats.inProgress}</p>
                  <p className="text-slate-500 text-sm mt-1">In Progress</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 text-center">
                  <p className="text-3xl font-bold text-green-600">{reportStats.resolved}</p>
                  <p className="text-slate-500 text-sm mt-1">Resolved</p>
                </div>
              </div>

              {/* Filters + Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0d3b5c]">Reports</h2>
                    <p className="text-slate-500 text-sm mt-0.5">
                      {typeof reportsCount === 'number' ? `${reportsCount} total` : `${reports.length} total`}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <input
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      placeholder="Search by category or status…"
                      className="w-full sm:w-72 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#0d3b5c]"
                    />
                    <select
                      value={reportStatusFilter}
                      onChange={(e) => setReportStatusFilter(e.target.value)}
                      className="w-full sm:w-44 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0d3b5c]"
                    >
                      <option value="ALL">All statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                    <button
                      type="button"
                      onClick={fetchReports}
                      className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      ↻ Refresh
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {reportsLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0d3b5c] mx-auto mb-4" />
                      <p className="text-slate-500">Loading reports…</p>
                    </div>
                  ) : reportsError ? (
                    <div className="text-center py-12">
                      <p className="text-red-600 font-medium">{reportsError}</p>
                      <button
                        type="button"
                        onClick={fetchReports}
                        className="mt-3 text-sm text-[#0d3b5c] hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  ) : filteredReports.length === 0 ? (
                    <div className="text-center py-14">
                      <p className="text-4xl mb-3">📭</p>
                      <p className="text-slate-600 font-medium">No reports match your filters.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setReportSearch('');
                          setReportStatusFilter('ALL');
                        }}
                        className="mt-3 text-sm text-[#0d3b5c] hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-100">
                            <th className="py-3 pr-4 font-semibold">Reporter Name</th>
                            <th className="py-3 pr-4 font-semibold">Category</th>
                            <th className="py-3 pr-4 font-semibold">Address</th>
                            <th className="py-3 pr-4 font-semibold">Status</th>
                            <th className="py-3 pr-4 font-semibold">Date Submitted</th>
                            <th className="py-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredReports.map((r) => (
                            <tr key={r.id} className="text-slate-800 align-top">
                              <td className="py-4 pr-4">
                                <div className="font-medium">
                                  {r.user?.name || '—'}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {r.user?.email || ''}
                                </div>
                              </td>
                              <td className="py-4 pr-4">
                                <span className="text-slate-700">
                                  {String(r.category ?? '—').replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-4 pr-4 max-w-[28rem]">
                                <span className="text-slate-700">
                                  {r.address || '—'}
                                </span>
                              </td>
                              <td className="py-4 pr-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClasses(r.status)}`}>
                                  {String(r.status ?? '—').replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-4 pr-4 text-slate-600">
                                {formatDate(r.createdAt)}
                              </td>
                              <td className="py-4 text-right">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                                  <select
                                    value={r.status}
                                    disabled={reportUpdatingId === r.id}
                                    onChange={(e) => handleReportStatusChange(r.id, e.target.value)}
                                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0d3b5c] disabled:opacity-60"
                                  >
                                    {REPORT_STATUS_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleReportDelete(r.id)}
                                    disabled={reportDeletingId === r.id}
                                    className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-60"
                                  >
                                    <Trash2 size={16} />
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'USERS' && (
            <div className="space-y-6">
              {/* Users summary */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0d3b5c]">Users</h2>
                    <p className="text-slate-500 text-sm mt-0.5">
                      Total users: <span className="font-semibold text-slate-700">{usersCount || users.length}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchUsers}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {/* Users table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6">
                  {usersLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0d3b5c] mx-auto mb-4" />
                      <p className="text-slate-500">Loading users…</p>
                    </div>
                  ) : usersError ? (
                    <div className="text-center py-12">
                      <p className="text-red-600 font-medium">{usersError}</p>
                      <button
                        type="button"
                        onClick={fetchUsers}
                        className="mt-3 text-sm text-[#0d3b5c] hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-14">
                      <p className="text-4xl mb-3">👤</p>
                      <p className="text-slate-600 font-medium">No users found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-100">
                            <th className="py-3 pr-4 font-semibold">Name</th>
                            <th className="py-3 pr-4 font-semibold">Email</th>
                            <th className="py-3 pr-4 font-semibold">Role</th>
                            <th className="py-3 font-semibold">Joined Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {users.map((u) => (
                            <tr key={u.id} className="text-slate-800">
                              <td className="py-4 pr-4 font-medium">{u.name || '—'}</td>
                              <td className="py-4 pr-4 text-slate-700">{u.email || '—'}</td>
                              <td className="py-4 pr-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadgeClasses(u.role)}`}>
                                  {String(u.role ?? '—').replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-4 text-slate-600">{formatDate(u.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

