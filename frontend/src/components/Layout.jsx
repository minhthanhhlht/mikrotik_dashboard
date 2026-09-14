import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';

const icons = {
  performance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="3" y="3" width="7.5" height="9.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
      <rect x="13.5" y="12" width="7.5" height="9" rx="2" />
      <rect x="3" y="15.5" width="7.5" height="5.5" rx="2" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M15.8 14.6c2.2.5 4.4 2.3 4.9 5.4" />
    </svg>
  ),
  profiles: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M12 13l7 3.9-7 6.6-7-6.6L12 13z" opacity="0.6" />
      <path d="M21 8v5M3 8v5" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M2.5 10c5.2-4.6 13.8-4.6 19 0" />
      <path d="M5.5 14c3.6-3.2 9.4-3.2 13 0" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  proxmox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="2" y="3" width="20" height="7" rx="2" />
      <rect x="2" y="14" width="20" height="7" rx="2" />
      <circle cx="6" cy="6.5" r="1" fill="currentColor" />
      <circle cx="6" cy="17.5" r="1" fill="currentColor" />
      <path d="M11 6.5h7M11 17.5h7" />
    </svg>
  ),
  hass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1v-9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  router: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <circle cx="6.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <path d="M16 10.5h3M16 13.5h2" />
      <path d="M7 16v3M12 16v3" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  ),
};

const NAV_GROUPS = [
  {
    title: 'GIÁM SÁT HẠ TẦNG',
    items: [
      { to: '/performance', label: 'Hiệu năng RouterOS', icon: 'performance', end: true },
      { to: '/proxmox', label: 'Proxmox Hypervisor', icon: 'proxmox', end: true },
      { to: '/hass', label: 'Home Assistant OS', icon: 'hass', end: true },
    ],
  },
  {
    title: 'QUẢN TRỊ HOTSPOT',
    items: [
      { to: '/', label: 'Tổng quan Hotspot', icon: 'dashboard', end: true },
      { to: '/users', label: 'Người dùng Hotspot', icon: 'users', end: false },
      { to: '/profiles', label: 'Hồ sơ gói cước', icon: 'profiles', end: false },
      { to: '/sessions', label: 'Phiên hoạt động', icon: 'sessions', end: false },
    ],
  },
];

export default function Layout() {
  const { user, role, fullName, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text)]">
      {/* Mobile Top Navbar (<= 768px) */}
      <div className="md:hidden flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--bg-sidebar)] px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-white">
            {icons.router}
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text)]">Hotspot Console</div>
            <div className="text-[10px] font-mono text-[var(--text-faint)]">RouterOS 7</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="btn-icon btn-sm btn-ghost"
            title="Đổi giao diện Sáng / Tối"
          >
            {theme === 'dark' ? icons.sun : icons.moon}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="btn-icon btn-sm btn-secondary"
            aria-label="Toggle Navigation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[1140] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Fixed Sidebar Architecture (250px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-[1150] md:z-30 flex w-[250px] flex-col border-r border-[var(--border-soft)] bg-[var(--bg-sidebar)] transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-[var(--border-soft)] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-white shadow-[0_0_14px_var(--accent-glow)]">
            {icons.router}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-[var(--text)] truncate">
              Hotspot Console
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="sk-tag sk-tag--prod text-[9px] py-0 px-1">ROS 7</span>
              <span className="text-[10px] font-mono text-[var(--text-faint)] truncate">REST API</span>
            </div>
          </div>
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[var(--accent-bg)] text-[var(--accent-bright)] font-semibold'
                          : 'text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={isActive ? 'text-[var(--accent-bright)]' : 'text-[var(--text-faint)] group-hover:text-[var(--text)]'}>
                          {icons[item.icon]}
                        </span>
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {/* Settings Nav Item */}
          <div>
            <div className="px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
              HỆ THỐNG
            </div>
            <NavLink
              to="/settings"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-bright)] font-semibold'
                    : 'text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-[var(--accent-bright)]' : 'text-[var(--text-faint)] group-hover:text-[var(--text)]'}>
                    {icons.settings}
                  </span>
                  <span>Cài đặt hệ thống</span>
                </>
              )}
            </NavLink>
          </div>
        </nav>

        {/* Sidebar Footer Area */}
        <div className="border-t border-[var(--border-soft)] bg-[var(--surface-0)] p-3 space-y-2.5">
          {/* Theme Switcher Button */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase">Giao diện</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
              title="Nhấn để đổi Sáng / Tối"
            >
              {theme === 'dark' ? (
                <>
                  {icons.sun} <span>Light Mode</span>
                </>
              ) : (
                <>
                  {icons.moon} <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>

          <ConnectionStatus />

          {/* User Account & Logout */}
          <div className="flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2.5">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-[var(--text)]">
                {fullName || user || 'admin'}
              </div>
              <div className="mt-0.5">
                <span
                  className={`sk-state text-[9px] py-0 px-1.5 ${
                    role === 'admin'
                      ? 'sk-state--accent'
                      : role === 'operator'
                      ? 'sk-state--amber'
                      : 'sk-state--cyan'
                  }`}
                >
                  {role === 'admin' ? 'ADMIN (FULL)' : role === 'operator' ? 'WRITE' : 'READ'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="btn-icon btn-sm btn-ghost text-[var(--red)] hover:bg-[var(--red-bg)]"
              title="Đăng xuất"
            >
              {icons.logout}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-[250px] min-h-screen bg-grid p-6 md:p-8 lg:p-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}