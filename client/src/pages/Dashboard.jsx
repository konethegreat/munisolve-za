// ==========================================
// DASHBOARD PAGE
// ==========================================
// User dashboard showing profile and reports
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#0d3b5c] p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-[#0d3b5c]">
                  Welcome, {user?.firstName}! 👋
                </h1>
                <p className="text-slate-600 mt-1">
                  Manage your reports and track municipal service issues.
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Logout
              </button>
            </div>

            {/* User Info Card */}
            <div className="bg-slate-50 rounded-lg p-6 mt-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Profile</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Full Name</p>
                  <p className="font-medium text-slate-800">
                    {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium text-slate-800">{user?.email}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium text-slate-800">{user?.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Account Type</p>
                  <p className="font-medium text-slate-800">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {user?.role}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <p className="font-medium text-slate-800">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user?.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user?.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Member Since</p>
                  <p className="font-medium text-slate-800">
                    {new Date(user?.createdAt).toLocaleDateString('en-ZA')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <button
              onClick={() => navigate('/report')}
              className="bg-white hover:bg-slate-50 rounded-xl shadow-lg border-t-4 border-[#1a5f3c] p-8 text-left transition-colors"
            >
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-xl font-bold text-[#0d3b5c] mb-2">Report a Fault</h3>
              <p className="text-slate-600">
                Submit a new municipal service issue in your area.
              </p>
            </button>

            <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#0d3b5c] p-8">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-[#0d3b5c] mb-2">Your Reports</h3>
              <p className="text-slate-600 mb-4">
                View and track all your submitted reports.
              </p>
              <p className="text-sm text-slate-500 italic">
                Report history feature coming soon...
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-[#0d3b5c] mb-6">Your Activity</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-6 bg-slate-50 rounded-lg">
                <p className="text-3xl font-bold text-[#0d3b5c]">0</p>
                <p className="text-slate-600 text-sm mt-2">Total Reports</p>
              </div>
              <div className="text-center p-6 bg-slate-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">0</p>
                <p className="text-slate-600 text-sm mt-2">Pending</p>
              </div>
              <div className="text-center p-6 bg-slate-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">0</p>
                <p className="text-slate-600 text-sm mt-2">Resolved</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 text-center mt-6 italic">
              Start by reporting your first fault! 🚀
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
