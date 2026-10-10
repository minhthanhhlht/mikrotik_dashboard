import React from 'react'
import { Link } from 'react-router-dom'
import type { DashboardViewConfig } from '../../lib/storageTypes'

export type ViewId = string

interface NavItemDef {
  id: string
  label: string
  icon: string
  category?: string
}

/* ==========================================================================
   SVG ICONS ĐỒNG BỘ CHUẨN SERVERKIT (currentColor)
   ========================================================================== */

function OverviewIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

function RoomsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ClimateIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  )
}

function MediaIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function SecurityIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function EnergyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function GenericTabIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

function SettingsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

function TrashIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function LogoutIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

const ICON_COLORS: Record<string, { color: string; bg: string }> = {
  overview: { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
  rooms: { color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)' },
  climate: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  media: { color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)' },
  security: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  energy: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  settings: { color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)' },
  default: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
}

function renderViewIcon(iconId: string, className = 'w-4 h-4', asBadge = true) {
  const meta = ICON_COLORS[iconId] || ICON_COLORS.default

  let iconNode: React.ReactNode
  switch (iconId) {
    case 'overview':
      iconNode = <OverviewIcon className={className} />
      break
    case 'rooms':
      iconNode = <RoomsIcon className={className} />
      break
    case 'climate':
      iconNode = <ClimateIcon className={className} />
      break
    case 'media':
      iconNode = <MediaIcon className={className} />
      break
    case 'security':
      iconNode = <SecurityIcon className={className} />
      break
    case 'energy':
      iconNode = <EnergyIcon className={className} />
      break
    default:
      iconNode = <GenericTabIcon className={className} />
  }

  if (asBadge) {
    return (
      <span
        style={{
          color: meta.color,
          backgroundColor: meta.bg,
          border: `1px solid ${meta.color}30`,
        }}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] shadow-sm transition-transform group-hover:scale-105"
      >
        {iconNode}
      </span>
    )
  }

  return <span style={{ color: meta.color }}>{iconNode}</span>
}

const DEFAULT_ITEMS: NavItemDef[] = [
  { id: 'overview', label: 'Tổng quan', icon: 'overview', category: 'BẢNG ĐIỀU KHIỂN' },
  { id: 'tang_1', label: 'Tầng 1', icon: 'rooms', category: 'BẢNG ĐIỀU KHIỂN' },
  { id: 'tang_2', label: 'Tầng 2', icon: 'rooms', category: 'BẢNG ĐIỀU KHIỂN' },
  { id: 'tang_3', label: 'Tầng 3', icon: 'rooms', category: 'BẢNG ĐIỀU KHIỂN' },
  { id: 'tang_tum', label: 'Tầng tum', icon: 'rooms', category: 'BẢNG ĐIỀU KHIỂN' },
  { id: 'climate', label: 'Khí hậu & Điều hòa', icon: 'climate', category: 'HẠ TẦNG & THIẾT BỊ' },
  { id: 'security', label: 'An ninh & Cửa', icon: 'security', category: 'HẠ TẦNG & THIẾT BỊ' },
  { id: 'energy', label: 'Năng lượng & Điện', icon: 'energy', category: 'HẠ TẦNG & THIẾT BỊ' },
]

interface NavigationRailProps {
  active: string
  onChange: (view: string) => void
  connectionDot: string
  connectionLabel: string
  theme: 'dark' | 'light'
  views?: DashboardViewConfig[]
  isEditMode?: boolean
  onAddView?: () => void
  onDeleteView?: (viewId: string) => void
  onToggleTheme: () => void
  onLogout?: () => void
}

/**
 * Sidebar Console Chuẩn ServerKit (250px Desktop, Bottom Bar Mobile)
 */
