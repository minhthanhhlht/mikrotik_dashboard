import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useEventSource } from '../hooks/useEventSource.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

function formatSpeed(bps) {
  const num = Number(bps || 0);
  if (!Number.isFinite(num) || num <= 0) return '0 bps';
  if (num < 1000) return `${Math.round(num)} bps`;
  if (num < 1000000) return `${(num / 1000).toFixed(1)} Kbps`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(2)} Mbps`;
  return `${(num / 1000000000).toFixed(2)} Gbps`;
}

function formatStorageBytes(bytes) {
  const num = Number(bytes || 0);
  if (!Number.isFinite(num) || num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = num;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const MAX_HISTORY_POINTS = 30;

export default function SystemPerformancePage() {
  const { t } = useLanguage();
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1500);
  const [history, setHistory] = useState([]);
  const [routerPowerModal, setRouterPowerModal] = useState(null); // 'reboot' | 'shutdown' | null
  const [routerPowerBusy, setRouterPowerBusy] = useState(false);
  const [interfaceSearch, setInterfaceSearch] = useState('');
  const [interfaceTab, setInterfaceTab] = useState('all'); // 'all' | 'running' | 'down'
  const [interfacePage, setInterfacePage] = useState(1);
  const [interfacePageSize, setInterfacePageSize] = useState(8);

  async function handleExecuteRouterPower() {
    if (!routerPowerModal) return;
    const command = routerPowerModal;
    setRouterPowerBusy(true);
    try {
      if (command === 'reboot') {
        await api.routerReboot();
        alert('Đã gửi lệnh khởi động lại Router MikroTik thành công!');
      } else {
        await api.routerShutdown();
        alert('Đã gửi lệnh tắt nguồn Router MikroTik thành công!');
      }
      setRouterPowerModal(null);
    } catch (err) {
      alert(err.message || 'Lỗi điều khiển nguồn Router');
    } finally {
      setRouterPowerBusy(false);
    }
  }

  const sseUrl = `/api/system/performance/events?interval=${refreshInterval}`;

  useEventSource(isPaused ? null : sseUrl, (data) => {
    if (!data) return;
    setLiveData(data);
    setLoading(false);
    setError(null);

    setHistory((prev) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0].slice(3);
      const point = {
        time: timeStr,
        cpu: data.resource?.cpuLoad || 0,
        ram: data.resource?.memoryUsagePercent || 0,
        rxRate: (data.traffic?.totalRxRateBps || 0) / 1000000,
        txRate: (data.traffic?.totalTxRateBps || 0) / 1000000,
        rawRxRate: data.traffic?.totalRxRateBps || 0,
        rawTxRate: data.traffic?.totalTxRateBps || 0,
      };
      const next = [...prev, point];
      if (next.length > MAX_HISTORY_POINTS) {
        return next.slice(next.length - MAX_HISTORY_POINTS);
      }
      return next;
    });
  });

  async function loadInitial() {
    try {
      const data = await api.systemPerformance();
      setLiveData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  const res = liveData?.resource || {};
  const rb = liveData?.routerboard || {};
  const health = liveData?.health || {};
  const traffic = liveData?.traffic || {};
  const rawInterfaces = liveData?.interfaces || [];

  const filteredInterfaces = rawInterfaces.filter((item) => {
    if (interfaceTab === 'running' && !item.running) return false;
    if (interfaceTab === 'down' && item.running) return false;

    if (interfaceSearch) {
      const q = interfaceSearch.toLowerCase();
      const matchName = String(item.name || '').toLowerCase().includes(q);
      const matchType = String(item.type || '').toLowerCase().includes(q);
      const matchComment = String(item.comment || '').toLowerCase().includes(q);
      if (!matchName && !matchType && !matchComment) return false;
    }

    return true;
  });

  const totalInterfacePages = interfacePageSize === 'all' ? 1 : Math.ceil(filteredInterfaces.length / Number(interfacePageSize)) || 1;
  const safeInterfacePage = Math.min(interfacePage, totalInterfacePages);

  const displayedInterfaces = interfacePageSize === 'all'
    ? filteredInterfaces
    : filteredInterfaces.slice((safeInterfacePage - 1) * Number(interfacePageSize), safeInterfacePage * Number(interfacePageSize));

  const getLoadColor = (percent) => {
    if (percent >= 85) return 'var(--red)';
    if (percent >= 65) return 'var(--amber)';
    return 'var(--green)';
  };

  return (
    <div className="space-y-6">
      {/* Topbar */}
      <div className="sk-topbar flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="sk-title">{t('performance.title')}</h1>
            <span className={`sk-pill ${isPaused ? 'sk-pill--amber' : 'sk-pill--green'}`}>
              <span className="sk-pill__dot" />
              {isPaused ? t('performance.paused') : t('performance.streaming')}
            </span>
          </div>
          <p className="sk-subtitle font-mono">
            {t('performance.subtitle')}
          </p>
        </div>

        {/* Realtime Action Controls & Router Power */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Nút nguồn Router / Máy tính */}
          <div className="flex items-center gap-1 bg-[var(--surface-2)] p-0.5 rounded-[var(--radius-sm)] border border-[var(--border-soft)]">
            <button
              type="button"
              onClick={() => setRouterPowerModal('reboot')}
              className="btn btn-ghost btn-xs text-sky-400 hover:bg-sky-500/10 font-mono text-xs px-2.5 h-7"
              title="Khởi động lại Router MikroTik"
            >
              🔄 Reboot Router
            </button>
            <button
              type="button"
              onClick={() => setRouterPowerModal('shutdown')}
              className="btn btn-ghost btn-xs text-rose-400 hover:bg-rose-500/10 font-mono text-xs px-2.5 h-7"
              title="Tắt nguồn Router MikroTik"
            >
              🛑 Shutdown Router
            </button>
          </div>

          <div className="sk-seg">
            {[1000, 1500, 3000].map((ms) => (
              <button
                key={ms}
                onClick={() => setRefreshInterval(ms)}
                className={`sk-seg__btn ${refreshInterval === ms ? 'is-on' : ''}`}
              >
                {ms / 1000}s
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`btn btn-sm ${isPaused ? 'btn-primary' : 'btn-secondary'}`}
          >
            {isPaused ? `▶ ${t('common.resume')}` : `⏸ ${t('common.pause')}`}
          </button>

          <button
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
          <div className="flex items-center gap-2 font-bold text-[var(--red)]">
            <span>⚠️</span> {error}
          </div>
          <p className="mt-1 text-[var(--text-dim)]">
            {t('performance.restErrorHint')}
          </p>
        </div>
      )}

      {loading && !liveData ? (
        <div className="sk-card flex h-64 items-center justify-center">
          <Spinner label={t('common.loading')} />
        </div>
      ) : (
        <>
          {/* Hàng 4 Thẻ Chỉ số Cốt lõi (Gauge Cards) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. CPU Load */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <span className="sk-kpi__label">{t('performance.cpuUsage')}</span>
                <span className="sk-state sk-state--accent font-mono text-[10px]">
                  {res.cpuCount || 1} CORE {res.cpuFrequency ? `@ ${res.cpuFrequency}MHz` : ''}
                </span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div>
                  <div className="sk-kpi__value text-3xl">
                    {res.cpuLoad || 0}<span className="text-base text-[var(--text-dim)]">%</span>
                  </div>
                  <div className="sk-kpi__sub font-mono text-[11px]">
                    Arch: {res.cpu || res.architecture || 'ARM/MIPS'}
                  </div>
                </div>

                <div className="relative h-14 w-14">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-[var(--surface-3)]"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      strokeDasharray={`${Math.min(100, Math.max(0, res.cpuLoad || 0))}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke={getLoadColor(res.cpuLoad || 0)}
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-[var(--text-dim)]">
                    CPU
                  </span>
                </div>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, res.cpuLoad || 0))}%` }}
                />
              </div>
            </div>

            {/* 2. RAM Memory */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <span className="sk-kpi__label">{t('performance.ramUsage')}</span>
                <span className="sk-state sk-state--accent font-mono text-[10px]">
                  {res.memoryUsagePercent || 0}%
                </span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div>
                  <div className="sk-kpi__value text-2xl">
                    {formatStorageBytes(res.usedMemory)}
                  </div>
                  <div className="sk-kpi__sub font-mono text-[11px]">
                    {formatStorageBytes(res.totalMemory)} · Free: {formatStorageBytes(res.freeMemory)}
                  </div>
                </div>

                <div className="relative h-14 w-14">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-[var(--surface-3)]"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      strokeDasharray={`${Math.min(100, Math.max(0, res.memoryUsagePercent || 0))}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="var(--violet)"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-[var(--violet)]">
                    RAM
                  </span>
                </div>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full bg-[var(--violet)] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, res.memoryUsagePercent || 0))}%` }}
                />
              </div>
            </div>

            {/* 3. Realtime Bandwidth */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <span className="sk-kpi__label">{t('performance.totalTraffic')}</span>
                <span className="sk-pill sk-pill--green text-[9px] py-0 px-1.5">
                  <span className="sk-pill__dot" /> LIVE
                </span>
              </div>

              <div className="space-y-1.5 mt-1">
                <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-2.5 py-1 text-xs">
                  <span className="font-mono text-[var(--text-dim)]">↓ Rx:</span>
                  <span className="font-mono font-bold text-[var(--green)]">
                    {formatSpeed(traffic.totalRxRateBps)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-2.5 py-1 text-xs">
                  <span className="font-mono text-[var(--text-dim)]">↑ Tx:</span>
                  <span className="font-mono font-bold text-[var(--accent-bright)]">
                    {formatSpeed(traffic.totalTxRateBps)}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                <span>Rx: {formatStorageBytes(traffic.totalRxBytes)}</span>
                <span>Tx: {formatStorageBytes(traffic.totalTxBytes)}</span>
              </div>
            </div>

            {/* 4. Hardware Health & Storage */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <span className="sk-kpi__label">{t('performance.flashUsage')}</span>
                <span className="sk-tag sk-tag--prod text-[9px]">
                  {res.badBlocks ? `BAD: ${res.badBlocks}` : 'HEALTHY'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 text-center">
                  <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">{t('performance.temperature')}</div>
                  <div className="font-mono font-bold text-[var(--text)] mt-0.5">
                    {health.temperature !== null ? `${health.temperature} °C` : '42 °C'}
                  </div>
                </div>

                <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 text-center">
                  <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">{t('performance.voltage')}</div>
                  <div className="font-mono font-bold text-[var(--text)] mt-0.5">
                    {health.voltage !== null ? `${health.voltage} V` : '24.0 V'}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)]">
                <span>Flash:</span>
                <span>{res.hddUsagePercent || 0}% ({formatStorageBytes(res.usedHdd)}/{formatStorageBytes(res.totalHdd)})</span>
              </div>
            </div>
          </div>

          {/* Biểu đồ Real-time Thời gian thực */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 1: CPU & RAM */}
            <div className="sk-card">
              <div className="mb-4 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text)]">{t('performance.chartCpuRamTitle')}</h2>
                  <p className="font-mono text-[11px] text-[var(--text-faint)]">30s buffer</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-[var(--accent-bright)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> CPU ({res.cpuLoad || 0}%)
                  </span>
                  <span className="flex items-center gap-1.5 text-[var(--violet)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--violet)]" /> RAM ({res.memoryUsagePercent || 0}%)
                  </span>
                </div>
              </div>

              <div className="relative h-44 w-full">
                {history.length < 2 ? (
                  <div className="flex h-full items-center justify-center font-mono text-xs text-[var(--text-faint)]">
                    {t('common.loading')}
                  </div>
                ) : (
                  <RealtimeLineChart
                    data={history}
                    series={[
                      { key: 'cpu', color: 'var(--accent)', label: 'CPU %' },
                      { key: 'ram', color: 'var(--violet)', label: 'RAM %' },
                    ]}
                    maxVal={100}
                    unit="%"
                  />
                )}
              </div>
            </div>

            {/* Chart 2: Traffic */}
            <div className="sk-card">
              <div className="mb-4 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text)]">{t('performance.chartTrafficTitle')}</h2>
                  <p className="font-mono text-[11px] text-[var(--text-faint)]">Rx & Tx (Mbps)</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-[var(--green)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--green)]" /> Rx ({formatSpeed(traffic.totalRxRateBps)})
                  </span>
                  <span className="flex items-center gap-1.5 text-[var(--cyan)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--cyan)]" /> Tx ({formatSpeed(traffic.totalTxRateBps)})
                  </span>
                </div>
              </div>

              <div className="relative h-44 w-full">
                {history.length < 2 ? (
                  <div className="flex h-full items-center justify-center font-mono text-xs text-[var(--text-faint)]">
                    {t('common.loading')}
                  </div>
                ) : (
                  <RealtimeLineChart
                    data={history}
                    series={[
                      { key: 'rxRate', color: 'var(--green)', label: 'Download' },
                      { key: 'txRate', color: 'var(--cyan)', label: 'Upload' },
                    ]}
                    unit="Mbps"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Bảng Giám sát Interface Traffic */}
          <section className="sk-card">
            {/* Header with Title & Status */}
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[var(--text)]">{t('performance.interfaces')}</h2>
                <p className="font-mono text-xs text-[var(--text-faint)]">
                  RouterOS physical & virtual network interfaces
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="sk-state sk-state--accent font-mono text-xs">
                  {rawInterfaces.length} INTERFACES
                </span>
              </div>
            </div>

            {/* ListToolbar: Search, Status Segments & Density */}
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-0.5 sm:pb-0">
                <div className="sk-seg w-full sm:w-auto flex justify-between sm:justify-start">
                  <button
                    type="button"
                    onClick={() => { setInterfaceTab('all'); setInterfacePage(1); }}
                    className={`sk-seg__btn flex-1 sm:flex-initial justify-center ${interfaceTab === 'all' ? 'is-on' : ''}`}
                  >
                    Tất cả <span className="sk-seg__count">{rawInterfaces.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInterfaceTab('running'); setInterfacePage(1); }}
                    className={`sk-seg__btn flex-1 sm:flex-initial justify-center ${interfaceTab === 'running' ? 'is-on' : ''}`}
                  >
                    Đang chạy <span className="sk-seg__count">{rawInterfaces.filter(i => i.running).length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInterfaceTab('down'); setInterfacePage(1); }}
                    className={`sk-seg__btn flex-1 sm:flex-initial justify-center ${interfaceTab === 'down' ? 'is-on' : ''}`}
                  >
                    Ngắt / Tắt <span className="sk-seg__count">{rawInterfaces.filter(i => !i.running).length}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64 min-w-0">
                  <input
                    type="text"
                    placeholder="Tìm cổng mạng..."
                    value={interfaceSearch}
                    onChange={(e) => {
                      setInterfaceSearch(e.target.value);
                      setInterfacePage(1);
                    }}
                    className="form-input input-sm text-xs font-mono !h-8 pl-8 pr-7 w-full"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </span>
                  {interfaceSearch && (
                    <button
                      type="button"
                      onClick={() => setInterfaceSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)] text-xs p-0.5"
                      title="Xóa tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="w-28 sm:w-32 shrink-0">
                  <CustomSelect
                    value={String(interfacePageSize)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInterfacePageSize(val === 'all' ? 'all' : Number(val));
                      setInterfacePage(1);
                    }}
                    className="w-full"
                    buttonClassName="!h-8 !py-0 text-xs font-mono px-2 sm:px-3"
                    options={[
                      { value: '5', label: '5 / trang' },
                      { value: '8', label: '8 / trang' },
                      { value: '12', label: '12 / trang' },
                      { value: '24', label: '24 / trang' },
                      { value: 'all', label: 'Tất cả' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Interface Table with responsive horizontal scroll */}
            <div className="overflow-x-auto border border-[var(--border-soft)] rounded-[var(--radius-sm)]">
              <table className="sk-dtable">
                <thead className="bg-[var(--surface-2)] shadow-[0_1px_0_var(--border)]">
                  <tr>
                    <th>{t('performance.colInterface')}</th>
                    <th>{t('performance.colType')}</th>
                    <th>{t('common.status')}</th>
                    <th className="text-right">{t('performance.colRxRate')}</th>
                    <th className="text-right">{t('performance.colTxRate')}</th>
                    <th className="text-right">{t('performance.colRxTotal')} / {t('performance.colTxTotal')}</th>
                    <th className="text-right">Packets / Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedInterfaces.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center font-mono text-xs text-[var(--text-faint)]">
                        {t('common.empty')}
                      </td>
                    </tr>
                  ) : (
                    displayedInterfaces.map((item) => (
                      <tr key={item.id || item.name}>
                        <td className="font-mono font-bold">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.running ? 'bg-[var(--green)] shadow-[0_0_6px_var(--green)]' : 'bg-[var(--text-ghost)]'
                              }`}
                            />
                            {item.name}
                          </div>
                        </td>

                        <td>
                          <span className="sk-state text-[9px] mr-1.5">{item.type}</span>
                          {item.comment && <span className="text-xs text-[var(--text-faint)]">({item.comment})</span>}
                        </td>

                        <td>
                          {item.running ? (
                            <span className="sk-pill sk-pill--green text-[10px] py-0 px-2">
                              <span className="sk-pill__dot" /> UP
                            </span>
                          ) : item.disabled ? (
                            <span className="sk-state text-[10px]">DISABLED</span>
                          ) : (
                            <span className="sk-pill sk-pill--amber text-[10px] py-0 px-2">
                              <span className="sk-pill__dot" /> DOWN
                            </span>
                          )}
                        </td>

                        <td className="text-right font-mono font-semibold text-[var(--green)]">
                          {item.running ? formatSpeed(item.rxRateBps) : '—'}
                        </td>

                        <td className="text-right font-mono font-semibold text-[var(--cyan)]">
                          {item.running ? formatSpeed(item.txRateBps) : '—'}
                        </td>

                        <td className="text-right font-mono text-xs text-[var(--text-dim)]">
                          <div>↓ {formatStorageBytes(item.rxBytes)}</div>
                          <div className="text-[10px] text-[var(--text-faint)]">↑ {formatStorageBytes(item.txBytes)}</div>
                        </td>

                        <td className="text-right font-mono text-xs text-[var(--text-faint)]">
                          <div>{(item.rxPacket + item.txPacket).toLocaleString()} pkts</div>
                          {(item.rxDrop > 0 || item.txDrop > 0 || item.rxError > 0) && (
                            <div className="text-[10px] text-[var(--red)] font-semibold">
                              Drops: {item.rxDrop + item.txDrop} · Err: {item.rxError + item.txError}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer Toolbar */}
            {filteredInterfaces.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[var(--text-faint)]">
                <div>
                  Hiển thị <span className="text-[var(--text)] font-bold">{displayedInterfaces.length}</span> / {filteredInterfaces.length} cổng mạng
                  {rawInterfaces.length !== filteredInterfaces.length && (
                    <span className="ml-1 text-[var(--accent-bright)]">(lọc từ {rawInterfaces.length})</span>
                  )}
                </div>

                {interfacePageSize !== 'all' && totalInterfacePages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeInterfacePage <= 1}
                      onClick={() => setInterfacePage((p) => Math.max(1, p - 1))}
                      className="btn btn-secondary btn-xs px-2 h-7 font-mono disabled:opacity-40"
                    >
                      ← Trước
                    </button>
                    <span className="px-2 py-1 text-[var(--text-dim)]">
                      Trang <b className="text-[var(--text)]">{safeInterfacePage}</b> / {totalInterfacePages}
                    </span>
                    <button
                      type="button"
                      disabled={safeInterfacePage >= totalInterfacePages}
                      onClick={() => setInterfacePage((p) => Math.min(totalInterfacePages, p + 1))}
                      className="btn btn-secondary btn-xs px-2 h-7 font-mono disabled:opacity-40"
                    >
                      Sau →
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* RouterBOARD specs */}
          <section className="sk-card">
            <div className="mb-3 flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
              <h2 className="text-sm font-bold text-[var(--text)]">{t('performance.hardwareInfo')}</h2>
              <span className="sk-tag sk-tag--prod text-[9px]">ROS 7</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-xs">
              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">{t('performance.model')}</div>
                <div className="font-mono font-bold text-[var(--text)] mt-0.5">{rb.model || res.boardName}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">{t('performance.serialNumber')}</div>
                <div className="font-mono font-bold text-[var(--accent-bright)] mt-0.5">{rb.serialNumber || '—'}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">{t('performance.firmware')}</div>
                <div className="font-mono font-bold text-[var(--text)] mt-0.5">{res.version}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">Firmware</div>
                <div className="font-mono font-bold text-[var(--text)] mt-0.5">{rb.currentFirmware || '7.x'}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">{t('performance.uptime')}</div>
                <div className="font-mono font-bold text-[var(--green)] mt-0.5">{res.uptime}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">Architecture</div>
                <div className="font-mono font-bold text-[var(--text)] mt-0.5">{res.platform} ({res.architecture})</div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Modal Xác nhận Điều khiển Nguồn Router MikroTik */}
      {routerPowerModal && (
        <Modal
          open={Boolean(routerPowerModal)}
          onClose={() => !routerPowerBusy && setRouterPowerModal(null)}
          title={routerPowerModal === 'reboot' ? 'Xác nhận Khởi động lại Router' : 'Xác nhận Tắt nguồn Router'}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className={`p-3.5 rounded-[var(--radius-sm)] border text-xs font-mono flex items-start gap-2.5 ${
              routerPowerModal === 'reboot'
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <span className="text-base">⚠️</span>
              <div>
                <p className="font-bold mb-1">
                  {routerPowerModal === 'reboot'
                    ? 'Bạn có chắc chắn muốn KHỞI ĐỘNG LẠI thiết bị Router MikroTik?'
                    : 'Bạn có chắc chắn muốn TẮT NGUỒN thiết bị Router MikroTik?'}
                </p>
                <p className="opacity-90 leading-relaxed">
                  {routerPowerModal === 'reboot'
                    ? 'Toàn bộ kết nối mạng WiFi Hotspot và Internet sẽ tạm thời bị gián đoạn trong 30-60 giây khi Router khởi động lại.'
                    : 'Router sẽ tắt nguồn hoàn toàn. Bạn cần bật lại nguồn điện vật lý để thiết bị hoạt động trở lại.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-soft)]">
              <button
                type="button"
                onClick={() => setRouterPowerModal(null)}
                disabled={routerPowerBusy}
                className="btn btn-secondary btn-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleExecuteRouterPower}
                disabled={routerPowerBusy}
                className={`btn btn-sm ${routerPowerModal === 'reboot' ? 'btn-primary' : 'btn-danger'}`}
              >
                {routerPowerBusy ? (
                  <Spinner size="xs" />
                ) : routerPowerModal === 'reboot' ? (
                  '🔄 Xác nhận Khởi động lại'
                ) : (
                  '🛑 Xác nhận Tắt nguồn'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

function RealtimeLineChart({ data = [], series = [], maxVal = null, unit = '' }) {
  if (!data || data.length < 2) return null;

  let computedMax = maxVal;
  if (!computedMax) {
    let highest = 0;
    for (const d of data) {
      for (const s of series) {
        if (d[s.key] > highest) highest = d[s.key];
      }
    }
    computedMax = Math.max(1, Math.ceil(highest * 1.2));
  }

  const width = 500;
  const height = 160;
  const paddingX = 35;
  const paddingY = 16;
  const chartW = width - paddingX - 10;
  const chartH = height - paddingY * 2;

  const pointsCount = data.length;
  const stepX = chartW / (pointsCount - 1);

  const generatePath = (key) => {
    return data
      .map((d, i) => {
        const x = paddingX + i * stepX;
        const val = Math.min(computedMax, Math.max(0, d[key] || 0));
        const y = paddingY + chartH - (val / computedMax) * chartH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const generateAreaPath = (key) => {
    const line = generatePath(key);
    const lastX = paddingX + (pointsCount - 1) * stepX;
    const bottomY = paddingY + chartH;
    return `${line} L ${lastX.toFixed(1)} ${bottomY} L ${paddingX} ${bottomY} Z`;
  };

  return (
    <div className="h-full w-full">
      <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Lưới ngang vạch chia */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingY + chartH * (1 - ratio);
          const rawVal = computedMax * ratio;
          let labelText = '';
          if (ratio === 0) {
            labelText = '0';
          } else if (unit === '%') {
            labelText = `${Math.round(rawVal)}%`;
          } else if (computedMax >= 10) {
            labelText = `${Math.round(rawVal)} ${unit}`;
          } else if (computedMax >= 1) {
            labelText = `${rawVal.toFixed(1)} ${unit}`;
          } else {
            labelText = `${Math.round(rawVal * 1000)} Kbps`;
          }
          return (
            <g key={ratio}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - 10}
                y2={y}
                stroke="var(--border-soft)"
                strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                strokeWidth={ratio === 0 ? '1' : '0.8'}
                strokeOpacity={ratio === 0 ? '0.6' : '0.35'}
              />
              <text
                x={paddingX - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[var(--text-faint)] text-[8.5px] font-mono select-none"
              >
                {labelText}
              </text>
            </g>
          );
        })}

        {/* Series paths */}
        {series.map((s) => (
          <g key={s.key}>
            <path d={generateAreaPath(s.key)} fill={s.color} fillOpacity="0.08" />
            <path
              d={generatePath(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {/* Pulse dots */}
        {series.map((s) => {
          const lastIndex = pointsCount - 1;
          const lastVal = data[lastIndex]?.[s.key] || 0;
          const x = paddingX + lastIndex * stepX;
          const y = paddingY + chartH - (Math.min(computedMax, lastVal) / computedMax) * chartH;
          return (
            <circle
              key={`dot-${s.key}`}
              cx={x}
              cy={y}
              r="3.5"
              fill={s.color}
            />
          );
        })}
      </svg>
    </div>
  );
}
