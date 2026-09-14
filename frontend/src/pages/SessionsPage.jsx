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
    <div className="space-y-6">
      {/* Topbar */}
      <div className="sk-topbar flex-wrap">
        <div>
          <h1 className="sk-title">Phiên hoạt động (Active Sessions)</h1>
          <p className="sk-subtitle font-mono">
            Danh sách /ip/hotspot/active · Tự động làm mới mỗi 15 giây
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="sk-pill sk-pill--green text-[10px]">
            <span className="sk-pill__dot" />
            {sessions.length} ACTIVE
          </span>
          <button onClick={reload} className="btn btn-secondary btn-sm">
            ⟳ Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs">
          <p className="font-semibold text-[var(--red)]">Không lấy được danh sách phiên.</p>
          <p className="mt-1 text-[var(--text-dim)]">{error}</p>
          <button onClick={reload} className="btn btn-danger btn-sm mt-3">
            ⟳ Thử lại
          </button>
        </div>
      )}

      {loading && !error ? (
        <Spinner label="Đang đồng bộ danh sách phiên từ router…" />
      ) : (
        <div className="sk-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="sk-dtable">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Địa chỉ IP</th>
                  <th>Địa chỉ MAC</th>
                  <th>Uptime</th>
                  <th>Idle Time</th>
                  <th>Dữ liệu ↓ / ↑</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center font-mono text-xs text-[var(--text-faint)]">
                      Không có phiên nào đang hoạt động.
                    </td>
                  </tr>
                )}
                {sessions.map((s) => (
                  <tr key={s['.id']}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="sk-pill sk-pill--green text-[8px] p-0.5" />
                        <span className="font-mono font-semibold text-[var(--text)]">{s.user}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-[var(--text-dim)]">{s.ip}</td>
                    <td className="font-mono text-xs text-[var(--text-faint)]">{s['mac-address']}</td>
                    <td className="font-mono text-xs text-[var(--text-dim)]">{formatDuration(s.uptime)}</td>
                    <td className="font-mono text-xs text-[var(--text-faint)]">{formatDuration(s['idle-time'])}</td>
                    <td className="font-mono text-xs">
                      <span className="text-[var(--green)] font-semibold">{formatBytes(s['bytes-in'])}</span> ↓ /{' '}
                      <span className="text-[var(--cyan)] font-semibold">{formatBytes(s['bytes-out'])}</span> ↑
                    </td>
                    <td className="text-right">
                      {isViewer ? (
                        <span className="font-mono text-xs text-[var(--text-faint)]">
                          READ ONLY
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDisconnect(s)}
                          disabled={busyId === s['.id']}
                          className="btn btn-danger btn-sm h-7 px-2.5 text-[11px] font-mono"
                        >
                          {busyId === s['.id'] ? 'Đang xử lý…' : 'Ngắt kết nối'}
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