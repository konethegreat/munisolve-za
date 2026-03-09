// ==========================================
// DASHBOARD PAGE - FULLY FUNCTIONAL
// ==========================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ReportCard from '../components/ReportCard';
import IncidentMap from '../components/IncidentMap';

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  // Fetch reports on mount
  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/reports');
      if (data.success) {
        setReports(data.data);
      }
    } catch (err) {
      setError('Failed to load reports. Please refresh.');
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // Remove deleted report from state
  const handleDelete = (deletedId) => {
    setReports((prev) => prev.filter((r) => r.id !== deletedId));
  };

  // Logout
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // ==========================================
  // STATS CALCULATION
  // ==========================================
  const stats = {
    total:      reports.length,
    pending:    reports.filter((r) => r.status === 'PENDING').length,
    inProgress: reports.filter((r) => r.status === 'IN_PROGRESS').length,
    resolved:   reports.filter((r) => r.status === 'RESOLVED').length,
  };

  // ==========================================
  // FILTERED REPORTS
  // ==========================================
  const filteredReports = activeTab === 'ALL'
    ? reports
    : reports.filter((r) => r.status === activeTab);

  // ==========================================
  // TABS CONFIG
  // ==========================================
  const tabs = [
    { key: 'ALL',         label: `All (${stats.total})` },
    { key: 'PENDING',     label: `Pending (${stats.pending})` },
    { key: 'IN_PROGRESS', label: `In Progress (${stats.inProgress})` },
    { key: 'RESOLVED',    label: `Resolved (${stats.resolved})` },
  ];

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 px-4 py-10">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ================================ */}
          {/* HEADER */}
          {/* ================================ */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#0d3b5c]">
                Welcome back, {user?.firstName}! 👋
              </h1>
              <p className="text-slate-500 mt-1">
                Here's a summary of your reported faults.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/report')}
                className="bg-[#1a5f3c] hover:bg-[#145230] text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
              >
                + New Report
              </button>
              <button
                onClick={handleLogout}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          {/* ================================ */}
          {/* STATS CARDS */}
          {/* ================================ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 text-center">
              <p className="text-3xl font-bold text-[#0d3b5c]">{stats.total}</p>
              <p className="text-slate-500 text-sm mt-1">Total Reports</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 text-center">
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-slate-500 text-sm mt-1">Pending</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
              <p className="text-slate-500 text-sm mt-1">In Progress</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 text-center">
              <p className="text-3xl font-bold text-green-600">{stats.resolved}</p>
              <p className="text-slate-500 text-sm mt-1">Resolved</p>
            </div>
          </div>

          {/* ================================ */}
          {/* INCIDENT MAP */}
          {/* ================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0d3b5c]">Incident Map</h2>
              <p className="text-slate-500 text-sm mt-0.5">
                Reports with location (Johannesburg area)
              </p>
            </div>
            <div className="w-full">
              <IncidentMap reports={reports} />
            </div>
          </div>

          {/* ================================ */}
          {/* REPORTS SECTION */}
          {/* ================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            {/* Section Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0d3b5c]">Your Reports</h2>
              <button
                onClick={fetchReports}
                className="text-sm text-[#0d3b5c] hover:underline"
              >
                ↻ Refresh
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-6 pt-4 flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.key
                      ? 'bg-[#0d3b5c] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Report List */}
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0d3b5c] mx-auto mb-4"></div>
                  <p className="text-slate-500">Loading your reports...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-red-500">{error}</p>
                  <button
                    onClick={fetchReports}
                    className="mt-3 text-sm text-[#0d3b5c] hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-4">📭</p>
                  <p className="text-slate-600 font-medium">
                    {activeTab === 'ALL'
                      ? 'No reports yet.'
                      : `No ${activeTab.toLowerCase().replace('_', ' ')} reports.`}
                  </p>
                  {activeTab === 'ALL' && (
                    <button
                      onClick={() => navigate('/report')}
                      className="mt-4 bg-[#0d3b5c] hover:bg-[#0a2d45] text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors"
                    >
                      Submit your first report
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ================================ */}
          {/* PROFILE CARD */}
          {/* ================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-[#0d3b5c] mb-4">Your Profile</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Full Name</p>
                <p className="font-medium text-slate-800">{user?.firstName} {user?.lastName}</p>
              </div>
              <div>
                <p className="text-slate-400">Email</p>
                <p className="font-medium text-slate-800">{user?.email}</p>
              </div>
              <div>
                <p className="text-slate-400">Phone</p>
                <p className="font-medium text-slate-800">{user?.phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-slate-400">Role</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user?.role}
                </span>
              </div>
              <div>
                <p className="text-slate-400">Member Since</p>
                <p className="font-medium text-slate-800">
                  {new Date(user?.createdAt).toLocaleDateString('en-ZA')}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Status</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
