import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const BUFFER_SIZE = 30;

function createEmptyBuffer(length = BUFFER_SIZE) {
  return Array.from({ length }, () => 0);
}

export default function HassPerformancePage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [streamInterval, setStreamInterval] = useState(1500);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [actionBusySlug, setActionBusySlug] = useState(null);
  const [coreActionBusy, setCoreActionBusy] = useState(false);

  // Modal xác nhận thao tác Core / Host
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    action: null,
    isDanger: false,
  });

  const [addonTab, setAddonTab] = useState('all');
  const [addonSearch, setAddonSearch] = useState('');

  // Lịch sử đồ thị real-time
  const [cpuHistory, setCpuHistory] = useState(() => createEmptyBuffer());
  const [memHistory, setMemHistory] = useState(() => createEmptyBuffer());
  const [netRxHistory, setNetRxHistory] = useState(() => createEmptyBuffer());
  const [netTxHistory, setNetTxHistory] = useState(() => createEmptyBuffer());

  const eventSourceRef = useRef(null);

  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const res = await api.hassSummary();
      setData(res);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message || 'Không thể kết nối Home Assistant OS API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let es;
    let fallbackTimer;

    function connectSSE() {
      try {
        es = new EventSource('/api/hass/events');
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (isPaused) return;
          try {
            const parsed = JSON.parse(event.data);
            setData(parsed);
            setLoading(false);
            setError('');
            setLastUpdate(new Date());

            const cpuVal = parsed?.telemetry?.cpu?.usagePercent ?? 0;
            const memVal = parsed?.telemetry?.memory?.percentage ?? 0;
            const rxMbps = parsed?.telemetry?.network?.rxMbps ?? 0;
            const txMbps = parsed?.telemetry?.network?.txMbps ?? 0;

            setCpuHistory((prev) => [...prev.slice(1), cpuVal]);
            setMemHistory((prev) => [...prev.slice(1), memVal]);
            setNetRxHistory((prev) => [...prev.slice(1), rxMbps]);
            setNetTxHistory((prev) => [...prev.slice(1), txMbps]);
          } catch (e) {
            console.error('Lỗi parse SSE HassOS:', e);
          }
        };

        es.onerror = () => {
          es.close();
          if (!fallbackTimer) {
            fallbackTimer = setInterval(async () => {
              if (isPaused) return;
              try {
                const res = await api.hassSummary();
                setData(res);
                setLastUpdate(new Date());
                const cpuVal = res?.telemetry?.cpu?.usagePercent ?? 0;
                const memVal = res?.telemetry?.memory?.percentage ?? 0;
                setCpuHistory((prev) => [...prev.slice(1), cpuVal]);
                setMemHistory((prev) => [...prev.slice(1), memVal]);
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

  // Thao tác Add-on
  async function handleAddonAction(slug, action, addonName) {
    setActionBusySlug(slug);
    try {
      const res = await api.hassAddonAction(slug, action);
      toast.success(res.message || `Đã thực hiện '${action}' cho ${addonName}`);
      const fresh = await api.hassSummary();
      setData(fresh);
    } catch (err) {
      toast.error(err.message || `Lỗi khi thực hiện '${action}'`);
    } finally {
      setActionBusySlug(null);
    }
  }

  // Thao tác Core / Supervisor / Host
  function promptCoreAction(action, title, message, isDanger = false) {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      action,
      isDanger,
    });
  }

  async function executeConfirmedCoreAction() {
    const action = confirmModal.action;
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    if (!action) return;

    setCoreActionBusy(true);
    try {
      const res = await api.hassCoreAction(action);
      toast.success(res.message || 'Lệnh đã được thực thi thành công.');
      const fresh = await api.hassSummary();
      setData(fresh);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi lệnh điều khiển HassOS.');
    } finally {
      setCoreActionBusy(false);
    }
  }

  // Lọc Add-ons
  const filteredAddons = useMemo(() => {
    if (!data?.addons?.items) return [];
    let list = data.addons.items;

    if (addonTab === 'running') {
      list = list.filter((a) => a.state === 'started');
    } else if (addonTab === 'stopped') {
      list = list.filter((a) => a.state === 'stopped');
    }

    if (addonSearch.trim()) {
      const q = addonSearch.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q) ||
          a.category?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, addonTab, addonSearch]);

  const host = data?.host;
  const telemetry = data?.telemetry;
  const entitiesStats = data?.entitiesStats;

  // Helper render đồ thị SVG đường sóng
  function renderSvgPolyline(history, maxVal = 100, strokeColor = 'var(--sk-primary)', fillColor = 'var(--sk-primary-bg)') {
    const w = 300;
    const h = 70;
    const points = history.map((val, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const normalized = maxVal === 0 ? 0 : Math.min(100, Math.max(0, (val / maxVal) * 100));
      const y = h - (normalized / 100) * (h - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pointsStr = points.join(' ');
    const areaPoints = `0,${h} ${pointsStr} ${w},${h}`;

    return (
      <svg className="w-full h-[70px] overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polygon points={areaPoints} fill={fillColor} />
        <polyline points={pointsStr} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--sk-border)] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--sk-text)] font-mono">
              Home Assistant OS
            </h1>
            <span className="sk-pill running">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sk-success)] animate-pulse" />
              {data?.mode === 'real' ? 'REAL HOST' : 'MOCK SUPERVISOR'}
            </span>
            <span className="sk-tag">HassOS 12.4</span>
            <span className="sk-tag">Core 2026.4</span>
          </div>
          <p className="text-xs text-[var(--sk-text-muted)] mt-1 font-mono">
            Giám sát vi xử lý, RAM, NVMe, Add-on Containers và Thực thể IoT thời gian thực
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="sk-seg">
            <button
              onClick={() => setStreamInterval(1000)}
              className={streamInterval === 1000 ? 'active' : ''}
              title="Cập nhật mỗi 1 giây"
            >
              1s
            </button>
            <button
              onClick={() => setStreamInterval(1500)}
              className={streamInterval === 1500 ? 'active' : ''}
              title="Cập nhật mỗi 1.5 giây"
            >
              1.5s
            </button>
            <button
              onClick={() => setStreamInterval(3000)}
              className={streamInterval === 3000 ? 'active' : ''}
              title="Cập nhật mỗi 3 giây"
            >
              3s
            </button>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`btn-ghost text-xs ${isPaused ? 'text-[var(--sk-warning)]' : ''}`}
          >
            {isPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
          </button>

          <button
            onClick={loadInitial}
            disabled={loading}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <span className={loading ? 'animate-spin' : ''}>⟳</span> Làm mới
          </button>

          {host?.ipAddress && (
            <a
              href={`http://${host.ipAddress}:${host.port || 8123}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-xs flex items-center gap-1.5 no-underline"
            >
              <span>🌐 Mở HA Web</span>
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-[var(--sk-danger-bg)] border border-[var(--sk-danger)] rounded text-xs text-[var(--sk-danger)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
          <button onClick={loadInitial} className="underline text-xs hover:opacity-80">
            Thử lại
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center p-16">
          <Spinner label="Đang kết nối Home Assistant OS Supervisor..." />
        </div>
      ) : (
        <>
          {/* Top 4 KPI Resource Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPU Card */}
            <div className="sk-kpi">
              <div className="flex items-center justify-between">
                <span className="sk-kpi-label">BỘ VI XỬ LÝ (CPU)</span>
                <span className="sk-tag">{telemetry?.cpu?.cores || 4} CORES</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="sk-kpi-val text-[var(--sk-primary)]">
                  {telemetry?.cpu?.usagePercent ?? 0}
                </span>
                <span className="text-xs font-mono text-[var(--sk-text-muted)]">%</span>
              </div>
              <div className="mt-2 text-xs font-mono text-[var(--sk-text-muted)] flex items-center justify-between">
                <span>Nhiệt độ: <b className="text-[var(--sk-text)]">{telemetry?.cpu?.temperatureC ?? '--'}°C</b></span>
                <span className="sk-tag">{host?.architecture || 'aarch64'}</span>
              </div>
              <div className="mt-3">
                {renderSvgPolyline(cpuHistory, 100, 'var(--sk-primary)', 'var(--sk-primary-bg)')}
              </div>
            </div>

            {/* RAM Memory Card */}
            <div className="sk-kpi">
              <div className="flex items-center justify-between">
                <span className="sk-kpi-label">BỘ NHỚ RAM</span>
                <span className="sk-tag">{telemetry?.memory?.percentage ?? 0}%</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="sk-kpi-val text-[var(--sk-success)]">
                  {formatBytes(telemetry?.memory?.usedBytes ?? 0)}
                </span>
                <span className="text-xs font-mono text-[var(--sk-text-muted)]">
                  / {formatBytes(telemetry?.memory?.totalBytes ?? 0)}
                </span>
              </div>
              <div className="mt-2 text-xs font-mono text-[var(--sk-text-muted)] flex items-center justify-between">
                <span>Trống: <b className="text-[var(--sk-text)]">{formatBytes(telemetry?.memory?.freeBytes ?? 0)}</b></span>
                <span className="text-[var(--sk-success)]">Ổn định</span>
              </div>
              <div className="mt-3">
                {renderSvgPolyline(memHistory, 100, 'var(--sk-success)', 'var(--sk-success-bg)')}
              </div>
            </div>

            {/* NVMe Storage Card */}
            <div className="sk-kpi">
              <div className="flex items-center justify-between">
                <span className="sk-kpi-label">LƯU TRỮ NVME (STORAGE)</span>
                <span className="sk-tag">{telemetry?.disk?.percentage ?? 0}%</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="sk-kpi-val text-[var(--sk-warning)]">
                  {formatBytes(telemetry?.disk?.usedBytes ?? 0)}
                </span>
                <span className="text-xs font-mono text-[var(--sk-text-muted)]">
                  / {formatBytes(telemetry?.disk?.totalBytes ?? 0)}
                </span>
              </div>
              <div className="mt-2 text-xs font-mono text-[var(--sk-text-muted)] flex items-center justify-between">
                <span>Còn lại: <b className="text-[var(--sk-text)]">{formatBytes(telemetry?.disk?.freeBytes ?? 0)}</b></span>
                <span className="sk-tag">EXT4 / NVMe</span>
              </div>
              <div className="mt-4 w-full bg-[var(--sk-bg-subtle)] h-2 rounded overflow-hidden">
                <div
                  className="h-full bg-[var(--sk-warning)] transition-all duration-300"
                  style={{ width: `${Math.min(100, telemetry?.disk?.percentage || 0)}%` }}
                />
              </div>
            </div>

            {/* Network Traffic Card */}
            <div className="sk-kpi">
              <div className="flex items-center justify-between">
                <span className="sk-kpi-label">LƯU LƯỢNG MẠNG (LIVE)</span>
                <span className="sk-pill running">ONLINE</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <div>
                  <div className="text-[10px] uppercase font-mono text-[var(--sk-text-dim)]">↓ Download</div>
                  <span className="text-sm font-semibold font-mono text-[var(--sk-primary)]">
                    {telemetry?.network?.rxKbps ?? 0} <span className="text-[10px] text-[var(--sk-text-muted)]">Kbps</span>
                  </span>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-[var(--sk-text-dim)]">↑ Upload</div>
                  <span className="text-sm font-semibold font-mono text-[var(--sk-success)]">
                    {telemetry?.network?.txKbps ?? 0} <span className="text-[10px] text-[var(--sk-text-muted)]">Kbps</span>
                  </span>
                </div>
              </div>
              <div className="mt-3">
                {renderSvgPolyline(netRxHistory, 2, 'var(--sk-primary)', 'var(--sk-primary-bg)')}
              </div>
            </div>
          </div>

          {/* Quick Actions & Host Specs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Host & Supervisor Info */}
            <div className="lg:col-span-2 sk-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--sk-border)] pb-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--sk-text-muted)] font-mono flex items-center gap-2">
                  <span>⚙ Thông tin Host & HassOS Supervisor</span>
                </h3>
                <span className="text-[10px] font-mono text-[var(--sk-text-dim)]">
                  Cập nhật: {lastUpdate ? lastUpdate.toLocaleTimeString('vi-VN') : '--'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-[var(--sk-text-dim)] uppercase">Hệ điều hành Host</div>
                  <div className="text-[var(--sk-text)] font-medium mt-0.5">{host?.operatingSystem || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--sk-text-dim)] uppercase">Phiên bản Core</div>
                  <div className="text-[var(--sk-primary)] font-medium mt-0.5">{host?.coreVersion || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--sk-text-dim)] uppercase">Supervisor Engine</div>
                  <div className="text-[var(--sk-success)] font-medium mt-0.5">{host?.supervisorVersion || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--sk-text-dim)] uppercase">Phần cứng / Board</div>
                  <div className="text-[var(--sk-text)] font-medium mt-0.5">{host?.board || 'Generic x86_64'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--sk-text-dim)] uppercase">IP & Cổng kết nối</div>
                  <div className="text-[var(--sk-text)] font-medium mt-0.5">
                    {host?.ipAddress}:{host?.port || 8123}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--sk-text-dim)] uppercase">Thời gian hoạt động</div>
                  <div className="text-[var(--sk-text)] font-medium mt-0.5">
                    {formatDuration(host?.uptimeSeconds || 0)}
                  </div>
                </div>
              </div>

              {/* Entities Summary Badges */}
              <div className="pt-2 border-t border-[var(--sk-border)] flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--sk-text-dim)]">Thực thể IoT:</span>
                <span className="sk-tag bg-[var(--sk-primary-bg)] text-[var(--sk-primary)] border-[var(--sk-primary-border)]">
                  Tổng {entitiesStats?.total || 0}
                </span>
                <span className="sk-tag bg-[var(--sk-success-bg)] text-[var(--sk-success)] border-[var(--sk-success-border)]">
                  Active {entitiesStats?.active || 0}
                </span>
                {entitiesStats?.unavailable > 0 && (
                  <span className="sk-tag bg-[var(--sk-danger-bg)] text-[var(--sk-danger)] border-[var(--sk-danger-border)]">
                    Unavailable {entitiesStats?.unavailable}
                  </span>
                )}
                <span className="sk-tag">Cảm biến ({entitiesStats?.domains?.sensor || 0})</span>
                <span className="sk-tag">Công tắc ({entitiesStats?.domains?.switch || 0})</span>
                <span className="sk-tag">Đèn ({entitiesStats?.domains?.light || 0})</span>
                <span className="sk-tag">Tự động ({entitiesStats?.domains?.automation || 0})</span>
              </div>
            </div>

            {/* Supervisor Quick Actions Card */}
            <div className="sk-card p-4 space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--sk-text-muted)] font-mono border-b border-[var(--sk-border)] pb-2.5">
                  ⚡ Thao tác Quản trị Supervisor
                </h3>
                <p className="text-[11px] text-[var(--sk-text-dim)] mt-2 font-mono">
                  Gửi lệnh trực tiếp đến Home Assistant Core & Host Operating System
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => promptCoreAction('restart_core', 'Khởi động lại Home Assistant Core', 'Bạn có chắc chắn muốn khởi động lại dịch vụ Home Assistant Core? Các tự động hóa sẽ tạm gián đoạn trong 15-30 giây.')}
                  disabled={coreActionBusy}
                  className="btn-ghost text-xs justify-center py-2"
                >
                  🔄 Restart Core
                </button>
                <button
                  onClick={() => promptCoreAction('restart_supervisor', 'Khởi động lại HassOS Supervisor', 'Thao tác này sẽ khởi động lại tiến trình quản lý Supervisor Add-on containers.')}
                  disabled={coreActionBusy}
                  className="btn-ghost text-xs justify-center py-2"
                >
                  ⚡ Restart Supervisor
                </button>
                <button
                  onClick={() => promptCoreAction('reload_automations', 'Nạp lại Automations & Scripts', 'Nạp lại cấu hình YAML mà không cần khởi động lại toàn bộ Core.')}
                  disabled={coreActionBusy}
                  className="btn-ghost text-xs justify-center py-2 text-[var(--sk-primary)]"
                >
                  📑 Reload Automations
                </button>
                <button
                  onClick={() => promptCoreAction('reboot_host', 'Khởi động lại toàn bộ HassOS Host', 'CẢNH BÁO: Toàn bộ hệ điều hành HassOS sẽ khởi động lại. Tất cả Add-on và thiết bị IoT sẽ ngắt kết nối tạm thời.', true)}
                  disabled={coreActionBusy}
                  className="btn-danger text-xs justify-center py-2"
                >
                  ⚠ Reboot Host
                </button>
              </div>
            </div>
          </div>

          {/* Add-ons Management Section */}
          <div className="sk-card p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--sk-border)] pb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-[var(--sk-text)] font-mono">
                  Danh sách Add-on Containers ({data?.addons?.total || 0})
                </h3>
                <div className="sk-seg">
                  <button
                    onClick={() => setAddonTab('all')}
                    className={addonTab === 'all' ? 'active' : ''}
                  >
                    Tất cả ({data?.addons?.total || 0})
                  </button>
                  <button
                    onClick={() => setAddonTab('running')}
                    className={addonTab === 'running' ? 'active' : ''}
                  >
                    Đang chạy ({data?.addons?.running || 0})
                  </button>
                  <button
                    onClick={() => setAddonTab('stopped')}
                    className={addonTab === 'stopped' ? 'active' : ''}
                  >
                    Đã dừng ({data?.addons?.stopped || 0})
                  </button>
                </div>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Tìm Add-on theo tên / slug..."
                  value={addonSearch}
                  onChange={(e) => setAddonSearch(e.target.value)}
                  className="w-full text-xs font-mono"
                />
              </div>
            </div>

            {/* Density-First Add-on Table */}
            <div className="overflow-x-auto">
              <table className="sk-dtable w-full">
                <thead>
                  <tr>
                    <th>ADD-ON / DỊCH VỤ</th>
                    <th>TRẠNG THÁI</th>
                    <th className="text-right">PHIÊN BẢN</th>
                    <th className="text-right">CPU</th>
                    <th className="text-right">BỘ NHỚ RAM</th>
                    <th>CỔNG (PORTS)</th>
                    <th className="text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAddons.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-xs text-[var(--sk-text-muted)] font-mono">
                        Không tìm thấy Add-on nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredAddons.map((ad) => {
                      const isRunning = ad.state === 'started';
                      const isBusy = actionBusySlug === ad.slug;

                      return (
                        <tr key={ad.slug}>
                          {/* Name & Category */}
                          <td>
                            <div>
                              <div className="font-medium text-[var(--sk-text)] flex items-center gap-2">
                                <span>{ad.name}</span>
                                {ad.category && <span className="sk-tag text-[9px]">{ad.category}</span>}
                              </div>
                              <div className="text-[10px] text-[var(--sk-text-dim)] font-mono mt-0.5">
                                slug: {ad.slug}
                              </div>
                              <div className="text-[11px] text-[var(--sk-text-muted)] line-clamp-1 mt-0.5">
                                {ad.description}
                              </div>
                            </div>
                          </td>

                          {/* State Pill */}
                          <td>
                            <span className={`sk-pill ${isRunning ? 'running' : 'stopped'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-[var(--sk-success)]' : 'bg-[var(--sk-text-dim)]'}`} />
                              {isRunning ? 'RUNNING' : 'STOPPED'}
                            </span>
                          </td>

                          {/* Version */}
                          <td className="text-right font-mono text-xs">
                            <span className="sk-tag">{ad.version}</span>
                          </td>

                          {/* CPU */}
                          <td className="text-right font-mono text-xs">
                            {isRunning ? (
                              <span className={ad.cpuUsage > 5 ? 'text-[var(--sk-warning)] font-semibold' : 'text-[var(--sk-text)]'}>
                                {ad.cpuUsage}%
                              </span>
                            ) : (
                              <span className="text-[var(--sk-text-dim)]">—</span>
                            )}
                          </td>

                          {/* RAM Memory */}
                          <td className="text-right font-mono text-xs">
                            {isRunning ? (
                              <span>{formatBytes(ad.memoryBytes)}</span>
                            ) : (
                              <span className="text-[var(--sk-text-dim)]">—</span>
                            )}
                          </td>

                          {/* Ports */}
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {Object.keys(ad.ports || {}).length > 0 ? (
                                Object.entries(ad.ports).map(([proto, port]) => (
                                  <span key={proto} className="sk-tag text-[10px]">
                                    {port}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-[var(--sk-text-dim)] font-mono">Host network</span>
                              )}
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isBusy ? (
                                <span className="text-xs font-mono text-[var(--sk-text-dim)] animate-pulse">
                                  Đang xử lý...
                                </span>
                              ) : isRunning ? (
                                <>
                                  <button
                                    onClick={() => handleAddonAction(ad.slug, 'restart', ad.name)}
                                    className="btn-ghost text-[11px] py-1 px-2"
                                    title="Khởi động lại Add-on"
                                  >
                                    ↺ Restart
                                  </button>
                                  <button
                                    onClick={() => handleAddonAction(ad.slug, 'stop', ad.name)}
                                    className="btn-danger text-[11px] py-1 px-2"
                                    title="Dừng Add-on"
                                  >
                                    ■ Dừng
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleAddonAction(ad.slug, 'start', ad.name)}
                                  className="btn-primary text-[11px] py-1 px-2"
                                  title="Khởi động Add-on"
                                >
                                  ▶ Chạy
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
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--sk-text)] leading-relaxed font-mono">
            {confirmModal.message}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--sk-border)]">
            <button
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              className="btn-ghost text-xs"
            >
              Hủy bỏ
            </button>
            <button
              onClick={executeConfirmedCoreAction}
              className={confirmModal.isDanger ? 'btn-danger text-xs' : 'btn-primary text-xs'}
            >
              Xác nhận thực hiện
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
