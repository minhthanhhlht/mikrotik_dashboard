import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const BUFFER_SIZE = 30;

function createEmptyBuffer(length = BUFFER_SIZE) {
  return Array.from({ length }, () => 0);
}

export default function HassPerformancePage() {
  const toast = useToast();
  const { language, t } = useLanguage();
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
  const [addonPage, setAddonPage] = useState(1);
  const [addonPageSize, setAddonPageSize] = useState(8);

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
      setError(err.message || 'Could not connect to Home Assistant OS API.');
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
            console.error('SSE parse error HassOS:', e);
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
      toast.success(res.message || `${action} -> ${addonName}`, t('common.success'));
      const fresh = await api.hassSummary();
      setData(fresh);
      if (activeDrawerAddon?.slug === slug) {
        const updated = fresh?.addons?.items?.find((a) => a.slug === slug);
        if (updated) setActiveDrawerAddon(updated);
      }
    } catch (err) {
      toast.error(err.message, t('common.error'));
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
        try {
          await api.hassAddonAction(slug, action);
          successCount++;
        } catch {}
      }
      toast.success(`${action} (${successCount}/${selectedSlugs.length})`, t('common.success'));
      setSelectedSlugs([]);
      const fresh = await api.hassSummary();
      setData(fresh);
    } catch (err) {
      toast.error(err.message, t('common.error'));
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
      toast.success(res.message || t('common.success'), t('common.success'));
      const fresh = await api.hassSummary();
      setData(fresh);
    } catch (err) {
      toast.error(err.message, t('common.error'));
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

  useEffect(() => {
    setAddonPage(1);
  }, [addonTab, addonSearch, addonPageSize]);

  const totalAddonPages = addonPageSize === 'all'
    ? 1
    : Math.max(1, Math.ceil(filteredAddons.length / Number(addonPageSize)));

  const paginatedAddons = useMemo(() => {
    if (addonPageSize === 'all') return filteredAddons;
    const size = Number(addonPageSize);
    const start = (addonPage - 1) * size;
    return filteredAddons.slice(start, start + size);
  }, [filteredAddons, addonPage, addonPageSize]);

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

  // Helper render đồ thị SVG đường sóng kèm vạch chia %
  function renderSvgPolyline(history, maxVal = 100, strokeColor = 'var(--accent)', fillColor = 'var(--accent-bg)', unit = '%') {
    const w = 300;
    const h = 60;
    const padX = 26;
    const chartW = w - padX;
    const topY = 6;
    const bottomY = 54;
    const usableH = bottomY - topY;

    const points = history.map((val, idx) => {
      const x = padX + (idx / (history.length - 1)) * chartW;
      const normalized = maxVal === 0 ? 0 : Math.min(100, Math.max(0, (val / maxVal) * 100));
      const y = bottomY - (normalized / 100) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pointsStr = points.join(' ');
    const areaPoints = `${padX},${bottomY} ${pointsStr} ${w},${bottomY}`;

    return (
      <svg className="w-full h-[60px] overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Vạch chia */}
        {[1, 0.5, 0].map((ratio) => {
          const y = topY + (1 - ratio) * usableH;
          const label = unit === '%' ? Math.round(ratio * 100) : (ratio === 0 ? '0' : Math.round(maxVal * ratio));
          return (
            <g key={ratio}>
              <line
                x1={padX}
                y1={y}
                x2={w}
                y2={y}
                stroke="var(--border-soft)"
                strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                strokeWidth={ratio === 0 ? '1' : '0.7'}
                strokeOpacity={ratio === 0 ? '0.5' : '0.3'}
              />
              <text
                x={padX - 4}
                y={y + 2.5}
                textAnchor="end"
                className="fill-[var(--text-faint)] text-[7.5px] font-mono select-none"
              >
                {label}{ratio === 0 ? '' : unit}
              </text>
            </g>
          );
        })}
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
            <h1 className="sk-title">{t('hass.title')}</h1>
            <span className="sk-pill sk-pill--green">
              <span className="sk-pill__dot" />
              {data?.mode === 'real' ? 'REAL HOST' : 'MOCK SUPERVISOR'}
            </span>
            <span className="sk-tag sk-tag--prod">HassOS 12.4</span>
            <span className="sk-tag sk-tag--dev">Core 2026.4</span>
          </div>
          <p className="sk-subtitle font-mono">
            {t('hass.subtitle')}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="sk-seg">
            <button
              onClick={() => setStreamInterval(1000)}
              className={`sk-seg__btn ${streamInterval === 1000 ? 'is-on' : ''}`}
            >
              1s
            </button>
            <button
              onClick={() => setStreamInterval(1500)}
              className={`sk-seg__btn ${streamInterval === 1500 ? 'is-on' : ''}`}
            >
              1.5s
            </button>
            <button
              onClick={() => setStreamInterval(3000)}
              className={`sk-seg__btn ${streamInterval === 3000 ? 'is-on' : ''}`}
            >
              3s
            </button>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`btn btn-ghost btn-sm ${isPaused ? 'text-[var(--amber)]' : ''}`}
          >
            {isPaused ? `▶ ${t('common.resume')}` : `⏸ ${t('common.pause')}`}
          </button>

          <button
            onClick={loadInitial}
            disabled={loading}
            className="btn btn-ghost btn-sm"
          >
            <span className={loading ? 'animate-spin' : ''}>⟳</span> {t('common.refresh')}
          </button>

          <Link
            to="/hass/smart-home"
            className="btn btn-primary btn-sm no-underline flex items-center gap-1.5 shadow-sm"
            title="Mở toàn bộ Smart Home Dashboard điều khiển thiết bị"
          >
            <span>🏠</span>
            <span>Smart Home Dashboard</span>
          </Link>

          {host?.ipAddress && (
            <a
              href={`http://${host.ipAddress}:${host.port || 8123}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm no-underline"
            >
              <span>{t('hass.openWeb')}</span>
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
            {t('common.retry')}
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center p-16">
          <Spinner label={t('common.loading')} />
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
              <div className="sk-kpi__label">{t('performance.cpuUsage')}</div>
              <div className="sk-kpi__sub">
                <span>{t('performance.temperature')}: <b className="text-[var(--text)] font-mono">{telemetry?.cpu?.temperatureC ?? '--'}°C</b></span>
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
              <div className="sk-kpi__label">{t('performance.ramUsage')}</div>
              <div className="sk-kpi__sub">
                <span>Total: <b className="text-[var(--text)] font-mono">{formatBytes(telemetry?.memory?.totalBytes ?? 0)}</b></span>
                <span>·</span>
                <span>Free: <b className="text-[var(--text)] font-mono">{formatBytes(telemetry?.memory?.freeBytes ?? 0)}</b></span>
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
              <div className="sk-kpi__label">{t('performance.flashUsage')}</div>
              <div className="sk-kpi__sub">
                <span>Total: <b className="text-[var(--text)] font-mono">{formatBytes(telemetry?.disk?.totalBytes ?? 0)}</b></span>
                <span>·</span>
                <span>Free: <b className="text-[var(--text)] font-mono">{formatBytes(telemetry?.disk?.freeBytes ?? 0)}</b></span>
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
              <div className="sk-kpi__label">{t('performance.totalTraffic')} (KBPS)</div>
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
                    {t('hass.hardwareHost')}
                  </h3>
                </div>
                <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                  Sync: {lastUpdate ? lastUpdate.toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN') : '--'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Host OS</div>
                  <div className="text-[var(--text)] font-semibold mt-1">{host?.operatingSystem || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Core Version</div>
                  <div className="text-[var(--accent-bright)] font-semibold mt-1">{host?.coreVersion || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Supervisor Engine</div>
                  <div className="text-[var(--green)] font-semibold mt-1">{host?.supervisorVersion || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">Hardware / Board</div>
                  <div className="text-[var(--text)] font-medium mt-1">{host?.board || 'Generic x86_64'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">IP & Port</div>
                  <div className="text-[var(--text)] font-semibold mt-1">
                    {host?.ipAddress}:{host?.port || 8123}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-faint)] uppercase">{t('performance.uptime')}</div>
                  <div className="text-[var(--text)] font-medium mt-1">
                    {formatDuration(host?.uptimeSeconds || 0, language)}
                  </div>
                </div>
              </div>

              {/* Entities Summary Badges */}
              <div className="pt-3 border-t border-[var(--border-soft)] flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase">{t('hass.entityStats')}:</span>
                <span className="sk-pill sk-pill--accent">
                  Total {entitiesStats?.total || 0}
                </span>
                <span className="sk-pill sk-pill--green">
                  Active {entitiesStats?.active || 0}
                </span>
                {entitiesStats?.unavailable > 0 && (
                  <span className="sk-pill sk-pill--red">
                    Unavailable {entitiesStats?.unavailable}
                  </span>
                )}
                <span className="sk-tag">Sensors ({entitiesStats?.domains?.sensor || 0})</span>
                <span className="sk-tag">Switches ({entitiesStats?.domains?.switch || 0})</span>
                <span className="sk-tag">Lights ({entitiesStats?.domains?.light || 0})</span>
                <span className="sk-tag">Automations ({entitiesStats?.domains?.automation || 0})</span>
                <span className="sk-tag">Climate ({entitiesStats?.domains?.climate || 0})</span>
              </div>
            </div>

            {/* Supervisor Quick Actions Pane */}
            <div className="sk-card p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
                  <span className="sk-state sk-state--amber">CONSOLE ACTIONS</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] font-mono">
                    {t('hass.quickActions')}
                  </h3>
                </div>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-2.5 font-mono leading-relaxed">
                  Send control commands to Home Assistant Core, Supervisor and Host
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => promptCoreAction('restart_core', t('hass.restartCore'), 'Restart Home Assistant Core service? Automations will pause for 15-30 seconds.')}
                  disabled={coreActionBusy}
                  className="btn btn-secondary btn-sm justify-center"
                >
                  {t('hass.restartCore')}
                </button>
                <button
                  onClick={() => promptCoreAction('restart_supervisor', t('hass.restartSupervisor'), 'Restart HassOS Supervisor process.')}
                  disabled={coreActionBusy}
                  className="btn btn-secondary btn-sm justify-center"
                >
                  {t('hass.restartSupervisor')}
                </button>
                <button
                  onClick={() => promptCoreAction('reload_automations', t('hass.reloadAutomations'), 'Reload YAML configuration without restarting Core.')}
                  disabled={coreActionBusy}
                  className="btn btn-secondary btn-sm justify-center text-[var(--accent-bright)]"
                >
                  {t('hass.reloadAutomations')}
                </button>
                <button
                  onClick={() => promptCoreAction('reboot_host', t('hass.rebootHost'), 'WARNING: Entire HassOS host will reboot. All services will be temporarily interrupted.', true)}
                  disabled={coreActionBusy}
                  className="btn btn-danger btn-sm justify-center"
                >
                  {t('hass.rebootHost')}
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
                  {t('hass.addonsTitle', { count: data?.addons?.total || 0 })}
                </h3>
                <div className="sk-seg">
                  <button
                    onClick={() => setAddonTab('all')}
                    className={`sk-seg__btn ${addonTab === 'all' ? 'is-on' : ''}`}
                  >
                    {t('hass.tabAllAddons', { count: data?.addons?.total || 0 })}
                  </button>
                  <button
                    onClick={() => setAddonTab('running')}
                    className={`sk-seg__btn ${addonTab === 'running' ? 'is-on' : ''}`}
                  >
                    {t('hass.tabRunningAddons', { count: data?.addons?.running || 0 })}
                  </button>
                  <button
                    onClick={() => setAddonTab('stopped')}
                    className={`sk-seg__btn ${addonTab === 'stopped' ? 'is-on' : ''}`}
                  >
                    {t('hass.tabStoppedAddons', { count: data?.addons?.stopped || 0 })}
                  </button>
                </div>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder={t('hass.searchAddons')}
                  value={addonSearch}
                  onChange={(e) => setAddonSearch(e.target.value)}
                  className="form-input text-xs font-mono"
                />
              </div>
            </div>

            {/* Density-First Data Table (.sk-dtable) with Responsive Horizontal Scroll */}
            <div className="overflow-x-auto">
              <table className="sk-dtable">
                <thead className="sticky top-0 z-10 bg-[var(--surface-2)] shadow-[0_1px_0_var(--border)] backdrop-blur">
                  <tr>
                    <th className="w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        title="Select all"
                      />
                    </th>
                    <th>{t('hass.colAddonName')}</th>
                    <th>{t('hass.colAddonState')}</th>
                    <th className="text-right">{t('hass.colAddonVersion')}</th>
                    <th className="text-right">{t('hass.colAddonCpu')}</th>
                    <th className="text-right">{t('hass.colAddonMem')}</th>
                    <th>PORTS</th>
                    <th className="text-right">{t('hass.colAddonActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAddons.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-10 text-xs text-[var(--text-faint)] font-mono">
                        {t('common.empty')}
                      </td>
                    </tr>
                  ) : (
                    paginatedAddons.map((ad) => {
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
                                  ...
                                </span>
                              ) : isRunning ? (
                                <>
                                  <button
                                    onClick={() => handleAddonAction(ad.slug, 'restart', ad.name)}
                                    className="btn btn-ghost btn-sm"
                                    title={t('hass.restartAddon')}
                                  >
                                    ↺ Restart
                                  </button>
                                  <button
                                    onClick={() => handleAddonAction(ad.slug, 'stop', ad.name)}
                                    className="btn btn-danger btn-sm"
                                    title={t('hass.stopAddon')}
                                  >
                                    ■ {t('hass.stopAddon')}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleAddonAction(ad.slug, 'start', ad.name)}
                                  className="btn btn-primary btn-sm"
                                  title={t('hass.startAddon')}
                                >
                                  ▶ {t('hass.startAddon')}
                                </button>
                              )}
                              <button
                                onClick={() => setActiveDrawerAddon(ad)}
                                className="btn btn-ghost btn-sm text-[var(--accent-bright)]"
                              >
                                →
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

            {/* Pagination & Density Toolbar */}
            <div className="p-3 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] text-xs font-mono text-[var(--text-dim)]">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Hiển thị {filteredAddons.length === 0 ? 0 : addonPageSize === 'all' ? 1 : (addonPage - 1) * Number(addonPageSize) + 1} - {addonPageSize === 'all' ? filteredAddons.length : Math.min(addonPage * Number(addonPageSize), filteredAddons.length)} / {filteredAddons.length} Add-on
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--text-faint)]">Mỗi trang:</span>
                  <div className="sk-seg">
                    {[8, 12, 24, 'all'].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setAddonPageSize(sz)}
                        className={`sk-seg__btn ${addonPageSize === sz ? 'is-on' : ''}`}
                      >
                        {sz === 'all' ? 'Tất cả' : sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {totalAddonPages > 1 && (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setAddonPage((p) => Math.max(1, p - 1))}
                    disabled={addonPage <= 1}
                    className="btn btn-secondary btn-xs"
                  >
                    ◀ Trước
                  </button>
                  <span className="px-2 font-semibold text-[var(--text)]">
                    {addonPage} / {totalAddonPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddonPage((p) => Math.min(totalAddonPages, p + 1))}
                    disabled={addonPage >= totalAddonPages}
                    className="btn btn-secondary btn-xs"
                  >
                    Sau ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 5. Floating BulkBar (.sk-bulkbar) theo chuẩn Section 5.7 */}
      {selectedSlugs.length > 0 && (
        <div className="sk-bulkbar">
          <span className="font-mono text-xs font-semibold text-[var(--text)]">
            {t('hass.bulkActions', { count: selectedSlugs.length })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('start')}
              disabled={bulkBusy}
              className="btn btn-primary btn-sm"
            >
              ▶ {t('hass.startAddon')}
            </button>
            <button
              onClick={() => handleBulkAction('stop')}
              disabled={bulkBusy}
              className="btn btn-danger btn-sm"
            >
              ■ {t('hass.stopAddon')}
            </button>
            <button
              onClick={() => handleBulkAction('restart')}
              disabled={bulkBusy}
              className="btn btn-secondary btn-sm"
            >
              ↺ {t('hass.restartAddon')}
            </button>
            <button
              onClick={() => setSelectedSlugs([])}
              className="btn btn-ghost btn-sm"
            >
              {t('common.cancel')}
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
                title={t('common.close')}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="sk-drawer__body space-y-5 font-mono text-xs">
              {/* Mô tả */}
              <div>
                <div className="text-[10px] uppercase text-[var(--text-faint)] font-semibold mb-1">
                  DESCRIPTION
                </div>
                <p className="text-[var(--text)] font-sans leading-relaxed text-sm bg-[var(--surface-2)] p-3 rounded border border-[var(--border-soft)]">
                  {activeDrawerAddon.description}
                </p>
              </div>

              {/* Thông số Container */}
              <div>
                <div className="text-[10px] uppercase text-[var(--text-faint)] font-semibold mb-2">
                  CONTAINER SPECS
                </div>
                <div className="grid grid-cols-2 gap-3 bg-[var(--surface-2)] p-3 rounded border border-[var(--border-soft)]">
                  <div>
                    <div className="text-[10px] text-[var(--text-faint)]">CPU</div>
                    <div className="text-sm font-bold text-[var(--cyan)] mt-0.5">
                      {activeDrawerAddon.state === 'started' ? `${activeDrawerAddon.cpuUsage}%` : '0%'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-faint)]">RAM</div>
                    <div className="text-sm font-bold text-[var(--green)] mt-0.5">
                      {activeDrawerAddon.state === 'started' ? formatBytes(activeDrawerAddon.memoryBytes) : '0 MB'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-faint)]">BOOT MODE</div>
                    <div className="text-xs font-semibold text-[var(--text)] mt-0.5 uppercase">
                      {activeDrawerAddon.boot}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-faint)]">AUTO UPDATE</div>
                    <div className="text-xs font-semibold text-[var(--text)] mt-0.5">
                      {activeDrawerAddon.auto_update ? 'Auto' : 'Manual'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cổng mạng */}
              <div>
                <div className="text-[10px] uppercase text-[var(--text-faint)] font-semibold mb-1.5">
                  NETWORK PORTS
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(activeDrawerAddon.ports || {}).length > 0 ? (
                    Object.entries(activeDrawerAddon.ports).map(([proto, port]) => (
                      <span key={proto} className="sk-tag bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]">
                        {proto} ➔ {port}
                      </span>
                    ))
                  ) : (
                    <span className="text-[var(--text-faint)] text-xs">Host network</span>
                  )}
                </div>
              </div>

              {/* Logs */}
              <div>
                <div className="text-[10px] uppercase text-[var(--text-faint)] font-semibold mb-1.5">
                  CONTAINER LOGS
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
                {t('common.close')}
              </button>
              {activeDrawerAddon.state === 'started' ? (
                <>
                  <button
                    onClick={() => handleAddonAction(activeDrawerAddon.slug, 'restart', activeDrawerAddon.name)}
                    className="btn btn-secondary btn-sm"
                  >
                    ↺ {t('hass.restartAddon')}
                  </button>
                  <button
                    onClick={() => handleAddonAction(activeDrawerAddon.slug, 'stop', activeDrawerAddon.name)}
                    className="btn btn-danger btn-sm"
                  >
                    ■ {t('hass.stopAddon')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleAddonAction(activeDrawerAddon.slug, 'start', activeDrawerAddon.name)}
                  className="btn btn-primary btn-sm"
                >
                  ▶ {t('hass.startAddon')}
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
              {t('common.cancel')}
            </button>
            <button
              onClick={executeConfirmedCoreAction}
              className={confirmModal.isDanger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
