import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const CHECK_INTERVAL = 10000; // kiểm tra lại mỗi 10s

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

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[var(--text-ghost)] animate-pulse" />
        <span className="text-xs font-mono text-[var(--text-faint)]">Đang kiểm tra kết nối…</span>
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-[var(--green-bg)] border border-[rgba(61,220,151,0.25)] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)]" />
        <div className="min-w-0">
          <div className="text-xs font-medium text-[var(--green)]">
            REST API Connected
          </div>
          {host && (
            <div className="truncate text-[11px] font-mono text-[var(--text-dim)]">
              {host}
              {latencyMs != null ? ` · ${latencyMs}ms` : ''}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-[var(--red-bg)] border border-[rgba(251,111,111,0.25)] px-3 py-2">
      <span className="h-2 w-2 rounded-full bg-[var(--red)] shadow-[0_0_8px_var(--red)]" />
      <div className="min-w-0">
        <div className="text-xs font-medium text-[var(--red)]">Mất kết nối Router</div>
        <div className="truncate text-[10px] font-mono text-[var(--text-faint)]">
          {error || 'Không thể kết nối REST'}
        </div>
      </div>
    </div>
  );
}