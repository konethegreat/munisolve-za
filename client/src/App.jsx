// ==========================================
// APP.JSX (Updated with Auth & Protected Routes)
// ==========================================
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import SupervisorRoute from './components/SupervisorRoute';
import ReportDetail from './pages/ReportDetail';

// Pages
import LandingPage from './pages/LandingPage';
import About from './pages/About';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ReportFault from './pages/ReportFault';
import MapPage from './pages/MapPage';
import Admin from './pages/Admin';
import SupervisorDashboard from './pages/SupervisorDashboard';
import VerifyEmail from './pages/VerifyEmail';

function App() {
  return (
    <AuthProvider>
      {import.meta.env.VITE_DEMO_MODE === 'true' && (
        <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Local demo · fictional data · no real municipal submissions
        </div>
      )}
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reports/:id" element={<ProtectedRoute><ReportDetail /></ProtectedRoute>} />

        {/* Protected Routes - Require Authentication */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <ReportFault />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route
          path="/supervisor"
          element={
            <SupervisorRoute>
              <SupervisorDashboard />
            </SupervisorRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
