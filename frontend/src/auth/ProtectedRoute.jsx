import { useAuth } from './AuthContext.jsx';

export function ProtectedRoute({ children, allowedRoles }) {
  const { isLoading, user, hasRole } = useAuth();

  if (isLoading) {
    return <div className="route-state">Cargando...</div>;
  }

  // Si no hay usuario autenticado o no posee el rol requerido, no se renderiza nada
  if (!user || (allowedRoles && !hasRole(allowedRoles))) {
    return null;
  }

  return children || null;
}