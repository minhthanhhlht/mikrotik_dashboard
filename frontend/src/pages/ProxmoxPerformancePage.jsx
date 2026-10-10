import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';
import { formatBytes, formatDuration, formatSpeed, formatBitrate, formatChartBitrate } from '../utils/format.js';

const BUFFER_SIZE = 30;

function createEmptyBuffer(length = BUFFER_SIZE) {
  return Array.from({ length }, () => 0);
}

export default function ProxmoxPerformancePage() {
  const toast = useToast();
  const { language, t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [streamInterval, setStreamInterval] = useState(1500);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [nodePowerModal, setNodePowerModal] = useState(null); // 'reboot' | 'shutdown' | null
  const [nodePowerBusy, setNodePowerBusy] = useState(false);

  async function handleExecuteNodePower() {
    if (!nodePowerModal) return;
    const command = nodePowerModal;
    setNodePowerBusy(true);
    try {
      await api.proxmoxNodeAction(command);
      toast.success(
        command === 'reboot'
          ? 'Đã gửi lệnh khởi động lại máy chủ vật lý Proxmox thành công!'
          : 'Đã gửi lệnh tắt nguồn máy chủ vật lý Proxmox thành công!',
        t('common.success')
      );
      setNodePowerModal(null);
    } catch (err) {
      toast.error(err.message || 'Lỗi thực thi điều khiển nguồn máy chủ', t('common.error'));
    } finally {
      setNodePowerBusy(false);
    }
  }

  const [guestTab, setGuestTab] = useState('all');
  const [guestSearch, setGuestSearch] = useState('');

  // Task Logs States
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskPage, setTaskPage] = useState(1);
  const [copiedUpid, setCopiedUpid] = useState(null);
  const TASK_PAGE_SIZE = 8;

  const [cpuHistory, setCpuHistory] = useState(() => createEmptyBuffer());
  const [memHistory, setMemHistory] = useState(() => createEmptyBuffer());
  const [netRxHistory, setNetRxHistory] = useState(() => createEmptyBuffer());
  const [netTxHistory, setNetTxHistory] = useState(() => createEmptyBuffer());

  const eventSourceRef = useRef(null);

  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const res = await api.proxmoxSummary();
      setData(res);
      setLastUpdate(new Date());
      const cpuVal = res?.node?.cpuPercentage ?? 0;
      const memVal = res?.node?.memory?.percentage ?? 0;
      const rxMbps = res?.traffic?.rxMbps ?? 0;
      const txMbps = res?.traffic?.txMbps ?? 0;
      setCpuHistory((prev) => [...prev.slice(1), cpuVal]);
      setMemHistory((prev) => [...prev.slice(1), memVal]);
      setNetRxHistory((prev) => [...prev.slice(1), rxMbps]);
      setNetTxHistory((prev) => [...prev.slice(1), txMbps]);
    } catch (err) {
      setError(err.message || 'Could not connect to Proxmox VE API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let es;
    let fallbackTimer;

    function connectSSE() {
      try {
        es = new EventSource('/api/proxmox/events');
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (isPaused) return;
          try {
            const parsed = JSON.parse(event.data);
            setData(parsed);
            setLoading(false);
            setError('');
            setLastUpdate(new Date());

            const cpuVal = parsed?.node?.cpuPercentage ?? 0;
            const memVal = parsed?.node?.memory?.percentage ?? 0;
            const rxMbps = parsed?.traffic?.rxMbps ?? 0;
            const txMbps = parsed?.traffic?.txMbps ?? 0;

            setCpuHistory((prev) => [...prev.slice(1), cpuVal]);
            setMemHistory((prev) => [...prev.slice(1), memVal]);
            setNetRxHistory((prev) => [...prev.slice(1), rxMbps]);
            setNetTxHistory((prev) => [...prev.slice(1), txMbps]);
          } catch (e) {
            console.error('SSE parse error Proxmox:', e);
          }
        };

        es.onerror = () => {
          es.close();
          if (!fallbackTimer) {
            fallbackTimer = setInterval(async () => {
              if (isPaused) return;
              try {
                const res = await api.proxmoxSummary();
                setData(res);
                setLastUpdate(new Date());
                const cpuVal = res?.node?.cpuPercentage ?? 0;
                const memVal = res?.node?.memory?.percentage ?? 0;
                const rxMbps = res?.traffic?.rxMbps ?? 0;
                const txMbps = res?.traffic?.txMbps ?? 0;
                setCpuHistory((prev) => [...prev.slice(1), cpuVal]);
                setMemHistory((prev) => [...prev.slice(1), memVal]);
                setNetRxHistory((prev) => [...prev.slice(1), rxMbps]);
                setNetTxHistory((prev) => [...prev.slice(1), txMbps]);
              } catch {}
            }, streamInterval);
          }
        };
      } catch {
        loadInitial();
      }
    }

    connectSSE();

    return () => {
      if (es) es.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [isPaused, streamInterval]);

  async function handleGuestAction(guest, action) {
    const actionNames = {
      start: t('proxmox.startVm'),
      shutdown: t('proxmox.shutdownVm'),
      stop: t('proxmox.stopVm'),
      reboot: t('proxmox.rebootVm'),
    };
    const actName = actionNames[action] || action;
    setActionBusyId(guest.vmid);
    try {
      await api.proxmoxGuestAction(guest.type, guest.vmid, action);
      toast.success(
        `${actName} -> ${guest.type.toUpperCase()} ${guest.vmid} (${guest.name})`,
        t('common.success')
      );
      const updated = await api.proxmoxSummary();
      setData(updated);
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setActionBusyId(null);
    }
  }

  // Format unix timestamp to readable string
  function formatTaskTime(unixSeconds) {
    if (!unixSeconds) return '—';
    const d = new Date(unixSeconds * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function formatTaskDuration(starttime, endtime) {
    if (!starttime) return '—';
    if (!endtime) return t('proxmox.filterRunningTasks') || 'Running...';
    const sec = Math.max(0, endtime - starttime);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }

  function getTaskTypeBadge(type = '') {
    const tLower = type.toLowerCase();
    if (tLower === 'vzstart') return { label: '▶ Start LXC', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    if (tLower === 'vzshutdown') return { label: '⏹ Shutdown LXC', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    if (tLower === 'vzstop') return { label: '⛔ Stop LXC', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    if (tLower === 'vzcreate' || tLower === 'vzscreate') return { label: '➕ Create LXC', cls: 'bg-teal-500/15 text-teal-400 border-teal-500/30' };
    if (tLower === 'vncproxy' || tLower === 'vncticket') return { label: '🖥️ Console', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
    if (tLower === 'qmstart') return { label: '▶ Start VM', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    if (tLower === 'qmshutdown') return { label: '⏹ Shutdown VM', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    if (tLower === 'qmstop') return { label: '⛔ Stop VM', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    if (tLower === 'qmcreate') return { label: '➕ Create VM', cls: 'bg-teal-500/15 text-teal-400 border-teal-500/30' };
    if (tLower === 'download') return { label: '📥 Download', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    if (tLower === 'aptupdate') return { label: '📦 APT Update', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
    return { label: type, cls: 'bg-[var(--surface-3)] text-[var(--text-dim)] border-[var(--border)]' };
  }

  function handleCopyUpid(upid) {
    if (!upid) return;
    try {
      navigator.clipboard.writeText(upid);
      setCopiedUpid(upid);
      toast.success('Đã sao chép mã UPID vào clipboard');
      setTimeout(() => setCopiedUpid(null), 2500);
    } catch {
      setCopiedUpid(upid);
    }
  }

  const rawTasks = useMemo(() => {
    return Array.isArray(data?.tasks) ? data.tasks : [];
  }, [data?.tasks]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return rawTasks.filter((tItem) => {
      const statusStr = String(tItem.status || '').toLowerCase();
      const isOk = statusStr === 'ok';
      const isRunning = !tItem.endtime || statusStr === 'running';
      const isError = !isOk && !isRunning;

      if (taskFilter === 'ok' && !isOk) return false;
      if (taskFilter === 'running' && !isRunning) return false;
      if (taskFilter === 'error' && !isError) return false;

      if (!q) return true;
      const haystack = `${tItem.type} ${tItem.id} ${tItem.user} ${tItem.node} ${tItem.status} ${tItem.upid}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rawTasks, taskSearch, taskFilter]);

  const totalTaskPages = Math.max(1, Math.ceil(filteredTasks.length / TASK_PAGE_SIZE));
  const paginatedTasks = useMemo(() => {
    const start = (taskPage - 1) * TASK_PAGE_SIZE;
    return filteredTasks.slice(start, start + TASK_PAGE_SIZE);
  }, [filteredTasks, taskPage]);

  const filteredGuests = useMemo(() => {
    if (!data?.guests) return [];
    const q = guestSearch.trim().toLowerCase();
    return data.guests.filter((g) => {
      if (guestTab === 'qemu' && g.type !== 'qemu') return false;
      if (guestTab === 'lxc' && g.type !== 'lxc') return false;
      if (guestTab === 'running' && g.status !== 'running') return false;

      if (!q) return true;
      const haystack = `${g.vmid} ${g.name} ${g.os || ''} ${g.ip || ''} ${g.description || ''} ${(g.tags || []).join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data?.guests, guestTab, guestSearch]);

  function renderSvgPath(dataPoints, height = 80, width = 320, maxVal = 100, startX = 32) {
    if (!dataPoints || dataPoints.length === 0) return '';
    const chartW = width - startX;
    const step = chartW / (dataPoints.length - 1);
    const topY = 8;
    const bottomY = 72;
    const usableH = bottomY - topY;

    const points = dataPoints.map((val, i) => {
      const clamped = Math.max(0, Math.min(maxVal, val));
      const y = bottomY - (clamped / maxVal) * usableH;
      return [startX + i * step, y];
    });

    let d = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const mx = (x0 + x1) / 2;
      d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    return d;
  }

  const node = data?.node;
  const counts = data?.counts;
  const traffic = data?.traffic;
  const highestNetHistory = Math.max(0.01, ...netRxHistory, ...netTxHistory);
  const chartNetScaleMax = highestNetHistory >= 50
    ? Math.ceil(highestNetHistory * 1.2)
    : highestNetHistory >= 10
    ? Math.ceil(highestNetHistory * 1.25)
    : highestNetHistory >= 1
    ? Math.ceil(highestNetHistory * 1.25 * 10) / 10
    : Math.max(0.25, Math.ceil(highestNetHistory * 1.35 * 100) / 100);

  return (
    <div className="space-y-6">
      {/* 1. Header Trang */}
      <div className="sk-topbar flex-wrap">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="sk-title">{t('proxmox.title')}</h1>
            <span className="sk-pill sk-pill--green text-[10px]">
              <span className="sk-pill__dot" />
              Node: {node?.node || 'pve-master'}
            </span>
            <span className="sk-tag sk-tag--dev text-[9px]">
              {data?.mode === 'mock' ? 'MOCK ENGINE' : 'LIVE API'}
            </span>
          </div>
          <p className="sk-subtitle font-mono">
            {t('proxmox.subtitle')}
          </p>
        </div>

        {/* Thanh điều khiển Live Stream, Tần suất & Nguồn Máy chủ Node */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Nút nguồn Máy chủ vật lý Proxmox Host */}
          <div className="flex items-center gap-1 bg-[var(--surface-2)] p-0.5 rounded-[var(--radius-sm)] border border-[var(--border-soft)]">
            <button
              type="button"
              onClick={() => setNodePowerModal('reboot')}
              className="btn btn-ghost btn-xs text-sky-400 hover:bg-sky-500/10 font-mono text-xs px-2.5 h-7"
              title={t('proxmox.nodeRebootBtn')}
            >
              🔄 {t('proxmox.nodeRebootBtn') || 'Reboot Host'}
            </button>
            <button
              type="button"
              onClick={() => setNodePowerModal('shutdown')}
              className="btn btn-ghost btn-xs text-rose-400 hover:bg-rose-500/10 font-mono text-xs px-2.5 h-7"
              title={t('proxmox.nodeShutdownBtn')}
            >
              🛑 {t('proxmox.nodeShutdownBtn') || 'Shutdown Host'}
            </button>
          </div>

          <div className="sk-seg">
            {[
              { label: '1s', val: 1000 },
              { label: '1.5s', val: 1500 },
              { label: '3s', val: 3000 },
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setStreamInterval(item.val)}
                className={`sk-seg__btn ${streamInterval === item.val ? 'is-on' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`btn btn-sm ${isPaused ? 'btn-primary' : 'btn-secondary'}`}
          >
            {isPaused ? `▶ ${t('common.resume')}` : `⏸ ${t('common.pause')}`}
          </button>

          <button
            type="button"
            onClick={loadInitial}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            {loading ? <Spinner size="xs" /> : '⟳'} {t('common.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[var(--red)]">⚠️ {error}</p>
            <button onClick={loadInitial} className="btn btn-danger btn-sm">
              {t('common.retry')}
            </button>
          </div>
        </div>
      )}

      {/* 2. Hàng 8 KPI Gauges Giám sát Node (Bao gồm Nhiệt độ & Điện áp) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {/* KPI 1: CPU Load */}
        <div className="sk-kpi p-3">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">CPU Node</span>
            <span className="font-mono text-xs">⚡</span>
          </div>
          <div className="font-mono text-lg font-bold text-[var(--text)]">
            {node?.cpuPercentage ?? 0}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${Math.min(100, node?.cpuPercentage ?? 0)}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)] truncate">
            {node?.cores ?? 8}C / {node?.threads ?? 16}T
          </div>
        </div>

        {/* KPI 2: RAM Usage */}
        <div className="sk-kpi p-3">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">RAM</span>
            <span className="font-mono text-xs">🧠</span>
          </div>
          <div className="font-mono text-lg font-bold text-[var(--text)]">
            {node?.memory?.percentage ?? 0}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full rounded-full bg-[var(--violet)] transition-all duration-300"
              style={{ width: `${Math.min(100, node?.memory?.percentage ?? 0)}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)] truncate">
            {formatBytes(node?.memory?.used ?? 0)} / {formatBytes(node?.memory?.total ?? 0)}
          </div>
        </div>

        {/* KPI 3: ZFS Pool Storage */}
        <div className="sk-kpi p-3">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">ZFS Storage</span>
            <span className="font-mono text-xs">💽</span>
          </div>
          <div className="font-mono text-lg font-bold text-[var(--text)]">
            {node?.rootFs?.percentage ?? 39.2}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full rounded-full bg-[var(--green)] transition-all duration-300"
              style={{ width: `${node?.rootFs?.percentage ?? 39.2}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)] truncate">
            {formatBytes(node?.rootFs?.used ?? 0)} / {formatBytes(node?.rootFs?.total ?? 0)}
          </div>
        </div>

        {/* KPI 4: Load Average */}
        <div className="sk-kpi p-3">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">Load Avg</span>
            <span className="font-mono text-xs">⏱️</span>
          </div>
          <div className="font-mono text-lg font-bold text-[var(--text)]">
            {node?.loadAverage ? node.loadAverage[0] : '1.45'}
          </div>
          <div className="mt-2 font-mono text-[10px] text-[var(--text-dim)] truncate">
            5m: {node?.loadAverage?.[1] || '1.28'} · 15m: {node?.loadAverage?.[2] || '1.15'}
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)]">
            IO: {node?.ioWaitPercentage ?? 1.2}%
          </div>
        </div>

        {/* KPI 5: Live Network Bandwidth */}
        <div className="sk-kpi p-3">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">Traffic</span>
            <span className="font-mono text-xs">🌐</span>
          </div>
          <div className="font-mono text-lg font-bold text-[var(--accent-bright)]">
            {traffic?.rxMbps && traffic.rxMbps > 0
              ? `${traffic.rxMbps} Mbps`
              : (traffic?.rxBytesPerSec ? formatSpeed(traffic.rxBytesPerSec) : '0.0 Mbps')}
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
            <span className="text-[var(--green)]">
              ↓ {traffic?.rxBytesPerSec ? formatSpeed(traffic.rxBytesPerSec) : `${traffic?.rxMbps ?? 0}M`}
            </span>
            <span className="text-[var(--violet)]">
              ↑ {traffic?.txBytesPerSec ? formatSpeed(traffic.txBytesPerSec) : `${traffic?.txMbps ?? 0}M`}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)] truncate">
            {traffic?.rxMbps ?? 0}M ↓ · {traffic?.txMbps ?? 0}M ↑
          </div>
        </div>

        {/* KPI 6: Tổng Máy ảo & Containers */}
        <div className="sk-kpi p-3">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">VM & LXC</span>
            <span className="font-mono text-xs">🖥️</span>
          </div>
          <div className="font-mono text-lg font-bold text-[var(--text)]">
            {counts?.totalRunning ?? 0} <span className="text-xs text-[var(--text-faint)]">/ {counts?.totalGuests ?? 0}</span>
          </div>
          <div className="mt-2 flex items-center gap-1 font-mono text-[9px]">
            <span className="sk-tag sk-tag--prod py-0 px-1">VM:{counts?.vmsRunning ?? 0}</span>
            <span className="sk-tag sk-tag--dev py-0 px-1">CT:{counts?.lxcsRunning ?? 0}</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)] truncate">
            ● {counts?.totalRunning ?? 0} ON · ○ {counts?.totalStopped ?? 0} OFF
          </div>
        </div>

        {/* KPI 7: Nhiệt độ Node (Temperature) */}
        <div className="sk-kpi p-3">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">{t('proxmox.temperature')}</span>
            <span className="font-mono text-xs">🌡️</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-lg font-bold text-[var(--text)]">
              {data?.sensors?.temperature ?? data?.node?.sensors?.temperature ?? 42.5}
            </span>
            <span className="font-mono text-xs text-[var(--text-dim)]">°C</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                (data?.sensors?.temperature ?? 42) > 75
                  ? 'bg-[var(--red)]'
                  : (data?.sensors?.temperature ?? 42) > 60
                  ? 'bg-[var(--amber)]'
                  : 'bg-[var(--green)]'
              }`}
              style={{ width: `${Math.min(100, Math.max(10, ((data?.sensors?.temperature ?? 42) / 90) * 100))}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)] truncate">
            CPU: {data?.sensors?.cpuTemp ?? 43}°C · MB: {data?.sensors?.motherboardTemp ?? 36}°C
          </div>
        </div>

        {/* KPI 8: Điện áp Nguồn (Voltage) */}
        <div className="sk-kpi p-3">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">{t('proxmox.voltage')}</span>
            <span className="font-mono text-xs">⚡</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-lg font-bold text-[var(--text)]">
              {data?.sensors?.voltage ?? data?.node?.sensors?.voltage ?? 12.10}
            </span>
            <span className="font-mono text-xs text-[var(--text-dim)]">V</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
            <span className="text-[var(--accent-bright)]">Vcore: {data?.sensors?.vcore ?? 1.12}V</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)] truncate">
            Fan: {data?.sensors?.fanSpeed ?? 1350} RPM
          </div>
        </div>
      </div>

      {/* 3. Khối Biểu Đồ Sóng Vector SVG */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Biểu đồ 1: Tải CPU & RAM */}
        <div className="sk-card">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">{t('proxmox.cpuHistory')}</h3>
              <p className="font-mono text-[11px] text-[var(--text-faint)]">30s buffer</p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-[var(--accent-bright)]">CPU: {node?.cpuPercentage ?? 0}%</span>
              <span className="text-[var(--violet)]">RAM: {node?.memory?.percentage ?? 0}%</span>
            </div>
          </div>

          <div className="relative h-32 w-full">
            <svg viewBox="0 0 320 80" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              {/* Lưới vạch chia % */}
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                const y = 8 + (1 - ratio) * (72 - 8);
                const pct = Math.round(ratio * 100);
                return (
                  <g key={ratio}>
                    <line
                      x1="32"
                      y1={y}
                      x2="320"
                      y2={y}
                      stroke="var(--border-soft)"
                      strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                      strokeWidth={ratio === 0 ? '1' : '0.8'}
                      strokeOpacity={ratio === 0 ? '0.6' : '0.35'}
                    />
                    <text
                      x="27"
                      y={y + 3}
                      textAnchor="end"
                      className="fill-[var(--text-faint)] text-[8px] font-mono select-none"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {/* RAM Area & Spline */}
              <path
                d={`${renderSvgPath(memHistory, 80, 320, 100, 32)} L 320,72 L 32,72 Z`}
                fill="var(--violet)"
                fillOpacity="0.08"
              />
              <path
                d={renderSvgPath(memHistory, 80, 320, 100, 32)}
                fill="none"
                stroke="var(--violet)"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* CPU Area & Spline */}
              <path
                d={`${renderSvgPath(cpuHistory, 80, 320, 100, 32)} L 320,72 L 32,72 Z`}
                fill="var(--accent)"
                fillOpacity="0.1"
              />
              <path
                d={renderSvgPath(cpuHistory, 80, 320, 100, 32)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Biểu đồ 2: Băng thông qua Linux Bridges */}
        <div className="sk-card">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">{t('proxmox.netHistory')}</h3>
              <p className="font-mono text-[11px] text-[var(--text-faint)]">vmbr0 / vmbr1</p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-[var(--green)]">
                ↓ {traffic?.rxBytesPerSec ? formatSpeed(traffic.rxBytesPerSec) : `${traffic?.rxMbps ?? 0} Mbps`}
              </span>
              <span className="text-[var(--cyan)]">
                ↑ {traffic?.txBytesPerSec ? formatSpeed(traffic.txBytesPerSec) : `${traffic?.txMbps ?? 0} Mbps`}
              </span>
            </div>
          </div>

          <div className="relative h-32 w-full">
            <svg viewBox="0 0 320 80" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              {/* Lưới vạch chia tốc độ thực tế (Mbps / Kbps - Không dùng %) */}
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                const y = 8 + (1 - ratio) * (72 - 8);
                const currentVal = chartNetScaleMax * ratio;
                const label = formatChartBitrate(currentVal);
                return (
                  <g key={ratio}>
                    <line
                      x1="32"
                      y1={y}
                      x2="320"
                      y2={y}
                      stroke="var(--border-soft)"
                      strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                      strokeWidth={ratio === 0 ? '1' : '0.8'}
                      strokeOpacity={ratio === 0 ? '0.6' : '0.35'}
                    />
                    <text
                      x="27"
                      y={y + 3}
                      textAnchor="end"
                      className="fill-[var(--text-faint)] text-[8px] font-mono select-none"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Tx Spline */}
              <path
                d={`${renderSvgPath(netTxHistory, 80, 320, chartNetScaleMax, 32)} L 320,72 L 32,72 Z`}
                fill="var(--cyan)"
                fillOpacity="0.08"
              />
              <path
                d={renderSvgPath(netTxHistory, 80, 320, chartNetScaleMax, 32)}
                fill="none"
                stroke="var(--cyan)"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Rx Spline */}
              <path
                d={`${renderSvgPath(netRxHistory, 80, 320, chartNetScaleMax, 32)} L 320,72 L 32,72 Z`}
                fill="var(--green)"
                fillOpacity="0.1"
              />
              <path
                d={renderSvgPath(netRxHistory, 80, 320, chartNetScaleMax, 32)}
                fill="none"
                stroke="var(--green)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 4. Bảng Quản Lý Máy Ảo KVM & Container LXC */}
      <section className="sk-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">{t('proxmox.title')}</h2>
            <p className="font-mono text-xs text-[var(--text-faint)]">
              {t('proxmox.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="sk-seg">
              {[
                { id: 'all', label: t('proxmox.tabAll', { count: data?.guests?.length ?? 7 }) },
                { id: 'qemu', label: t('proxmox.tabQemu', { count: data?.counts?.vmsTotal ?? 4 }) },
                { id: 'lxc', label: t('proxmox.tabLxc', { count: data?.counts?.lxcsTotal ?? 3 }) },
                { id: 'running', label: t('proxmox.tabRunning', { count: data?.counts?.totalRunning ?? 6 }) },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setGuestTab(tab.id)}
                  className={`sk-seg__btn ${guestTab === tab.id ? 'is-on' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-56">
              <input
                type="text"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder={t('proxmox.searchGuests')}
                className="form-input text-xs h-8"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="sk-dtable">
            <thead>
              <tr>
                <th>{t('proxmox.colGuestId')} / {t('proxmox.colGuestType')}</th>
                <th>{t('proxmox.colGuestName')} & OS</th>
                <th>{t('proxmox.colGuestStatus')}</th>
                <th>IP</th>
                <th>{t('proxmox.colGuestCpu')}</th>
                <th>{t('proxmox.colGuestMem')}</th>
                <th>Traffic</th>
                <th>{t('proxmox.colGuestUptime')}</th>
                <th className="text-right">{t('proxmox.colGuestActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center font-mono text-xs text-[var(--text-faint)]">
                    {t('common.empty')}
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => {
                  const isRunning = guest.status === 'running';
                  const isMikrotik = guest.vmid === 100 || guest.tags?.includes('mikrotik');
                  const isLxc = guest.type === 'lxc';

                  return (
                    <tr
                      key={`${guest.type}-${guest.vmid}`}
                      className={isMikrotik ? 'bg-[var(--accent-bg-soft)]' : ''}
                    >
                      {/* ID & Loại */}
                      <td className="font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className={`sk-state text-[9px] ${isLxc ? 'sk-state--cyan' : 'sk-state--accent'}`}>
                            {isLxc ? 'LXC' : 'KVM'}
                          </span>
                          <span>{guest.vmid}</span>
                        </div>
                      </td>

                      {/* Tên & OS */}
                      <td>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
                              <span>{guest.name}</span>
                              {isMikrotik && (
                                <span className="sk-tag sk-tag--prod text-[8px] py-0 px-1">
                                  GATEWAY
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-[var(--text-faint)]">
                              {guest.os} {guest.description ? `· ${guest.description}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td>
                        {isRunning ? (
                          <span className="sk-pill sk-pill--green text-[10px] py-0 px-2">
                            <span className="sk-pill__dot" /> RUNNING
                          </span>
                        ) : (
                          <span className="sk-pill sk-pill--red text-[10px] py-0 px-2">
                            <span className="sk-pill__dot" /> STOPPED
                          </span>
                        )}
                      </td>

                      {/* IP */}
                      <td className="font-mono text-xs text-[var(--text-dim)]">
                        {guest.ip ? (
                          <span className="rounded bg-[var(--surface-3)] px-1.5 py-0.5">{guest.ip}</span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* vCPU */}
                      <td>
                        {isRunning ? (
                          <div className="w-24">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span>{Math.round((guest.cpuUsage || 0) * 100)}%</span>
                              <span className="text-[10px] text-[var(--text-faint)]">{guest.cpus} vCPU</span>
                            </div>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                              <div
                                className="h-full rounded-full bg-[var(--accent)]"
                                style={{ width: `${Math.min(100, Math.round((guest.cpuUsage || 0) * 100))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-[var(--text-faint)]">—</span>
                        )}
                      </td>

                      {/* RAM */}
                      <td className="font-mono text-xs text-[var(--text-dim)]">
                        {isRunning ? (
                          <div>
                            <span>{formatBytes(guest.mem || 0)}</span>
                            <span className="text-[var(--text-faint)]"> / {formatBytes(guest.maxmem || 0)}</span>
                          </div>
                        ) : (
                          <span>{formatBytes(guest.maxmem || 0)}</span>
                        )}
                      </td>

                      {/* Mạng */}
                      <td className="font-mono text-xs">
                        {isRunning ? (
                          <div>
                            <span className="text-[var(--green)] font-semibold">
                              ↓ {formatBytes(guest.netin || 0)}
                            </span>{' '}
                            <span className="text-[var(--violet)] font-semibold">
                              ↑ {formatBytes(guest.netout || 0)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-faint)]">—</span>
                        )}
                      </td>

                      {/* Uptime */}
                      <td className="font-mono text-xs text-[var(--text-faint)]">
                        {isRunning && guest.uptime ? formatDuration(guest.uptime, language) : '—'}
                      </td>

                      {/* Thao tác */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isRunning ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleGuestAction(guest, 'reboot')}
                                disabled={actionBusyId === guest.vmid}
                                className="btn btn-secondary btn-xs text-[11px] px-2 py-0.5 h-6.5 font-mono text-sky-400 hover:text-sky-300"
                                title={t('proxmox.rebootVm')}
                              >
                                🔄 Reboot
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGuestAction(guest, 'shutdown')}
                                disabled={actionBusyId === guest.vmid}
                                className="btn btn-secondary btn-xs text-[11px] px-2 py-0.5 h-6.5 font-mono text-amber-400 hover:text-amber-300"
                                title={t('proxmox.shutdownVm')}
                              >
                                ⏹ Shutdown
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGuestAction(guest, 'stop')}
                                disabled={actionBusyId === guest.vmid}
                                className="btn btn-danger btn-xs text-[11px] px-2 py-0.5 h-6.5 font-mono"
                                title={t('proxmox.stopVm')}
                              >
                                ⚡ Stop
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGuestAction(guest, 'start')}
                              disabled={actionBusyId === guest.vmid}
                              className="btn btn-primary btn-xs text-[11px] px-2.5 py-0.5 h-6.5 font-mono"
                              title={t('proxmox.startVm')}
                            >
                              ▶ Start
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Cảm biến Phần cứng, Storage Pools & Linux Bridges */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cảm biến Phần cứng & Nguồn Điện (Hardware Sensors & Voltage) */}
        <section className="sk-card">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">{t('proxmox.hardwareSensors')}</h3>
              <p className="font-mono text-[11px] text-[var(--text-faint)]">Thermal Sensors & Voltage Telemetry</p>
            </div>
            <span
              className={`sk-state font-mono text-[10px] ${
                (data?.sensors?.temperature ?? 42) > 75
                  ? 'sk-state--red'
                  : (data?.sensors?.temperature ?? 42) > 60
                  ? 'sk-state--amber'
                  : 'sk-state--green'
              }`}
            >
              {(data?.sensors?.temperature ?? 42) > 75
                ? t('proxmox.statusCritical')
                : (data?.sensors?.temperature ?? 42) > 60
                ? t('proxmox.statusWarm')
                : t('proxmox.statusOptimal')}
            </span>
          </div>

          <div className="space-y-3">
            {/* Nhiệt độ CPU Package */}
            <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">🌡️ {t('proxmox.cpuTemp')}</span>
                  <span className="sk-tag sk-tag--prod text-[8px] py-0 px-1">PACKAGE</span>
                </div>
                <div className="font-mono text-xs font-bold text-[var(--text)]">
                  {data?.sensors?.cpuTemp ?? data?.node?.sensors?.cpuTemp ?? 43.5} <span className="text-[var(--text-dim)]">°C</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    (data?.sensors?.cpuTemp ?? 43) > 75
                      ? 'bg-[var(--red)]'
                      : (data?.sensors?.cpuTemp ?? 43) > 60
                      ? 'bg-[var(--amber)]'
                      : 'bg-[var(--green)]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(10, ((data?.sensors?.cpuTemp ?? 43) / 95) * 100))}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-[var(--text-faint)]">
                <span>TDP Max: 95°C</span>
                <span className="font-semibold text-[var(--green)]">Safe Range (&lt;70°C)</span>
              </div>
            </div>

            {/* Nhiệt độ Bo mạch & VRM */}
            <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">📟 {t('proxmox.mbTemp')}</span>
                  <span className="sk-tag sk-tag--dev text-[8px] py-0 px-1">CHIPSET</span>
                </div>
                <div className="font-mono text-xs font-bold text-[var(--text)]">
                  {data?.sensors?.motherboardTemp ?? data?.node?.sensors?.motherboardTemp ?? 36.5} <span className="text-[var(--text-dim)]">°C</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-[var(--cyan)] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(10, ((data?.sensors?.motherboardTemp ?? 36) / 80) * 100))}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-[var(--text-faint)]">
                <span>VRM / PCH System</span>
                <span className="font-semibold text-[var(--cyan)]">Optimal</span>
              </div>
            </div>

            {/* Điện áp Nguồn 12V & Vcore */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-2.5">
                <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">⚡ {t('proxmox.voltage')}</div>
                <div className="mt-1 font-mono text-sm font-bold text-[var(--text)]">
                  {data?.sensors?.voltage ?? data?.node?.sensors?.voltage ?? 12.10} <span className="text-[10px] text-[var(--text-dim)]">V</span>
                </div>
                <div className="mt-1 text-[9px] font-mono text-[var(--green)]">● 12V Main Rail Stable</div>
              </div>

              <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-2.5">
                <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">⚙️ {t('proxmox.vcore')}</div>
                <div className="mt-1 font-mono text-sm font-bold text-[var(--text)]">
                  {data?.sensors?.vcore ?? data?.node?.sensors?.vcore ?? 1.12} <span className="text-[10px] text-[var(--text-dim)]">V</span>
                </div>
                <div className="mt-1 text-[9px] font-mono text-[var(--accent-bright)]">
                  Fan: {data?.sensors?.fanSpeed ?? 1350} RPM
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Storage Pools */}
        <section className="sk-card">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">{t('proxmox.storagePools')}</h3>
              <p className="font-mono text-[11px] text-[var(--text-faint)]">ZFS Pools & Rootfs Storage</p>
            </div>
            <span className="sk-state sk-state--accent font-mono text-[10px]">
              {data?.storage?.length ?? 3} POOLS
            </span>
          </div>

          <div className="space-y-3">
            {(data?.storage || []).map((st) => {
              const pct = Math.round(((st.used || 0) / (st.total || 1)) * 100);
              return (
                <div
                  key={st.storage}
                  className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--text)]">{st.storage}</span>
                      <span className="sk-state text-[9px]">{st.type}</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-[var(--text)]">
                      {pct}% <span className="font-normal text-[var(--text-faint)]">({formatBytes(st.used)} / {formatBytes(st.total)})</span>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct > 80 ? 'bg-[var(--red)]' : pct > 60 ? 'bg-[var(--amber)]' : 'bg-[var(--green)]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-[var(--text-faint)]">
                    <span>{st.description}</span>
                    <span className="font-bold text-[var(--green)]">Avail: {formatBytes(st.avail)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Linux Network Bridges */}
        <section className="sk-card">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">{t('proxmox.linuxBridges')}</h3>
              <p className="font-mono text-[11px] text-[var(--text-faint)]">Virtual Bridges & VLAN Trunking</p>
            </div>
            <span className="sk-state sk-state--accent font-mono text-[10px]">
              {data?.network?.length ?? 4} BRIDGES
            </span>
          </div>

          <div className="space-y-2.5">
            {(data?.network || []).map((iface) => (
              <div
                key={iface.iface}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-3)] text-[var(--accent-bright)] text-xs font-bold font-mono">
                    {iface.type === 'bridge' ? 'BR' : 'NIC'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--text)]">{iface.iface}</span>
                      {iface.cidr && (
                        <span className="rounded bg-[var(--accent-bg)] px-1.5 py-0.2 text-[10px] font-mono text-[var(--accent-bright)]">
                          {iface.cidr}
                        </span>
                      )}
                      {iface.bridge_vlan_aware ? (
                        <span className="sk-tag sk-tag--dev text-[8px] py-0 px-1">
                          VLAN AWARE
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--text-faint)] truncate">
                      {iface.comment}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="sk-pill sk-pill--green text-[9px] py-0 px-1.5">
                    <span className="sk-pill__dot" /> UP
                  </span>
                  <div className="font-mono text-[10px] text-[var(--text-faint)] mt-0.5">
                    {iface.speed}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>


      {/* 6. Nhật Ký Tác Vụ Hypervisor (Task Logs Table) */}
      <section className="sk-card overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-soft)]">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                📋 {t('proxmox.taskLogs')}
              </h3>
              <span className="sk-state sk-state--accent font-mono text-[10px]">
                {t('proxmox.taskLogsTotal', { count: rawTasks.length })}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--text-faint)]">
              {t('proxmox.taskLogsSubtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Task */}
            <div className="relative">
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => {
                  setTaskSearch(e.target.value);
                  setTaskPage(1);
                }}
                placeholder={t('proxmox.searchTasks')}
                className="input input-sm pl-8 pr-3 text-xs w-48 sm:w-60 bg-[var(--surface-2)] font-mono"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-faint)]"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {/* Filter Status */}
            <select
              value={taskFilter}
              onChange={(e) => {
                setTaskFilter(e.target.value);
                setTaskPage(1);
              }}
              className="input input-sm text-xs bg-[var(--surface-2)] font-mono"
            >
              <option value="all">{t('proxmox.filterAllTasks')}</option>
              <option value="ok">{t('proxmox.filterOkTasks')}</option>
              <option value="error">{t('proxmox.filterErrorTasks')}</option>
              <option value="running">{t('proxmox.filterRunningTasks')}</option>
            </select>
          </div>
        </div>

        {/* Task Table */}
        <div className="overflow-x-auto">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto h-10 w-10 text-[var(--text-faint)]"
              >
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="mt-2 text-xs font-mono text-[var(--text-dim)]">
                {t('proxmox.noTasks')}
              </p>
            </div>
          ) : (
            <table className="table-sk w-full text-xs">
              <thead>
                <tr>
                  <th className="w-40">{t('proxmox.colTaskStartTime')}</th>
                  <th className="w-24">{t('proxmox.colTaskDuration')}</th>
                  <th className="w-36">{t('proxmox.colTaskType')}</th>
                  <th className="w-24">{t('proxmox.colTaskId')}</th>
                  <th>{t('proxmox.colTaskUser')}</th>
                  <th className="w-24">{t('proxmox.colTaskNode')}</th>
                  <th className="w-32">{t('proxmox.colTaskStatus')}</th>
                  <th className="w-48 text-right">{t('proxmox.colTaskUpid')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {paginatedTasks.map((tItem, idx) => {
                  const typeBadge = getTaskTypeBadge(tItem.type);
                  const statusStr = String(tItem.status || '').trim();
                  const isOk = statusStr === 'OK';
                  const isRunning = !tItem.endtime || statusStr.toLowerCase() === 'running';
                  const isWarning = statusStr.startsWith('WARNINGS');

                  return (
                    <tr key={tItem.upid || idx} className="hover:bg-[var(--surface-2)]/60 transition-colors">
                      {/* Start time */}
                      <td className="font-mono text-[11px] text-[var(--text-dim)] whitespace-nowrap">
                        {formatTaskTime(tItem.starttime)}
                      </td>

                      {/* Duration */}
                      <td className="font-mono text-[11px] text-[var(--text-faint)] whitespace-nowrap">
                        {formatTaskDuration(tItem.starttime, tItem.endtime)}
                      </td>

                      {/* Action Type */}
                      <td>
                        <span className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border ${typeBadge.cls}`}>
                          {typeBadge.label}
                        </span>
                      </td>

                      {/* Target ID */}
                      <td className="font-mono font-semibold text-[var(--accent-bright)]">
                        {tItem.id ? (tItem.id === '0' ? 'Root/Host' : `#${tItem.id}`) : '—'}
                      </td>

                      {/* User */}
                      <td className="font-mono text-[11px] text-[var(--text)] truncate max-w-[150px]" title={tItem.user}>
                        {tItem.user}
                      </td>

                      {/* Node */}
                      <td className="font-mono text-[11px] text-[var(--text-dim)]">
                        {tItem.node}
                      </td>

                      {/* Status */}
                      <td>
                        {isOk ? (
                          <span className="sk-pill sk-pill--green text-[10px] py-0 px-2">
                            <span className="sk-pill__dot" /> OK
                          </span>
                        ) : isRunning ? (
                          <span className="sk-pill sk-pill--amber text-[10px] py-0 px-2 animate-pulse">
                            <span className="sk-pill__dot" /> RUNNING
                          </span>
                        ) : isWarning ? (
                          <span className="badge badge-warning text-[10px] font-mono py-0 px-1.5" title={statusStr}>
                            ⚠️ {statusStr}
                          </span>
                        ) : (
                          <span className="badge badge-error text-[10px] font-mono py-0 px-1.5 max-w-[120px] truncate" title={statusStr}>
                            ❌ {statusStr.replace('TASK ERROR: ', '')}
                          </span>
                        )}
                      </td>

                      {/* UPID */}
                      <td className="text-right">
                        <button
                          onClick={() => handleCopyUpid(tItem.upid)}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
                          title="Bấm để sao chép toàn bộ mã UPID"
                        >
                          <span className="truncate max-w-[130px]">{tItem.upid ? tItem.upid.slice(0, 22) + '…' : '—'}</span>
                          {copiedUpid === tItem.upid ? (
                            <span className="text-[var(--green)]">✓</span>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination bar */}
        {totalTaskPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border-soft)] p-3 text-xs font-mono text-[var(--text-faint)]">
            <div>
              Hiển thị {(taskPage - 1) * TASK_PAGE_SIZE + 1} - {Math.min(taskPage * TASK_PAGE_SIZE, filteredTasks.length)} / {filteredTasks.length} tác vụ
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTaskPage((p) => Math.max(1, p - 1))}
                disabled={taskPage <= 1}
                className="btn btn-secondary btn-xs"
              >
                ◀ Trước
              </button>
              <span className="px-2 font-semibold text-[var(--text)]">
                {taskPage} / {totalTaskPages}
              </span>
              <button
                onClick={() => setTaskPage((p) => Math.min(totalTaskPages, p + 1))}
                disabled={taskPage >= totalTaskPages}
                className="btn btn-secondary btn-xs"
              >
                Sau ▶
              </button>
            </div>
          </div>
        )}
      </section>


      {/* Modal Xác nhận Điều khiển Nguồn Máy chủ Proxmox vật lý (Host Computer) */}
      {nodePowerModal && (
        <Modal
          open={Boolean(nodePowerModal)}
          onClose={() => !nodePowerBusy && setNodePowerModal(null)}
          title={nodePowerModal === 'reboot' ? t('proxmox.confirmNodeReboot') : t('proxmox.confirmNodeShutdown')}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <div className={`p-3.5 rounded-[var(--radius-sm)] border text-xs font-mono flex items-start gap-2.5 ${
              nodePowerModal === 'reboot'
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <span className="text-base">⚠️</span>
              <div>
                <p className="font-bold mb-1">
                  {nodePowerModal === 'reboot'
                    ? 'Bạn có chắc chắn muốn KHỞI ĐỘNG LẠI toàn bộ máy chủ vật lý Proxmox VE?'
                    : 'Bạn có chắc chắn muốn TẮT NGUỒN toàn bộ máy chủ vật lý Proxmox VE?'}
                </p>
                <p className="opacity-90 leading-relaxed">
                  {nodePowerModal === 'reboot'
                    ? t('proxmox.nodeRebootDesc', { node: node?.node || 'mtdd' })
                    : t('proxmox.nodeShutdownDesc', { node: node?.node || 'mtdd' })}
                </p>
              </div>
            </div>

            <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-3 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>🖥️ Máy chủ vật lý:</span>
                <span className="font-bold text-[var(--text)]">{node?.node || 'mtdd'}</span>
              </div>
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>⚡ Phần cứng CPU:</span>
                <span className="text-[var(--text)]">{node?.cpuModel || 'Intel Xeon E5-2696 v3'} ({node?.cores || 36} Cores / {node?.threads || 72} Threads)</span>
              </div>
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>📦 Máy ảo / Container:</span>
                <span className="font-bold text-emerald-400">{counts?.totalRunning ?? 0} đang chạy / {counts?.totalGuests ?? 0} tổng</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-soft)]">
              <button
                type="button"
                onClick={() => setNodePowerModal(null)}
                disabled={nodePowerBusy}
                className="btn btn-secondary btn-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleExecuteNodePower}
                disabled={nodePowerBusy}
                className={`btn btn-sm ${nodePowerModal === 'reboot' ? 'btn-primary' : 'btn-danger'}`}
              >
                {nodePowerBusy ? (
                  <Spinner size="xs" />
                ) : nodePowerModal === 'reboot' ? (
                  '🔄 Xác nhận Khởi động lại'
                ) : (
                  '🛑 Xác nhận Tắt nguồn'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. Footer Hypervisor */}
      <footer className="sk-card p-4 text-xs font-mono text-[var(--text-faint)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>🖥️ Kernel: Linux 6.8.4-2-pve</span>
          <span>·</span>
          <span>⏱️ Uptime Node: {node?.uptimeSeconds ? formatDuration(node.uptimeSeconds, language) : '—'}</span>
        </div>
        <div>
          Sync: {lastUpdate ? lastUpdate.toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN') : '—'}
        </div>
      </footer>
    </div>
  );
}
