import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const REFRESH_MS = 15000;

export default function SessionsPage() {
  const { isViewer } = useAuth();
  const toast = useToast();
  const { data: sessions = [], loading, error, reload } = useApi(api.active);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  async function handleDisconnect(s) {
    const ok = window.confirm(
      `Ngắt kết nối phiên của "${s.user}" (${s.ip})?`
    );
    if (!ok) return;
    setBusyId(s['.id']);
    try {
      await api.disconnect(s['.id']);
      toast.success(`Đã ngắt phiên truy cập của "${s.user}" (${s.ip})`, 'Ngắt phiên thành công');
      reload();
    } catch (err) {
      toast.error(`Không thể ngắt kết nối: ${err.message}`, 'Lỗi ngắt phiên');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Phiên hoạt động
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Danh sách /ip/hotspot/active · tự làm mới mỗi 15 giây
          </p>
        </div>
        <button onClick={reload} className="btn-ghost px-4 py-2 text-sm">
          ⟳ Làm mới
        </button>
      </header>

      {error && (
        <div className="glass rounded-2xl border-danger/40 p-5 shadow-[0_0_24px_rgba(225,29,72,0.15)]">
          <p className="font-semibold text-danger">Không lấy được danh sách phiên.</p>
          <p className="mt-1 text-sm text-ink-soft">{error}</p>
          <button onClick={reload} className="btn-danger mt-3 px-4 py-2 text-xs">
            ⟳ Thử lại
          </button>
        </div>
      )}

      {loading && !error ? (
        <Spinner label="Đang tải…" />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="glass-table w-full text-left text-sm">
              <thead>
                <tr className="label-caps">
                  <th className="px-5 py-3.5 font-semibold">Người dùng</th>
                  <th className="px-5 py-3.5 font-semibold">IP</th>
                  <th className="px-5 py-3.5 font-semibold">MAC</th>
                  <th className="px-5 py-3.5 font-semibold">Uptime</th>
                  <th className="px-5 py-3.5 font-semibold">Idle</th>
                  <th className="px-5 py-3.5 font-semibold">Dữ liệu ↓ / ↑</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-ink-faint">
                      Không có phiên nào đang hoạt động.
                    </td>
                  </tr>
                )}
                {sessions.map((s) => (
                  <tr key={s['.id']}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="neon-dot" />
                        <span className="font-semibold text-ink">{s.user}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-soft">{s.ip}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-faint">
                      {s['mac-address']}
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft">{formatDuration(s.uptime)}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{formatDuration(s['idle-time'])}</td>
                    <td className="px-5 py-3.5 text-ink-soft">
                      <span className="font-medium text-primary">{formatBytes(s['bytes-in'])}</span> ↓ /{' '}
                      <span className="font-medium text-secondary">{formatBytes(s['bytes-out'])}</span> ↑
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {isViewer ? (
                        <span className="rounded-md bg-ink/5 px-2.5 py-1 text-xs italic text-ink-faint">
                          Chỉ xem
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDisconnect(s)}
                          disabled={busyId === s['.id']}
                          className="btn-danger px-3.5 py-1.5 text-xs disabled:opacity-50"
                        >
                          {busyId === s['.id'] ? 'Đang xử lý…' : 'Ngắt'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}