import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export function ProtectedRoute({ children, allowedRoles }) {
  const { isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="route-state">Restaurando sesión...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    // Redirección silenciosa a dashboard sin pantalla de error 403
    return <Navigate to="/dashboard" replace />;
  }

  return children || <Outlet />;
}