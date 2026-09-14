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

  // Chọn hàng loạt (Floating BulkBar)
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Drawer xem chi tiết Add-on
  const [activeDrawerAddon, setActiveDrawerAddon] = useState(null);

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

  // Thao tác Add-on đơn lẻ
  async function handleAddonAction(slug, action, addonName) {
    setActionBusySlug(slug);
    try {
      const res = await api.hassAddonAction(slug, action);
      toast.success(res.message || `Đã thực hiện '${action}' cho ${addonName}`);
      const fresh = await api.hassSummary();
      setData(fresh);
      if (activeDrawerAddon?.slug === slug) {
        const updated = fresh?.addons?.items?.find((a) => a.slug === slug);
        if (updated) setActiveDrawerAddon(updated);
      }
    } catch (err) {
      toast.error(err.message || `Lỗi khi thực hiện '${action}'`);
    } finally {
      setActionBusySlug(null);
    }
  }

  // Thao tác hàng loạt (Bulk Actions)
  async function handleBulkAction(action) {
    if (selectedSlugs.length === 0) return;
    setBulkBusy(true);
    let successCount = 0;
    try {
      for (const slug of selectedSlugs) {
        const ad = data?.addons?.items?.find((a) => a.slug === slug);
        try {
          await api.hassAddonAction(slug, action);
          successCount++;
        } catch {}
      }
      toast.success(`Đã thực hiện '${action}' thành công cho ${successCount}/${selectedSlugs.length} add-on.`);
      setSelectedSlugs([]);
      const fresh = await api.hassSummary();
      setData(fresh);
    } catch (err) {
      toast.error('Lỗi khi thực hiện thao tác hàng loạt.');
    } finally {
      setBulkBusy(false);
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

  const allFilteredSelected = useMemo(() => {
    if (filteredAddons.length === 0) return false;
    return filteredAddons.every((a) => selectedSlugs.includes(a.slug));
  }, [filteredAddons, selectedSlugs]);

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedSlugs((prev) => prev.filter((s) => !filteredAddons.some((a) => a.slug === s)));
    } else {
      const newSlugs = [...new Set([...selectedSlugs, ...filteredAddons.map((a) => a.slug)])];
      setSelectedSlugs(newSlugs);
    }
  }

  function toggleSelectOne(slug) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  const host = data?.host;
  const telemetry = data?.telemetry;
  const entitiesStats = data?.entitiesStats;

  // Helper render đồ thị SVG đường sóng
  function renderSvgPolyline(history, maxVal = 100, strokeColor = 'var(--accent)', fillColor = 'var(--accent-bg)') {
    const w = 300;
    const h = 60;
    const points = history.map((val, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const normalized = maxVal === 0 ? 0 : Math.min(100, Math.max(0, (val / maxVal) * 100));
      const y = h - (normalized / 100) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pointsStr = points.join(' ');
    const areaPoints = `0,${h} ${pointsStr} ${w},${h}`;

    return (
      <svg className="w-full h-[60px] overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polygon points={areaPoints} fill={fillColor} />
        <polyline points={pointsStr} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. PageTopbar (.sk-topbar) theo chuẩn Section 4.2 */}
      <div className="sk-topbar flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="sk-title">Home Assistant OS</h1>
            <span className="sk-pill sk-pill--green">
              <span className="sk-pill__dot" />
              {data?.mode === 'real' ? 'REAL HOST' : 'MOCK SUPERVISOR'}
            </span>
            <span className="sk-tag sk-tag--prod">HassOS 12.4</span>
            <span className="sk-tag sk-tag--dev">Core 2026.4</span>
          </div>
          <p className="sk-subtitle">
            Bảng điều khiển giám sát hạ tầng Home Assistant OS · Realtime Supervisor Telemetry
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="sk-seg">
            <button
              onClick={() => setStreamInterval(1000)}
              className={`sk-seg__btn ${streamInterval === 1000 ? 'is-on' : ''}`}
              title="Cập nhật mỗi 1 giây"
            >
              1s
            </button>
            <button
              onClick={() => setStreamInterval(1500)}
              className={`sk-seg__btn ${streamInterval === 1500 ? 'is-on' : ''}`}
              title="Cập nhật mỗi 1.5 giây"
            >
              1.5s
            </button>
            <button
              onClick={() => setStreamInterval(3000)}
              className={`sk-seg__btn ${streamInterval === 3000 ? 'is-on' : ''}`}
              title="Cập nhật mỗi 3 giây"
            >
              3s
            </button>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`btn btn-ghost btn-sm ${isPaused ? 'text-[var(--amber)]' : ''}`}
          >
            {isPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
          </button>

          <button
            onClick={loadInitial}
            disabled={loading}
            className="btn btn-ghost btn-sm"
          >
            <span className={loading ? 'animate-spin' : ''}>⟳</span> Làm mới
          </button>

          {host?.ipAddress && (
            <a
              href={`http://${host.ipAddress}:${host.port || 8123}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm no-underline"
            >
              <span>🌐 Mở HA Web</span>
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-[var(--red-bg)] border border-[var(--red)] rounded-[var(--radius-sm)] text-xs text-[var(--red)] flex items-center justify-between font-mono">
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
          {/* 2. KPI Band (.sk-kpiband) theo chuẩn Section 5.5 */}
          <div className="sk-kpiband">
            {/* CPU KPI Tile */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <div className="sk-kpi__icon text-[var(--cyan)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <rect x="9" y="9" width="6" height="6" />
                    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
                  </svg>
                </div>
                <span className="sk-state sk-state--cyan">{telemetry?.cpu?.cores || 4} CORES</span>
              </div>
              <div className="sk-kpi__value text-[var(--cyan)]">
                {telemetry?.cpu?.usagePercent ?? 0}<span className="text-xs text-[var(--text-dim)] font-normal ml-1">%</span>
              </div>
              <div className="sk-kpi__label">BỘ VI XỬ LÝ (CPU)</div>
              <div className="sk-kpi__sub">
                <span>Nhiệt độ: <b className="text-[var(--text)] font-mono">{telemetry?.cpu?.temperatureC ?? '--'}°C</b></span>
                <span>·</span>
                <span className="sk-tag">{host?.architecture || 'aarch64'}</span>
              </div>
              <div className="mt-2.5">
                {renderSvgPolyline(cpuHistory, 100, 'var(--cyan)', 'var(--cyan-bg)')}
              </div>
            </div>

            {/* RAM Memory KPI Tile */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <div className="sk-kpi__icon text-[var(--green)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M2 7h20v10H2z" />
                    <path d="M6 11v2M10 11v2M14 11v2M18 11v2" />
                  </svg>
                </div>
                <span className="sk-state sk-state--green">{telemetry?.memory?.percentage ?? 0}%</span>
              </div>
              <div className="sk-kpi__value text-[var(--green)]">
                {formatBytes(telemetry?.memory?.usedBytes ?? 0)}
              </div>
              <div className="sk-kpi__label">BỘ NHỚ RAM</div>
              <div className="sk-kpi__sub">
                <span>Tổng: <b className="text-[var(--text)] font-mono">{formatBytes(telemetry?.memory?.totalBytes ?? 0)}</b></span>
                <span>·</span>
                <span>Trống: <b className="text-[var(--text)] font-mono">{formatBytes(telemetry?.memory?.freeBytes ?? 0)}</b></span>
              </div>
              <div className="mt-2.5">
                {renderSvgPolyline(memHistory, 100, 'var(--green)', 'var(--green-bg)')}
              </div>
            </div>

            {/* NVMe Storage KPI Tile */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <div className="sk-kpi__icon text-[var(--amber)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M6 12h.01M10 12h.01" />
                  </svg>
                </div>
                <span className="sk-state sk-state--amber">{telemetry?.disk?.percentage ?? 0}%</span>
              </div>
              <div className="sk-kpi__value text-[var(--amber)]">
                {formatBytes(telemetry?.disk?.usedBytes ?? 0)}
              </div>
              <div className="sk-kpi__label">LƯU TRỮ NVME (STORAGE)</div>
              <div className="sk-kpi__sub">
                <span>Tổng: <b className="text-[var(--text)] font-mono">{formatBytes(telemetry?.disk?.totalBytes ?? 0)}</b></span>
                <span>·</span>
                <span>Còn: <b className="text-[var(--text)] font-mono">{formatBytes(telemetry?.disk?.freeBytes ?? 0)}</b></span>
              </div>
              <div className="mt-3.5 w-full bg-[var(--surface-3)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--amber)] transition-all duration-300"
                  style={{ width: `${Math.min(100, telemetry?.disk?.percentage || 0)}%` }}
                />
              </div>
            </div>

            {/* Network Traffic KPI Tile */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <div className="sk-kpi__icon text-[var(--accent-bright)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M4 14l4-4 4 4 8-8" />
                    <path d="M14 6h6v6" />
                  </svg>
                </div>
                <span className="sk-pill sk-pill--green">ONLINE</span>
              </div>
              <div className="sk-kpi__value text-[var(--accent-bright)]">
                {telemetry?.network?.rxKbps ?? 0} <span className="text-xs text-[var(--text-dim)] font-normal">/ {telemetry?.network?.txKbps ?? 0}</span>
              </div>
              <div className="sk-kpi__label">LƯU LƯỢNG MẠNG (KBPS)</div>
              <div className="sk-kpi__sub">
                <span>↓ {telemetry?.network?.rxKbps ?? 0} Kbps</span>
                <span>·</span>
                <span>↑ {telemetry?.network?.txKbps ?? 0} Kbps</span>
              </div>
              <div className="mt-2.5">
                {renderSvgPolyline(netRxHistory, 2, 'var(--accent-bright)', 'var(--accent-bg)')}
              </div>
            </div>
          </div>

          {/* 3. Flush 2-Pane Console Layout theo chuẩn Section 4.3 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Host, Supervisor & Entities Telemetry */}
            <div className="lg:col-span-2 sk-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="sk-state sk-state--accent">SYSTEM ARCHITECTURE</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] font-mono">
                    Host & HassOS Supervisor Specs
                  </h3>
                </div>
                <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                  Cập nhật: {lastUpdate ? lastUpdate.toLocaleTimeString('vi-VN') : '--'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Hệ điều hành Host</div>
                  <div className="text-[var(--text)] font-semibold mt-1">{host?.operatingSystem || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Phiên bản Core</div>
                  <div className="text-[var(--accent-bright)] font-semibold mt-1">{host?.coreVersion || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Supervisor Engine</div>
                  <div className="text-[var(--green)] font-semibold mt-1">{host?.supervisorVersion || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Phần cứng / Board</div>
                  <div className="text-[var(--text)] font-medium mt-1">{host?.board || 'Generic x86_64'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">IP & Cổng kết nối</div>
                  <div className="text-[var(--text)] font-semibold mt-1">
                    {host?.ipAddress}:{host?.port || 8123}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Thời gian hoạt động</div>
                  <div className="text-[var(--text)] font-medium mt-1">
                    {formatDuration(host?.uptimeSeconds || 0)}
                  </div>
                </div>
              </div>

              {/* Entities Summary Badges */}
              <div className="pt-3 border-t border-[var(--border-soft)] flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase">Thực thể IoT:</span>
                <span className="sk-pill sk-pill--accent">
                  Tổng {entitiesStats?.total || 0}
                </span>
                <span className="sk-pill sk-pill--green">
                  Active {entitiesStats?.active || 0}
                </span>
                {entitiesStats?.unavailable > 0 && (
                  <span className="sk-pill sk-pill--red">
                    Unavailable {entitiesStats?.unavailable}
                  </span>
                )}
                <span className="sk-tag">Cảm biến ({entitiesStats?.domains?.sensor || 0})</span>
                <span className="sk-tag">Công tắc ({entitiesStats?.domains?.switch || 0})</span>
                <span className="sk-tag">Đèn ({entitiesStats?.domains?.light || 0})</span>
                <span className="sk-tag">Tự động ({entitiesStats?.domains?.automation || 0})</span>
                <span className="sk-tag">Khí hậu ({entitiesStats?.domains?.climate || 0})</span>
              </div>
            </div>

            {/* Supervisor Quick Actions Pane */}
            <div className="sk-card p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
                  <span className="sk-state sk-state--amber">CONSOLE ACTIONS</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] font-mono">
                    Điều Khiển Nhanh
                  </h3>
                </div>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-2.5 font-mono leading-relaxed">
                  Gửi lệnh trực tiếp đến Home Assistant Core, Supervisor Engine và Máy chủ Host
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => promptCoreAction('restart_core', 'Khởi động lại Home Assistant Core', 'Bạn có chắc chắn muốn khởi động lại dịch vụ Home Assistant Core? Các tự động hóa sẽ tạm dừng trong 15-30 giây.')}
                  disabled={coreActionBusy}
                  className="btn btn-secondary btn-sm justify-center"
                >
                  🔄 Restart Core
                </button>
                <button
                  onClick={() => promptCoreAction('restart_supervisor', 'Khởi động lại HassOS Supervisor', 'Thao tác này sẽ khởi động lại tiến trình quản lý Supervisor Add-on containers.')}
                  disabled={coreActionBusy}
                  className="btn btn-secondary btn-sm justify-center"
                >
                  ⚡ Restart Supervisor
                </button>
                <button
                  onClick={() => promptCoreAction('reload_automations', 'Nạp lại Automations & Scripts', 'Nạp lại cấu hình YAML mà không cần khởi động lại toàn bộ Core.')}
                  disabled={coreActionBusy}
                  className="btn btn-secondary btn-sm justify-center text-[var(--accent-bright)]"
                >
                  📑 Reload Automations
                </button>
                <button
                  onClick={() => promptCoreAction('reboot_host', 'Khởi động lại toàn bộ HassOS Host', 'CẢNH BÁO NGUY HIỂM: Toàn bộ máy chủ HassOS sẽ tắt và khởi động lại. Tất cả Add-on và kết nối mạng sẽ gián đoạn.', true)}
                  disabled={coreActionBusy}
                  className="btn btn-danger btn-sm justify-center"
                >
                  ⚠ Reboot Host
                </button>
              </div>
            </div>
          </div>

          {/* 4. Add-ons Management Section theo chuẩn List Anatomy (Section 4.2 & 5.6) */}
          <div className="sk-dtable-wrapper">
            {/* ListToolbar (.sk-listhead) */}
            <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)]">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-[var(--text)] font-mono">
                  Danh Sách Add-on Containers
                </h3>
                <div className="sk-seg">
                  <button
                    onClick={() => setAddonTab('all')}
                    className={`sk-seg__btn ${addonTab === 'all' ? 'is-on' : ''}`}
                  >
                    Tất cả <span className="sk-seg__count">{data?.addons?.total || 0}</span>
                  </button>
                  <button
                    onClick={() => setAddonTab('running')}
                    className={`sk-seg__btn ${addonTab === 'running' ? 'is-on' : ''}`}
                  >
                    Đang chạy <span className="sk-seg__count">{data?.addons?.running || 0}</span>
                  </button>
                  <button
                    onClick={() => setAddonTab('stopped')}
                    className={`sk-seg__btn ${addonTab === 'stopped' ? 'is-on' : ''}`}
                  >
                    Đã dừng <span className="sk-seg__count">{data?.addons?.stopped || 0}</span>
                  </button>
                </div>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Tìm Add-on theo tên / slug..."
                  value={addonSearch}
                  onChange={(e) => setAddonSearch(e.target.value)}
                  className="form-input text-xs font-mono"
                />
              </div>
            </div>

            {/* Density-First Data Table (.sk-dtable) */}
            <div className="overflow-x-auto">
              <table className="sk-dtable">
                <thead>
                  <tr>
                    <th className="w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        title="Chọn tất cả"
                      />
                    </th>
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
                      <td colSpan="8" className="text-center py-10 text-xs text-[var(--text-faint)] font-mono">
                        Không tìm thấy Add-on nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredAddons.map((ad) => {
                      const isRunning = ad.state === 'started';
                      const isBusy = actionBusySlug === ad.slug;
                      const isSelected = selectedSlugs.includes(ad.slug);

                      return (
                        <tr
                          key={ad.slug}
                          className={`${isSelected ? 'is-selected' : ''}`}
                        >
                          {/* Checkbox */}
                          <td className="text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(ad.slug)}
                            />
                          </td>

                          {/* Name & Category */}
                          <td>
                            <div>
                              <div className="font-semibold text-[var(--text)] flex items-center gap-2">
                                <span
                                  onClick={() => setActiveDrawerAddon(ad)}
                                  className="hover:text-[var(--accent-bright)] cursor-pointer transition-colors"
                                >
                                  {ad.name}
                                </span>
                                {ad.category && <span className="sk-tag text-[9px]">{ad.category}</span>}
                              </div>
                              <div className="text-[10px] text-[var(--text-faint)] font-mono mt-0.5">
                                slug: {ad.slug}
                              </div>
                              <div className="text-[11px] text-[var(--text-dim)] line-clamp-1 mt-0.5">
                                {ad.description}
                              </div>
                            </div>
                          </td>

                          {/* State Pill */}
                          <td>
                            <span className={`sk-pill ${isRunning ? 'sk-pill--green' : 'sk-pill--red'}`}>
                              <span className="sk-pill__dot" />
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
                              <span className={ad.cpuUsage > 4 ? 'text-[var(--amber)] font-bold' : 'text-[var(--text)]'}>
                                {ad.cpuUsage}%
                              </span>
                            ) : (
                              <span className="text-[var(--text-ghost)]">—</span>
                            )}
                          </td>

                          {/* RAM Memory */}
                          <td className="text-right font-mono text-xs">
                            {isRunning ? (
                              <span className="font-semibold">{formatBytes(ad.memoryBytes)}</span>
                            ) : (
                              <span className="text-[var(--text-ghost)]">—</span>
                            )}
                          </td>

                          {/* Ports */}
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {Object.keys(ad.ports || {}).length > 0 ? (
                                Object.entries(ad.ports).map(([proto, port]) => (
                                  <span key={proto} className="sk-tag text-[9.5px]">
                                    {port}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-[var(--text-faint)] font-mono">Host network</span>
                              )}
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isBusy ? (
                                <span className="text-xs font-mono text-[var(--text-dim)] animate-pulse">
                                  Đang xử lý...
                                </span>
                              ) : isRunning ? (
                                <>
                                  <button
                                    onClick={() => handleAddonAction(ad.slug, 'restart', ad.name)}
                                    className="btn btn-ghost btn-sm"
                                    title="Khởi động lại Add-on"
                                  >
                                    ↺ Restart
                                  </button>
                                  <button
                                    onClick={() => handleAddonAction(ad.slug, 'stop', ad.name)}
                                    className="btn btn-danger btn-sm"
                                    title="Dừng Add-on"
                                  >
                                    ■ Dừng
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleAddonAction(ad.slug, 'start', ad.name)}
                                  className="btn btn-primary btn-sm"
                                  title="Khởi động Add-on"
                                >
                                  ▶ Chạy
                                </button>
                              )}
                              <button
                                onClick={() => setActiveDrawerAddon(ad)}
                                className="btn btn-ghost btn-sm text-[var(--accent-bright)]"
                                title="Xem chi tiết Add-on"
                              >
                                Chi tiết →
                              </button>
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

      {/* 5. Floating BulkBar (.sk-bulkbar) theo chuẩn Section 5.7 */}
      {selectedSlugs.length > 0 && (
        <div className="sk-bulkbar">
          <span className="font-mono text-xs font-semibold text-[var(--text)]">
            Đã chọn <b className="text-[var(--accent-bright)]">{selectedSlugs.length}</b> add-on
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('start')}
              disabled={bulkBusy}
              className="btn btn-primary btn-sm"
            >
              ▶ Khởi động
            </button>
            <button
              onClick={() => handleBulkAction('stop')}
              disabled={bulkBusy}
              className="btn btn-danger btn-sm"
            >
              ■ Dừng
            </button>
            <button
              onClick={() => handleBulkAction('restart')}
              disabled={bulkBusy}
              className="btn btn-secondary btn-sm"
            >
              ↺ Restart
            </button>
            <button
              onClick={() => setSelectedSlugs([])}
              className="btn btn-ghost btn-sm"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* 6. Slide-Over Drawer (.sk-drawer) theo chuẩn Section 5.9 */}
      {activeDrawerAddon && (
        <div
          className="sk-drawer-backdrop"
          onClick={() => setActiveDrawerAddon(null)}
        >
          <div
            className="sk-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Head */}
            <div className="sk-drawer__head">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--text)] font-sans">
                    {activeDrawerAddon.name}
                  </h3>
                  <span className={`sk-pill ${activeDrawerAddon.state === 'started' ? 'sk-pill--green' : 'sk-pill--red'}`}>
                    <span className="sk-pill__dot" />
                    {activeDrawerAddon.state === 'started' ? 'RUNNING' : 'STOPPED'}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-faint)] font-mono mt-0.5">
                  slug: {activeDrawerAddon.slug} · version: {activeDrawerAddon.version}
                </div>
              </div>

              <button
                onClick={() => setActiveDrawerAddon(null)}
                className="btn btn-ghost btn-sm btn-icon"
                title="Đóng ngăn kéo"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="sk-drawer__body space-y-5 font-mono text-xs">
              {/* Mô tả */}
              <div>
                <div className="text-[10px] uppercase text-[var(--text-faint)] font-semibold mb-1">
                  MÔ TẢ DỊCH VỤ
                </div>
                <p className="text-[var(--text)] font-sans leading-relaxed text-sm bg-[var(--surface-2)] p-3 rounded border border-[var(--border-soft)]">
                  {activeDrawerAddon.description}
                </p>
              </div>

              {/* Thông số Container */}
              <div>
                <div className="text-[10px] uppercase text-[var(--text-faint)] font-semibold mb-2">
                  THÔNG SỐ CONTAINER HIỆN HÀNH
                </div>
                <div className="grid grid-cols-2 gap-3 bg-[var(--surface-2)] p-3 rounded border border-[var(--border-soft)]">
                  <div>
                    <div className="text-[10px] text-[var(--text-faint)]">MỨC TIÊU THỤ CPU</div>
                    <div className="text-sm font-bold text-[var(--cyan)] mt-0.5">
                      {activeDrawerAddon.state === 'started' ? `${activeDrawerAddon.cpuUsage}%` : '0%'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-faint)]">BỘ NHỚ RAM ĐANG DÙNG</div>
                    <div className="text-sm font-bold text-[var(--green)] mt-0.5">
                      {activeDrawerAddon.state === 'started' ? formatBytes(activeDrawerAddon.memoryBytes) : '0 MB'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-faint)]">CHẾ ĐỘ KHỞI ĐỘNG</div>
                    <div className="text-xs font-semibold text-[var(--text)] mt-0.5 uppercase">
                      {activeDrawerAddon.boot}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-faint)]">TỰ ĐỘNG CẬP NHẬT</div>
                    <div className="text-xs font-semibold text-[var(--text)] mt-0.5">
                      {activeDrawerAddon.auto_update ? 'Bật (Auto)' : 'Tắt (Manual)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cổng mạng */}
              <div>
                <div className="text-[10px] uppercase text-[var(--text-faint)] font-semibold mb-1.5">
                  CỔNG KẾT NỐI (NETWORK PORTS)
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(activeDrawerAddon.ports || {}).length > 0 ? (
                    Object.entries(activeDrawerAddon.ports).map(([proto, port]) => (
                      <span key={proto} className="sk-tag bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]">
                        {proto} ➔ {port}
                      </span>
                    ))
                  ) : (
                    <span className="text-[var(--text-faint)] text-xs">Container dùng mạng Host trực tiếp.</span>
                  )}
                </div>
              </div>

              {/* Logs Simulator */}
              <div>
                <div className="text-[10px] uppercase text-[var(--text-faint)] font-semibold mb-1.5">
                  NHẬT KÝ CONTAINER (RECENT LOGS)
                </div>
                <div className="bg-[var(--bg-code)] text-[var(--text-code)] p-3 rounded font-mono text-[11px] leading-relaxed border border-[var(--border)] h-40 overflow-y-auto">
                  <div>[s6-init] making user provided files available at /var/run/s6/etc...done.</div>
                  <div>[s6-init] ensuring user provided files have correct perms...done.</div>
                  <div>[info] Starting {activeDrawerAddon.name} version {activeDrawerAddon.version}...</div>
                  <div>[info] Configuration loaded successfully.</div>
                  <div>[info] Service listening on mapped ports.</div>
                  <div>[info] Heartbeat OK · Telemetry running at 1500ms interval.</div>
                </div>
              </div>
            </div>

            {/* Drawer Foot */}
            <div className="sk-drawer__foot">
              <button
                onClick={() => setActiveDrawerAddon(null)}
                className="btn btn-ghost btn-sm"
              >
                Đóng
              </button>
              {activeDrawerAddon.state === 'started' ? (
                <>
                  <button
                    onClick={() => handleAddonAction(activeDrawerAddon.slug, 'restart', activeDrawerAddon.name)}
                    className="btn btn-secondary btn-sm"
                  >
                    ↺ Khởi động lại
                  </button>
                  <button
                    onClick={() => handleAddonAction(activeDrawerAddon.slug, 'stop', activeDrawerAddon.name)}
                    className="btn btn-danger btn-sm"
                  >
                    ■ Dừng Add-on
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleAddonAction(activeDrawerAddon.slug, 'start', activeDrawerAddon.name)}
                  className="btn btn-primary btn-sm"
                >
                  ▶ Khởi động Add-on
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--text)] leading-relaxed font-mono">
            {confirmModal.message}
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              className="btn btn-ghost btn-sm"
            >
              Hủy bỏ
            </button>
            <button
              onClick={executeConfirmedCoreAction}
              className={confirmModal.isDanger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
            >
              Xác nhận thực hiện
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
