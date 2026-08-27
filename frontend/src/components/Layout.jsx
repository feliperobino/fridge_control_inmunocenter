import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/alarms', label: 'Alarmas' },
  { to: '/reports', label: 'Reportes' }
];

export function Layout() {
  const { logout, user } = useAuth();
  const [searchParams] = useSearchParams();
  const isKiosk = searchParams.get('fullscreen') === '1' || window.location.pathname === '/dashboard/kiosk';

  // Si estamos en modo Kiosk, renderizamos el contenido directamente sin el cascarón de la UI
  if (isKiosk) {
    return (
      <div className="kiosk-layout-container">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-kicker">Fridge Monitor</span>
          <h1>Control central</h1>
          <p>Lecturas, alarmas y reportes en un solo lugar.</p>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}

          {user?.role === 'ADMIN' ? (
            <NavLink
              to="/users"
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
            >
              Usuarios
            </NavLink>
          ) : null}
        </nav>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <span className="topbar-label">Sesión activa</span>
            <strong>{user?.email}</strong>
          </div>

          <div className="topbar-actions">
            <span className={`role-pill role-${user?.role?.toLowerCase() || 'guest'}`}>{user?.role}</span>
            <button className="button button-secondary" type="button" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}