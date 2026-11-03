// ==========================================
// APP.JSX (Updated with Auth & Protected Routes)
// ==========================================
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import SupervisorRoute from './components/SupervisorRoute';

// The landing page is the entry point, so it stays in the initial bundle.
import LandingPage from './pages/LandingPage';

// Every other route loads on demand; the map stack is the heaviest dependency.
const About = lazy(() => import('./pages/About'));
const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ReportFault = lazy(() => import('./pages/ReportFault'));
const MapPage = lazy(() => import('./pages/MapPage'));
const Admin = lazy(() => import('./pages/Admin'));
const SupervisorDashboard = lazy(() => import('./pages/SupervisorDashboard'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ReportDetail = lazy(() => import('./pages/ReportDetail'));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status" aria-live="polite">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d3b5c] mx-auto mb-4" aria-hidden="true"></div>
        <p className="text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      {import.meta.env.VITE_DEMO_MODE === 'true' && (
        <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Local demo · fictional data · no real municipal submissions
        </div>
      )}
      <Suspense fallback={<PageFallback />}>
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
      </Suspense>
    </>
  );
}

export default App;
