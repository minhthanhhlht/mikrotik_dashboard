import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useEventSource } from '../hooks/useEventSource.jsx';
import StatCard from '../components/StatCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const ACTIVE_REFRESH_MS = 15000; // phiên gần đây poll 15s; stats realtime qua SSE

export default function DashboardPage() {
  const [sseStats, setSseStats] = useState(null);
  const active = useApi(api.active);

  // Nhận thống kê realtime (mỗi ~5s từ backend)
  useEventSource('/api/events', setSseStats);

  const stats = useApi(api.stats);

  // Load dữ liệu ban đầu nếu SSE chưa kịp gửi
  useEffect(() => {
    const t = setInterval(() => {
      active.reload();
      if (!sseStats) stats.reload();
    }, ACTIVE_REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseStats]);

  const s = sseStats || stats.data;
  const waiting = !s && (active.loading || stats.loading);
  const errors = stats.error ? [stats.error] : s?.errors || [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Tổng quan
          <span className="text-primary">.</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Bảng điều khiển quản trị hotspot MikroTik · cập nhật realtime (SSE)
        </p>
      </header>

      {/* Cảnh báo lỗi */}
      {errors.length > 0 && (
        <div className="glass rounded-2xl border-amber-300/60 p-5 shadow-[0_0_24px_rgba(217,119,6,0.18)]">
          <p className="flex items-center gap-2 font-semibold text-warning">
            <span className="inline-block h-2 w-2 rounded-full bg-warning shadow-[0_0_8px_rgba(217,119,6,0.8)]" />
            Không lấy được dữ liệu từ MikroTik.
          </p>
          <ul className="mt-2 list-inside list-disc text-xs text-ink-soft">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">
            Kiểm tra{' '}
            <code className="rounded bg-warning-soft px-1.5 py-0.5 font-mono text-warning">
              backend/.env
            </code>{' '}
            và bật dịch vụ REST trên RouterOS 7.
          </p>
          <button onClick={stats.reload} className="btn-primary mt-3 px-4 py-2 text-xs">
            ⟳ Thử lại
          </button>
        </div>
      )}

      {waiting ? (
        <Spinner label="Đang tải dữ liệu…" />
      ) : s ? (
        <>
          {/* Thẻ thống kê */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tổng người dùng" value={s.users} icon="👥" />
            <StatCard label="Phiên đang hoạt động" value={s.active} icon="📡" accent="magenta" />
            <StatCard
              label="Hồ sơ (Profile)"
              value={Array.isArray(s.profiles) ? s.profiles.length : '—'}
              icon="🗂️"
              accent="violet"
            />
            <StatCard
              label="Router"
              value={s.router?.host || '—'}
              sub={s.router?.restBase}
              icon="🖥️"
              accent="amber"
            />
          </div>

          {/* Phân bố người dùng theo profile + phiên gần đây */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="glass glass-glow rounded-2xl p-6 lg:col-span-2">
              <h2 className="label-caps mb-5">Phân bố theo profile</h2>
              {Object.keys(s.usersByProfile || {}).length === 0 ? (
                <p className="text-sm text-ink-faint">Chưa có dữ liệu.</p>
              ) : (
                <ul className="space-y-4">
                  {Object.entries(s.usersByProfile).map(([profile, count], i) => {
                    const max = Math.max(1, ...Object.values(s.usersByProfile));
                    const colors = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-warning'];
                    return (
                      <li key={profile}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="font-semibold text-ink">{profile}</span>
                          <span className="font-medium text-ink-soft">{count} user</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/5">
                          <div
                            className={`h-2.5 rounded-full ${colors[i % colors.length]} shadow-[0_0_10px_rgba(0,132,255,0.45)] transition-all duration-500`}
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="glass glass-glow rounded-2xl p-6 lg:col-span-3">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="label-caps">Phiên hoạt động gần đây</h2>
                <Link
                  to="/sessions"
                  className="text-xs font-semibold text-primary transition hover:text-primary-deep"
                >
                  Xem tất cả →
                </Link>
              </div>
              {active.error ? (
                <p className="text-sm text-danger">{active.error}</p>
              ) : active.loading && !active.data ? (
                <Spinner />
              ) : active.data?.length === 0 ? (
                <p className="text-sm text-ink-faint">Không có phiên nào đang hoạt động.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="glass-table w-full text-left text-sm">
                    <thead>
                      <tr className="label-caps">
                        <th className="rounded-l-lg px-3 py-3 font-semibold">Người dùng</th>
                        <th className="px-3 py-3 font-semibold">IP</th>
                        <th className="px-3 py-3 font-semibold">Thời gian</th>
                        <th className="rounded-r-lg px-3 py-3 text-right font-semibold">Dữ liệu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/5">
                      {(active.data || []).slice(0, 8).map((a) => (
                        <tr key={a['.id']}>
                          <td className="py-3 font-semibold text-ink">{a.user}</td>
                          <td className="py-3 font-medium text-ink-soft">{a.ip}</td>
                          <td className="py-3 text-ink-soft">{formatDuration(a.uptime)}</td>
                          <td className="py-3 text-right font-medium text-ink-soft">
                            <span className="text-primary">{formatBytes(a['bytes-in'])}</span> ↓ /{' '}
                            <span className="text-secondary">{formatBytes(a['bytes-out'])}</span> ↑
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}