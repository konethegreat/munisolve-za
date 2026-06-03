import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const SUPERVISOR_ROLES = ['WORKER_SUPERVISOR', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN'];

export default function SupervisorRoute({ children }) {
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

  if (!SUPERVISOR_ROLES.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
