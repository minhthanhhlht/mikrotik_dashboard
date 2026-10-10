import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface TopBarProps {
  connectionState: string
  connectionLabel: string
  connectionDetail?: string
  theme: 'dark' | 'light'
  isEditMode?: boolean
  onToggleTheme: () => void
  onToggleEditMode?: () => void
  onOpenConnect: () => void
  onToggleMenu: () => void
  onLogout?: () => void
}

function LogoutIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function MoonIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function SettingsIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function MenuIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

/**
 * TopBar / PageTopbar chuẩn ServerKit
 */
export default function TopBar({
  connectionState,
  connectionLabel,
  connectionDetail,
  theme,
  isEditMode = false,
  onToggleTheme,
  onToggleEditMode,
  onOpenConnect,
  onToggleMenu,
  onLogout,
}: TopBarProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const time = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const date = now.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  // Chọn pill class theo trạng thái
  const getPillClass = () => {
    switch (connectionState) {
      case 'connected':
        return 'sk-pill--green'
      case 'connecting':
        return 'sk-pill--amber'
      case 'disconnected':
        return 'sk-pill--red'
      default:
        return 'sk-pill--violet'
    }
  }

  return (
    <header
      style={{
        backgroundColor: 'var(--surface-0)',
        borderColor: 'var(--border-soft)',
        zIndex: 20,
      }}
      className="sticky top-0 flex h-16 items-center justify-between border-b px-4 sm:px-6"
    >
      {/* Left: Mobile toggle + Realtime clock */}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-label="Menu"
          onClick={onToggleMenu}
          className="btn btn-soft btn-sm btn-icon lg:hidden"
        >
          <MenuIcon />
        </button>

        <div className="flex items-baseline gap-2">
          <span
            style={{ color: 'var(--text)' }}
            className="font-mono text-sm sm:text-base font-bold tracking-tight"
          >
            {time}
          </span>
          <span
            style={{ color: 'var(--text-faint)' }}
            className="hidden font-mono text-[11px] uppercase tracking-wider sm:inline font-medium"
          >
            · {date}
          </span>
        </div>
      </div>

      {/* Right: Connection status pill + Host Mono chip + Edit Toggle + Theme Toggle + Config action + Logout */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {connectionDetail && (
          <span
            style={{ color: 'var(--text-dim)' }}
            className="hidden max-w-[180px] truncate font-mono text-xs md:inline"
          >
            {connectionDetail}
          </span>
        )}

        <button
          type="button"
          onClick={onOpenConnect}
          title="Bấm để cấu hình kết nối"
          className={`sk-pill ${getPillClass()} cursor-pointer hover:opacity-90`}
        >
          <span className="sk-pill__dot" />
          <span>{connectionLabel}</span>
        </button>

        {onToggleEditMode && (
          <button
            type="button"
            onClick={onToggleEditMode}
            title={isEditMode ? 'Thoát chế độ sửa' : 'Bật chế độ sửa giao diện (Storage Mode)'}
            style={{
              backgroundColor: isEditMode ? 'var(--accent)' : 'transparent',
              color: isEditMode ? 'var(--accent-contrast, #000)' : 'var(--text)',
              borderColor: isEditMode ? 'var(--accent)' : 'var(--border)',
            }}
            className={`btn btn-sm flex items-center gap-1.5 font-medium transition-all ${
              isEditMode ? 'font-semibold shadow-sm' : 'hover:border-[var(--border-strong)]'
            }`}
          >
            <span>{isEditMode ? '✓ Đang sửa' : '✏️ Sửa'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          title="Đổi giao diện Dark/Light"
          className="btn btn-soft btn-sm btn-icon hidden sm:inline-flex"
        >
          {theme === 'dark' ? (
            <span style={{ color: '#a78bfa' }}>
              <MoonIcon />
            </span>
          ) : (
            <span style={{ color: '#fbbf24' }}>
              <SunIcon />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenConnect}
          className="btn btn-secondary btn-sm flex items-center gap-1.5"
        >
          <span style={{ color: '#14b8a6' }}>
            <SettingsIcon />
          </span>
          <span className="hidden sm:inline">Cài đặt</span>
        </button>

        <Link
          to="/"
          title="Quay lại Dashboard MikroTik Hotspot & Infra Console"
          className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold text-xs shadow-sm text-white"
        >
          <span>📶</span>
          <span>Về MikroTik</span>
        </Link>

        <Link
          to="/hass"
          title="Chuyển sang Giám Sát Hạ Tầng HassOS"
          className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs text-[var(--accent-bright)] hover:border-[var(--accent)]"
        >
          <span>⚡</span>
          <span className="hidden md:inline">Hạ Tầng HassOS</span>
        </Link>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Đăng xuất khỏi Home Assistant"
            style={{ color: '#ef4444' }}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)]"
          >
            <LogoutIcon />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        )}
      </div>
    </header>
  )
}
