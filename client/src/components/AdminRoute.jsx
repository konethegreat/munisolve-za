// ==========================================
// ADMIN ROUTE COMPONENT
// ==========================================
// Redirects:
// - to /login if user is not authenticated
// - to /dashboard if user is authenticated but not an admin
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ADMIN_ROLES = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'];

export default function AdminRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d3b5c] mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = user?.role;
  const isAdmin = ADMIN_ROLES.includes(role);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

