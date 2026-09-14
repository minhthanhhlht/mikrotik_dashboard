import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const { data: rawSessions = [], loading, error, reload } = useApi(api.active);
  const [busyId, setBusyId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const sessions = useMemo(() => {
    return Array.isArray(rawSessions) ? rawSessions : [];
  }, [rawSessions]);

  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions;
    const q = searchTerm.toLowerCase().trim();
    return sessions.filter(
      (s) =>
        (s.user || '').toLowerCase().includes(q) ||
        (s.ip || '').toLowerCase().includes(q) ||
        (s['mac-address'] || '').toLowerCase().includes(q) ||
        (s.server || '').toLowerCase().includes(q)
    );
  }, [sessions, searchTerm]);

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
      {/* 1. PageTopbar (.sk-topbar) */}
      <div className="sk-topbar flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="sk-title">Phiên Hoạt Động (Active Sessions)</h1>
            <span className={`sk-pill ${sessions.length > 0 ? 'sk-pill--green' : 'sk-pill--amber'}`}>
              <span className="sk-pill__dot" />
              {sessions.length} ACTIVE
            </span>
          </div>
          <p className="sk-subtitle font-mono">
            Giám sát danh sách thiết bị đang đăng nhập trực tiếp từ MikroTik /ip/hotspot/active
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={reload} className="btn btn-secondary btn-sm">
            ⟳ Làm mới ngay
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs font-mono text-[var(--red)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">⚠ Không thể lấy danh sách phiên hoạt động từ router.</p>
              <p className="mt-1 text-[var(--text-dim)]">{error}</p>
            </div>
            <button onClick={reload} className="btn btn-danger btn-sm">
              ⟳ Thử lại
            </button>
          </div>
        </div>
      )}

      {loading && !error ? (
        <div className="p-12 flex justify-center">
          <Spinner label="Đang đồng bộ danh sách phiên từ router MikroTik…" />
        </div>
      ) : (
        <div className="sk-dtable-wrapper">
          {/* ListToolbar (.sk-listhead) */}
          <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)]">
            <div className="flex items-center gap-2">
              <span className="sk-state sk-state--accent">HOTSPOT SESSIONS</span>
              <span className="text-xs text-[var(--text-dim)] font-mono">
                Tổng cộng: <b className="text-[var(--text)]">{sessions.length}</b> phiên đang chạy
              </span>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Tìm theo User, IP, MAC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input text-xs font-mono"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="sk-dtable">
              <thead>
                <tr>
                  <th>TÀI KHOẢN NGƯỜI DÙNG</th>
                  <th>ĐỊA CHỈ IP</th>
                  <th>ĐỊA CHỈ MAC</th>
                  <th className="text-right">UPTIME</th>
                  <th className="text-right">IDLE TIME</th>
                  <th className="text-right">LƯU LƯỢNG (↓ / ↑)</th>
                  <th className="text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="max-w-md mx-auto space-y-3 font-mono">
                        <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-xl text-[var(--text-faint)]">
                          📡
                        </div>
                        <h3 className="text-sm font-semibold text-[var(--text)] font-sans">
                          Không có phiên nào đang hoạt động
                        </h3>
                        <p className="text-xs text-[var(--text-faint)] leading-relaxed">
                          Hiện tại chưa có thiết bị nào đăng nhập vào cổng WiFi Hotspot (Captive Portal) của Router. Khi người dùng kết nối WiFi và đăng nhập thành công, phiên truy cập sẽ tự động xuất hiện tại đây theo thời gian thực.
                        </p>
                        <div className="pt-2 flex justify-center gap-2 font-sans">
                          <Link to="/users" className="btn btn-secondary btn-sm no-underline">
                            👥 Quản lý người dùng
                          </Link>
                          <button onClick={reload} className="btn btn-ghost btn-sm">
                            ⟳ Kiểm tra lại
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr key={s['.id']}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="sk-pill sk-pill--green text-[8px] p-0.5">
                            <span className="sk-pill__dot" />
                          </span>
                          <span className="font-mono font-semibold text-[var(--text)]">{s.user}</span>
                          {s.server && <span className="sk-tag text-[9px]">{s.server}</span>}
                        </div>
                      </td>
                      <td className="font-mono text-xs text-[var(--cyan)]">{s.ip}</td>
                      <td className="font-mono text-xs text-[var(--text-faint)]">{s['mac-address']}</td>
                      <td className="font-mono text-xs text-right text-[var(--text)]">{formatDuration(s.uptime)}</td>
                      <td className="font-mono text-xs text-right text-[var(--text-faint)]">{formatDuration(s['idle-time'])}</td>
                      <td className="font-mono text-xs text-right">
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
                            className="btn btn-danger btn-sm"
                            title="Ngắt kết nối phiên này"
                          >
                            {busyId === s['.id'] ? 'Đang ngắt…' : 'Ngắt kết nối'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}