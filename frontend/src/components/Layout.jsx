import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';

// Icon SVG dạng line-art (màu điều khiển qua currentColor)
const icons = {
  performance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="7.5" height="9.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
      <rect x="13.5" y="12" width="7.5" height="9" rx="2" />
      <rect x="3" y="15.5" width="7.5" height="5.5" rx="2" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M15.8 14.6c2.2.5 4.4 2.3 4.9 5.4" />
    </svg>
  ),
  profiles: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M12 13l7 3.9-7 6.6-7-6.6L12 13z" opacity="0.5" />
      <path d="M21 8v5M3 8v5" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M2.5 10c5.2-4.6 13.8-4.6 19 0" />
      <path d="M5.5 14c3.6-3.2 9.4-3.2 13 0" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  router: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <circle cx="6.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <path d="M16 10.5h3M16 13.5h2" />
      <path d="M7 16v3M12 16v3" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
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
};

const NAV = [
  { to: '/performance', label: 'Hiệu năng Router', icon: 'performance', end: true },
  { to: '/', label: 'Tổng quan Hotspot', icon: 'dashboard', end: true },
  { to: '/users', label: 'Người dùng', icon: 'users', end: false },
  { to: '/profiles', label: 'Hồ sơ', icon: 'profiles', end: false },
  { to: '/sessions', label: 'Phiên hoạt động', icon: 'sessions', end: false },
];

export default function Layout() {
  const { user, role, fullName, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative min-h-screen">
      {/* Ambient background orbs */}
      <div className="orb orb-cyan" />
      <div className="orb orb-magenta" />
      <div className="orb orb-violet" />

      {/* Navigation Rail — kính mờ */}
      <aside className="glass fixed inset-y-0 left-0 z-30 flex w-64 flex-col">
        <div className="flex items-center gap-3 border-b border-white/50 px-6 py-6">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#00a2ff] text-white shadow-[0_0_22px_rgba(0,132,255,0.55)]">
            {icons.router}
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight text-ink">
              Hotspot Admin
            </div>
            <div className="label-caps mt-0.5">MikroTik · RouterOS 7</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-6">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {({ isActive }) => (
                <span
                  className={`relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-ink-soft hover:bg-white/60 hover:text-ink'
                  }`}
                >
                  {/* Thanh neon bên trái khi active */}
                  {isActive && (
                    <span className="absolute -left-1 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_rgba(0,132,255,0.9)]" />
                  )}
                  {icons[item.icon]}
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Khối phía dưới: Cài đặt + Trạng thái kết nối + User */}
        <div className="border-t border-white/50 px-4 py-4">
          <div className="mb-3">
            <NavLink to="/settings">
              {({ isActive }) => (
                <span
                  className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-ink-soft hover:bg-white/60 hover:text-ink'
                  }`}
                >
                  {isActive && (
                    <span className="absolute -left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_rgba(0,132,255,0.9)]" />
                  )}
                  {icons.settings}
                  Cài đặt
                </span>
              )}
            </NavLink>
          </div>

          <div className="px-2">
            <ConnectionStatus />
            <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-white/30 pt-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-bold text-ink">
                  {fullName || user || 'admin'}
                </span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      role === 'admin'
                        ? 'bg-primary shadow-[0_0_6px_rgba(0,132,255,0.8)]'
                        : role === 'operator'
                        ? 'bg-warning shadow-[0_0_6px_rgba(217,119,6,0.8)]'
                        : 'bg-tertiary shadow-[0_0_6px_rgba(124,58,237,0.8)]'
                    }`}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                    {role === 'admin'
                      ? 'Quản trị (full)'
                      : role === 'operator'
                      ? 'Nhân viên (write)'
                      : 'Giám sát (read)'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-faint transition hover:bg-danger-soft hover:text-danger"
                title="Đăng xuất"
              >
                {icons.logout}
                Thoát
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Nội dung */}
      <main className="relative z-10 pl-64">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}