import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { Layout } from './components/Layout.jsx';
import { PlaceholderPage } from './components/PlaceholderPage.jsx';
import AlarmsPage from './pages/AlarmsPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FridgeDetailPage from './pages/FridgeDetailPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

function HomeRedirect() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <PlaceholderPage title="Inmunocenter" subtitle="Restaurando sesión..." />;
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        {/* Ruta directa para Kiosk sin Layout alrededor */}
        <Route path="/dashboard/kiosk" element={<DashboardPage isKiosk={true} />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/fridges/:id" element={<FridgeDetailPage />} />
          <Route path="/alarms" element={<AlarmsPage />} />
          <Route path="/reports" element={<ReportsPage />} />

          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}