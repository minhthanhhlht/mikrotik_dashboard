import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const CHECK_INTERVAL = 10000; // kiểm tra lại mỗi 10s

// Hiển thị trạng thái kết nối thực tế tới router MikroTik
// dựa trên /api/health (backend thực sự ping router qua REST).
export default function ConnectionStatus() {
  const [status, setStatus] = useState('checking'); // checking | connected | offline
  const [host, setHost] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const h = await api.health();
        if (cancelled) return;
        setHost(h.mikrotik?.host || null);
        setLatencyMs(h.latencyMs ?? null);
        setError(h.error || '');
        setStatus(h.connected ? 'connected' : 'offline');
      } catch (err) {
        if (cancelled) return;
        setStatus('offline');
        setError(err.message);
        setHost(null);
        setLatencyMs(null);
      }
    }

    check();
    const t = setInterval(check, CHECK_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Đang kiểm tra (lần đầu)
  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-white/40 px-3.5 py-2.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-ink-faint" />
        <span className="text-xs font-medium text-ink-soft">Đang kiểm tra kết nối…</span>
      </div>
    );
  }

  // Đã kết nối
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-primary-soft/60 px-3.5 py-2.5">
        <span className="neon-dot" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-primary-deep">
            REST API đã kết nối
          </div>
          {host && (
            <div className="truncate text-[10px] font-medium text-ink-soft">
              {host}
              {latencyMs != null ? ` · ${latencyMs}ms` : ''}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mất kết nối
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-danger-soft/80 px-3.5 py-2.5">
      <span className="neon-dot neon-dot-danger" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-danger">Mất kết nối MikroTik</div>
        <div className="truncate text-[10px] font-medium text-danger/70">
          {error || 'Không thể kết nối router'}
        </div>
      </div>
    </div>
  );
}