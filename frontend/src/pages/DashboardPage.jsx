import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useEventSource } from '../hooks/useEventSource.jsx';
import StatCard from '../components/StatCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const ACTIVE_REFRESH_MS = 15000;

export default function DashboardPage() {
  const [sseStats, setSseStats] = useState(null);
  const active = useApi(api.active);

  useEventSource('/api/events', setSseStats);
  const stats = useApi(api.stats);

  useEffect(() => {
    const t = setInterval(() => {
      active.reload();
      if (!sseStats) stats.reload();
    }, ACTIVE_REFRESH_MS);
    return () => clearInterval(t);
  }, [sseStats]);

  const s = sseStats || stats.data;
  const waiting = !s && (active.loading || stats.loading);
  const errors = stats.error ? [stats.error] : s?.errors || [];

  return (
    <div className="space-y-6">
      {/* Topbar */}
      <div className="sk-topbar">
        <div>
          <h1 className="sk-title">Tổng quan Hotspot</h1>
          <p className="sk-subtitle font-mono">
            Bảng điều khiển giám sát MikroTik Hotspot · Realtime SSE Streams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="sk-pill sk-pill--green">
            <span className="sk-pill__dot" />
            SSE LIVE
          </span>
          <button
            onClick={() => {
              active.reload();
              stats.reload();
            }}
            className="btn btn-secondary btn-sm"
          >
            ⟳ Làm mới
          </button>
        </div>
      </div>

      {/* Error notification */}
      {errors.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(245,185,69,0.3)] bg-[var(--amber-bg)] p-4 text-xs">
          <p className="flex items-center gap-2 font-semibold text-[var(--amber)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--amber)] shadow-[0_0_8px_var(--amber)]" />
            Không lấy được dữ liệu hoàn chỉnh từ MikroTik REST API.
          </p>
          <ul className="mt-2 list-inside list-disc text-[var(--text-dim)] space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={stats.reload} className="btn btn-primary btn-sm">
              ⟳ Thử lại kết nối
            </button>
          </div>
        </div>
      )}

      {waiting ? (
        <Spinner label="Đang đồng bộ dữ liệu Hotspot từ RouterOS…" />
      ) : s ? (
        <>
          {/* KPI Band */}
          <div className="sk-kpiband">
            <StatCard
              label="Tổng người dùng"
              value={s.users}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              accent="accent"
            />
            <StatCard
              label="Phiên đang chạy"
              value={s.active}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              }
              accent="green"
            />
            <StatCard
              label="Hồ sơ gói cước"
              value={Array.isArray(s.profiles) ? s.profiles.length : '—'}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              }
              accent="violet"
            />
            <StatCard
              label="Router Host"
              value={s.router?.host || '—'}
              sub={s.router?.restBase}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              }
              accent="cyan"
            />
          </div>

          {/* Distribution & Recent Sessions */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Phân bố theo profile (5 cols) */}
            <div className="sk-card lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3 mb-4">
                  <h2 className="label-caps mb-0 text-xs">Phân bố người dùng theo Profile</h2>
                  <span className="sk-state sk-state--accent">
                    {Object.keys(s.usersByProfile || {}).length} GÓI
                  </span>
                </div>

                {Object.keys(s.usersByProfile || {}).length === 0 ? (
                  <p className="text-xs font-mono text-[var(--text-faint)] py-6 text-center">Chưa có dữ liệu phân bố.</p>
                ) : (
                  <div className="space-y-3.5">
                    {Object.entries(s.usersByProfile).map(([profile, count]) => {
                      const max = Math.max(1, ...Object.values(s.usersByProfile));
                      const pct = Math.round((count / max) * 100);
                      return (
                        <div key={profile} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-[var(--text)]">{profile}</span>
                            <span className="font-mono text-[var(--text-dim)]">{count} user</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--border-soft)] text-right">
                <Link to="/profiles" className="text-xs font-mono text-[var(--accent-bright)] hover:underline">
                  Quản lý tất cả hồ sơ →
                </Link>
              </div>
            </div>

            {/* Phiên hoạt động gần đây (7 cols) */}
            <div className="sk-card lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3 mb-4">
                  <h2 className="label-caps mb-0 text-xs">Phiên hoạt động gần đây</h2>
                  <Link
                    to="/sessions"
                    className="text-xs font-mono text-[var(--accent-bright)] hover:underline"
                  >
                    Xem tất cả ({active.data?.length || 0}) →
                  </Link>
                </div>

                {active.error ? (
                  <p className="text-xs text-[var(--red)]">{active.error}</p>
                ) : active.loading && !active.data ? (
                  <Spinner size="sm" />
                ) : active.data?.length === 0 ? (
                  <p className="text-xs font-mono text-[var(--text-faint)] py-8 text-center">
                    Không có phiên nào đang hoạt động lúc này.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="sk-dtable">
                      <thead>
                        <tr>
                          <th>Người dùng</th>
                          <th>Địa chỉ IP</th>
                          <th>Thời gian</th>
                          <th className="text-right">Dung lượng ↓ / ↑</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(active.data || []).slice(0, 6).map((a) => (
                          <tr key={a['.id']}>
                            <td className="font-semibold">{a.user}</td>
                            <td className="font-mono text-xs text-[var(--text-dim)]">{a.ip}</td>
                            <td className="font-mono text-xs text-[var(--text-faint)]">
                              {formatDuration(a.uptime)}
                            </td>
                            <td className="text-right font-mono text-xs">
                              <span className="text-[var(--cyan)]">{formatBytes(a['bytes-in'])}</span> ↓ /{' '}
                              <span className="text-[var(--violet)]">{formatBytes(a['bytes-out'])}</span> ↑
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}