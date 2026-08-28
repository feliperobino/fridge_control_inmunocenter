import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/alarms', label: 'Alarmas' },
  { to: '/reports', label: 'Reportes' },
  { to: '/users', label: 'Usuarios', roles: ['ADMIN'] }
];

export function Layout() {
  const { logout, user, hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const isKiosk = searchParams.get('fullscreen') === '1' || window.location.pathname === '/dashboard/kiosk';

  if (isKiosk) {
    return (
      <div className="kiosk-layout-container">
        <Outlet />
      </div>
    );
  }

  // Filtro estricto: solo incluir ítems del menú permitidos para el rol actual
  const visibleNavItems = navItems.filter(
    (item) => !item.roles || hasRole(item.roles)
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-kicker">Fridge Monitor</span>
          <h1>Control central</h1>
          <p>Lecturas, alarmas y reportes en un solo lugar.</p>
        </div>

        <nav className="nav-links">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
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