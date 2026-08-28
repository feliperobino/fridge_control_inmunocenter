import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export function ProtectedRoute({ children, allowedRoles }) {
  const { isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="route-state">Cargando...</div>;
  }

  // 1. Si no hay sesión iniciada, enviamos al usuario a iniciar sesión
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // 2. Si tiene sesión pero no el rol permitido, no mostramos el contenido de la página (no se renderiza nada)
  if (allowedRoles && !hasRole(allowedRoles)) {
    return null;
  }

  return children || <Outlet />;
}