export default function NavigationRail({
  active,
  onChange,
  connectionDot,
  connectionLabel,
  theme,
  views,
  isEditMode = false,
  onAddView,
  onDeleteView,
  onToggleTheme,
  onLogout,
}: NavigationRailProps) {
  // Chuyển đổi dynamic views nếu có
  const items: NavItemDef[] = React.useMemo(() => {
    if (!views || views.length === 0) return DEFAULT_ITEMS
    return views.map((v) => ({
      id: v.id,
      label: v.title,
      icon: v.icon || 'overview',
      category: v.category || 'BẢNG ĐIỀU KHIỂN',
    }))
  }, [views])

  const dashboardItems = items.filter((i) => (i.category || 'BẢNG ĐIỀU KHIỂN') === 'BẢNG ĐIỀU KHIỂN' || i.category === 'DASHBOARD')
  const systemItems = items.filter((i) => i.category === 'HẠ TẦNG & THIẾT BỊ' || i.category === 'HỆ THỐNG')
  const otherItems = items.filter(
    (i) =>
      i.category &&
      i.category !== 'BẢNG ĐIỀU KHIỂN' &&
      i.category !== 'DASHBOARD' &&
      i.category !== 'HẠ TẦNG & THIẾT BỊ' &&
      i.category !== 'HỆ THỐNG',
  )

  return (
    <>
      {/* Desktop Sidebar (250px) */}
      <aside
        style={{
          width: '250px',
          backgroundColor: 'var(--bg-sidebar)',
          borderColor: 'var(--border-soft)',
        }}
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r lg:flex"
      >
        {/* Brand Header */}
        <div
          style={{ borderColor: 'var(--border-soft)' }}
          className="flex h-16 items-center justify-between border-b px-4"
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: 'var(--accent-bg)',
                borderColor: 'var(--accent-dim)',
                color: 'var(--accent-bright)',
              }}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border font-mono text-xs font-bold"
            >
              HA
            </div>
            <div>
              <span className="font-bold tracking-tight text-sm block leading-tight text-[var(--text)]">
                MY HOME
              </span>
              <span className="font-mono text-[10px] block leading-tight text-[var(--text-faint)]">
                v1.0 CONSOLE
              </span>
            </div>
          </div>

          <a
            href="/"
            title="Quay lại Dashboard MikroTik Hotspot"
            className="sk-tag sk-tag--dev font-mono text-[9px] tracking-wider hover:bg-[var(--accent-bg)] hover:text-[var(--accent-bright)] transition-colors cursor-pointer"
          >
            ← MikroTik
          </a>
        </div>

        {/* Navigation Item Groups */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* Main Dashboard Section */}
          <div>
            <div className="flex items-center justify-between px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
              <span>BẢNG ĐIỀU KHIỂN</span>
              {isEditMode && onAddView && (
                <button
                  type="button"
                  onClick={onAddView}
                  title="Thêm Tab / Không gian mới"
                  className="btn btn-ghost btn-xs btn-icon text-[var(--accent-bright)]"
                >
                  +
                </button>
              )}
            </div>

            <div className="space-y-0.5">
              {dashboardItems.map((item) => {
                const isActive = item.id === active
                return (
                  <div key={item.id} className="group relative flex items-center">
                    <button
                      type="button"
                      onClick={() => onChange(item.id)}
                      style={{
                        backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent',
                        color: isActive ? 'var(--accent-bright)' : 'var(--text-dim)',
                      }}
                      className={[
                        'group flex flex-1 items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-medium transition-all text-left',
                        isActive
                          ? 'font-semibold'
                          : 'hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
                      ].join(' ')}
                    >
                      <span className="flex-shrink-0">
                        {renderViewIcon(item.icon, 'w-3.5 h-3.5', true)}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>

                    {isEditMode && onDeleteView && item.id !== 'tang_1' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Bạn có chắc muốn xóa không gian "${item.label}"?`)) {
                            onDeleteView(item.id)
                          }
                        }}
                        title={`Xóa tab ${item.label}`}
                        className="btn btn-ghost btn-xs btn-icon text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* System Infrastructure Section */}
          {systemItems.length > 0 && (
            <div>
              <div className="px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                HẠ TẦNG & THIẾT BỊ
              </div>
              <div className="space-y-0.5">
                {systemItems.map((item) => {
                  const isActive = item.id === active
                  return (
                    <div key={item.id} className="group relative flex items-center">
                      <button
                        type="button"
                        onClick={() => onChange(item.id)}
                        style={{
                          backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent',
                          color: isActive ? 'var(--accent-bright)' : 'var(--text-dim)',
                        }}
                        className={[
                          'group flex flex-1 items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-medium transition-all text-left',
                          isActive
                            ? 'font-semibold'
                            : 'hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        <span className="flex-shrink-0">
                          {renderViewIcon(item.icon, 'w-3.5 h-3.5', true)}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>

                      {isEditMode && onDeleteView && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Bạn có chắc muốn xóa không gian "${item.label}"?`)) {
                              onDeleteView(item.id)
                            }
                          }}
                          title={`Xóa tab ${item.label}`}
                          className="btn btn-ghost btn-xs btn-icon text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Other custom groups */}
          {otherItems.length > 0 && (
            <div>
              <div className="px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                TÙY CHỈNH KHÁC
              </div>
              <div className="space-y-0.5">
                {otherItems.map((item) => {
                  const isActive = item.id === active
                  return (
                    <div key={item.id} className="group relative flex items-center">
                      <button
                        type="button"
                        onClick={() => onChange(item.id)}
                        style={{
                          backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent',
                          color: isActive ? 'var(--accent-bright)' : 'var(--text-dim)',
                        }}
                        className={[
                          'group flex flex-1 items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-medium transition-all text-left',
                          isActive
                            ? 'font-semibold'
                            : 'hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        <span className="flex-shrink-0">
                          {renderViewIcon(item.icon, 'w-3.5 h-3.5', true)}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>

                      {isEditMode && onDeleteView && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Bạn có chắc muốn xóa không gian "${item.label}"?`)) {
                              onDeleteView(item.id)
                            }
                          }}
                          title={`Xóa tab ${item.label}`}
                          className="btn btn-ghost btn-xs btn-icon text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions: Connection Pill + Theme Toggle + Settings + Logout */}
        <div
          style={{ borderColor: 'var(--border-soft)' }}
          className="border-t p-3.5 space-y-2"
        >
          <div className="flex items-center justify-between px-3 py-1 text-xs font-mono">
            <span style={{ color: 'var(--text-faint)' }}>STATUS:</span>
            <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-dim)' }}>
              <span className={`h-2.5 w-2.5 rounded-full ${connectionDot}`} />
              <span>{connectionLabel}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            style={{ color: 'var(--text-dim)' }}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
          >
            <span className="flex items-center gap-2.5 font-medium">
              <span
                style={{
                  color: theme === 'dark' ? '#a78bfa' : '#fbbf24',
                  backgroundColor: theme === 'dark' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                  border: `1px solid ${theme === 'dark' ? 'rgba(167, 139, 250, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm"
              >
                {theme === 'dark' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
              </span>
              <span>Giao diện</span>
            </span>
            <span className="sk-state font-mono text-[10px] uppercase">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChange('settings')}
            style={{
              backgroundColor: active === 'settings' ? 'var(--accent-bg)' : 'transparent',
              color: active === 'settings' ? 'var(--accent-bright)' : 'var(--text-dim)',
              borderColor: active === 'settings' ? 'var(--accent)' : 'transparent',
            }}
            className={[
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all border-l-2',
              active === 'settings' ? 'font-semibold' : 'hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
            ].join(' ')}
          >
            <span
              style={{
                color: '#14b8a6',
                backgroundColor: 'rgba(20, 184, 166, 0.15)',
                border: '1px solid rgba(20, 184, 166, 0.3)',
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm"
            >
              <SettingsIcon className="w-4 h-4" />
            </span>
            <span>Cài đặt kết nối</span>
          </button>

          {/* Core Infrastructure Links */}
          <div className="pt-2 border-t border-[var(--border-soft)] space-y-1.5">
            <Link
              to="/"
              title="Quay lại Dashboard Quản Trị MikroTik Hotspot"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold transition-all text-white bg-[var(--accent)] hover:opacity-90 shadow-sm"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-white/20 text-xs">
                📶
              </span>
              <span>← Về MikroTik Dashboard</span>
            </Link>
            <Link
              to="/hass"
              title="Quay lại Trang Giám Sát Hạ Tầng HassOS"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-[rgba(109,124,255,0.15)] text-[var(--accent-bright)] text-xs">
                ⚡
              </span>
              <span>Hạ tầng HassOS</span>
            </Link>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{ color: 'var(--red)' }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--red)]"
            >
              <span
                style={{
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm"
              >
                <LogoutIcon className="w-4 h-4" />
              </span>
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderColor: 'var(--border)',
        }}
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t px-1 py-2 lg:hidden overflow-x-auto"
      >
        <Link
          to="/"
          aria-label="Về MikroTik"
          className="flex flex-col items-center gap-1 rounded px-2 py-1 text-center min-w-[56px] text-[var(--accent-bright)]"
        >
          <span className="text-base">📶</span>
          <span className="text-[10px] font-mono tracking-tight font-bold">MikroTik</span>
        </Link>
        {items.slice(0, 5).map((item) => {
          const isActive = item.id === active
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onClick={() => onChange(item.id)}
              style={{
                color: isActive ? 'var(--accent-bright)' : 'var(--text-dim)',
              }}
              className="flex flex-col items-center gap-1 rounded px-2 py-1 text-center min-w-[56px]"
            >
              {renderViewIcon(item.icon, 'w-5 h-5', false)}
              <span className="text-[10px] font-mono tracking-tight truncate max-w-[56px]">{item.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          aria-label="Cài đặt"
          onClick={() => onChange('settings')}
          style={{
            color: active === 'settings' ? 'var(--accent-bright)' : 'var(--text-dim)',
          }}
          className="flex flex-col items-center gap-1 rounded px-2 py-1 text-center min-w-[56px]"
        >
          <span style={{ color: '#14b8a6' }}>
            <SettingsIcon className="w-5 h-5" />
          </span>
          <span className="text-[10px] font-mono tracking-tight">Cài đặt</span>
        </button>
        {onLogout && (
          <button
            type="button"
            aria-label="Đăng xuất"
            onClick={onLogout}
            style={{ color: '#ef4444' }}
            className="flex flex-col items-center gap-1 rounded px-2 py-1 text-center min-w-[56px]"
          >
            <LogoutIcon className="w-5 h-5" />
            <span className="text-[10px] font-mono tracking-tight">Thoát</span>
          </button>
        )}
      </nav>
    </>
  )
}
