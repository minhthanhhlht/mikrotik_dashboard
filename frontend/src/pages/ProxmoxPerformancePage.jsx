import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const BUFFER_SIZE = 30;

function createEmptyBuffer(length = BUFFER_SIZE) {
  return Array.from({ length }, () => 0);
}

export default function ProxmoxPerformancePage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [streamInterval, setStreamInterval] = useState(1500);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);

  const [guestTab, setGuestTab] = useState('all');
  const [guestSearch, setGuestSearch] = useState('');

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
    } catch (err) {
      setError(err.message || 'Không thể kết nối Proxmox VE API.');
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
            console.error('Lỗi parse SSE Proxmox:', e);
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

  async function handleGuestAction(guest, action) {
    const actionNames = {
      start: 'Khởi động',
      shutdown: 'Tắt máy an toàn',
      stop: 'Tắt nguồn (Stop)',
      reboot: 'Khởi động lại',
    };
    const actName = actionNames[action] || action;
    setActionBusyId(guest.vmid);
    try {
      await api.proxmoxGuestAction(guest.type, guest.vmid, action);
      toast.success(
        `Đã gửi lệnh "${actName}" tới ${guest.type.toUpperCase()} ${guest.vmid} (${guest.name})`,
        'Thao tác thành công'
      );
      const updated = await api.proxmoxSummary();
      setData(updated);
    } catch (err) {
      toast.error(`Lỗi thực hiện: ${err.message}`, 'Thao tác thất bại');
    } finally {
      setActionBusyId(null);
    }
  }

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

  function renderSvgPath(dataPoints, height = 80, width = 300, maxVal = 100) {
    if (!dataPoints || dataPoints.length === 0) return '';
    const step = width / (dataPoints.length - 1);
    const points = dataPoints.map((val, i) => {
      const clamped = Math.max(0, Math.min(maxVal, val));
      const y = height - (clamped / maxVal) * (height - 8) - 4;
      return [i * step, y];
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

  return (
    <div className="space-y-6">
      {/* 1. Header Trang */}
      <div className="sk-topbar flex-wrap">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="sk-title">Proxmox VE Hypervisor</h1>
            <span className="sk-pill sk-pill--green text-[10px]">
              <span className="sk-pill__dot" />
              Node: {node?.node || 'pve-master'}
            </span>
            <span className="sk-tag sk-tag--dev text-[9px]">
              {data?.mode === 'mock' ? 'MOCK ENGINE' : 'LIVE API'}
            </span>
          </div>
          <p className="sk-subtitle font-mono">
            Giám sát thời gian thực Proxmox VE 8.x · KVM Virtual Machines · LXC Containers · ZFS Storage
          </p>
        </div>

        {/* Thanh điều khiển Live Stream & Tần suất */}
        <div className="flex flex-wrap items-center gap-2.5">
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
            {isPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
          </button>

          <button
            type="button"
            onClick={loadInitial}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            {loading ? <Spinner size="xs" /> : '⟳'} Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[var(--red)]">⚠️ {error}</p>
            <button onClick={loadInitial} className="btn btn-danger btn-sm">
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* 2. Hàng 6 KPI Gauges Giám sát Node */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* KPI 1: CPU Load */}
        <div className="sk-kpi p-3.5">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">CPU Node</span>
            <span className="font-mono text-xs">⚡</span>
          </div>
          <div className="font-mono text-xl font-bold text-[var(--text)]">
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
        <div className="sk-kpi p-3.5">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">Bộ nhớ RAM</span>
            <span className="font-mono text-xs">🧠</span>
          </div>
          <div className="font-mono text-xl font-bold text-[var(--text)]">
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
        <div className="sk-kpi p-3.5">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">ZFS Pool</span>
            <span className="font-mono text-xs">💽</span>
          </div>
          <div className="font-mono text-xl font-bold text-[var(--text)]">
            39.2%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full rounded-full bg-[var(--green)] transition-all duration-300"
              style={{ width: '39.2%' }}
            />
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)] truncate">
            785 GB / 2.0 TB NVMe
          </div>
        </div>

        {/* KPI 4: Load Average */}
        <div className="sk-kpi p-3.5">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">Load Average</span>
            <span className="font-mono text-xs">⏱️</span>
          </div>
          <div className="font-mono text-xl font-bold text-[var(--text)]">
            {node?.loadAverage ? node.loadAverage[0] : '1.45'}
          </div>
          <div className="mt-2 font-mono text-[10px] text-[var(--text-dim)]">
            5m: {node?.loadAverage?.[1] || '1.28'} · 15m: {node?.loadAverage?.[2] || '1.15'}
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)]">
            IO Wait: {node?.ioWaitPercentage ?? 1.2}%
          </div>
        </div>

        {/* KPI 5: Live Network Bandwidth */}
        <div className="sk-kpi p-3.5">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">Băng thông</span>
            <span className="font-mono text-xs">🌐</span>
          </div>
          <div className="font-mono text-xl font-bold text-[var(--accent-bright)]">
            {traffic?.rxMbps ?? 0} <span className="text-xs font-normal text-[var(--text-dim)]">Mbps</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
            <span className="text-[var(--green)]">↓ {traffic?.rxMbps ?? 0} M</span>
            <span className="text-[var(--violet)]">↑ {traffic?.txMbps ?? 0} M</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)]">
            vmbr0 + vmbr1
          </div>
        </div>

        {/* KPI 6: Tổng Máy ảo & Containers */}
        <div className="sk-kpi p-3.5">
          <div className="sk-kpi__header mb-1">
            <span className="sk-kpi__label text-[10px]">VMs & LXCs</span>
            <span className="font-mono text-xs">🖥️</span>
          </div>
          <div className="font-mono text-xl font-bold text-[var(--text)]">
            {counts?.totalRunning ?? 6} <span className="text-xs text-[var(--text-faint)]">/ {counts?.totalGuests ?? 7}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px]">
            <span className="sk-tag sk-tag--prod py-0 px-1">KVM: {counts?.vmsRunning ?? 3}/{counts?.vmsTotal ?? 4}</span>
            <span className="sk-tag sk-tag--dev py-0 px-1">LXC: {counts?.lxcsRunning ?? 3}/{counts?.lxcsTotal ?? 3}</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-faint)]">
            ● {counts?.totalRunning ?? 6} Running · ○ {counts?.totalStopped ?? 1} Stopped
          </div>
        </div>
      </div>

      {/* 3. Khối Biểu Đồ Sóng Vector SVG */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Biểu đồ 1: Tải CPU & RAM */}
        <div className="sk-card">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Đồ thị Tải CPU & Sử dụng RAM Node (%)</h3>
              <p className="font-mono text-[11px] text-[var(--text-faint)]">30 giây gần nhất</p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-[var(--accent-bright)]">CPU: {node?.cpuPercentage ?? 0}%</span>
              <span className="text-[var(--violet)]">RAM: {node?.memory?.percentage ?? 0}%</span>
            </div>
          </div>

          <div className="relative h-32 w-full">
            <svg viewBox="0 0 300 80" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <line x1="0" y1="20" x2="300" y2="20" stroke="var(--border-soft)" strokeDasharray="3 3" />
              <line x1="0" y1="40" x2="300" y2="40" stroke="var(--border-soft)" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="var(--border-soft)" strokeDasharray="3 3" />

              {/* RAM Area & Spline */}
              <path
                d={`${renderSvgPath(memHistory, 80, 300, 100)} L 300,80 L 0,80 Z`}
                fill="var(--violet)"
                fillOpacity="0.08"
              />
              <path
                d={renderSvgPath(memHistory, 80, 300, 100)}
                fill="none"
                stroke="var(--violet)"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* CPU Area & Spline */}
              <path
                d={`${renderSvgPath(cpuHistory, 80, 300, 100)} L 300,80 L 0,80 Z`}
                fill="var(--accent)"
                fillOpacity="0.1"
              />
              <path
                d={renderSvgPath(cpuHistory, 80, 300, 100)}
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
              <h3 className="text-sm font-bold text-[var(--text)]">Băng thông Mạng qua Bridges (vmbr0/1)</h3>
              <p className="font-mono text-[11px] text-[var(--text-faint)]">Lưu lượng dữ liệu mạng máy ảo (Mbps)</p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-[var(--green)]">↓ {traffic?.rxMbps ?? 0} Mbps</span>
              <span className="text-[var(--cyan)]">↑ {traffic?.txMbps ?? 0} Mbps</span>
            </div>
          </div>

          <div className="relative h-32 w-full">
            <svg viewBox="0 0 300 80" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <line x1="0" y1="20" x2="300" y2="20" stroke="var(--border-soft)" strokeDasharray="3 3" />
              <line x1="0" y1="40" x2="300" y2="40" stroke="var(--border-soft)" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="var(--border-soft)" strokeDasharray="3 3" />

              {/* Tx Spline */}
              <path
                d={`${renderSvgPath(netTxHistory, 80, 300, 80)} L 300,80 L 0,80 Z`}
                fill="var(--cyan)"
                fillOpacity="0.08"
              />
              <path
                d={renderSvgPath(netTxHistory, 80, 300, 80)}
                fill="none"
                stroke="var(--cyan)"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Rx Spline */}
              <path
                d={`${renderSvgPath(netRxHistory, 80, 300, 80)} L 300,80 L 0,80 Z`}
                fill="var(--green)"
                fillOpacity="0.1"
              />
              <path
                d={renderSvgPath(netRxHistory, 80, 300, 80)}
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
            <h2 className="text-base font-bold text-[var(--text)]">Danh sách Máy ảo (KVM) & Container (LXC)</h2>
            <p className="font-mono text-xs text-[var(--text-faint)]">
              Quản lý trạng thái, cấp phát tài nguyên vCPU, RAM, IP và lưu lượng thời gian thực
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="sk-seg">
              {[
                { id: 'all', label: `Tất cả (${data?.guests?.length ?? 7})` },
                { id: 'qemu', label: `KVM (${data?.counts?.vmsTotal ?? 4})` },
                { id: 'lxc', label: `LXC (${data?.counts?.lxcsTotal ?? 3})` },
                { id: 'running', label: `Chạy (${data?.counts?.totalRunning ?? 6})` },
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
                placeholder="Tìm theo tên / ID / IP…"
                className="form-input text-xs h-8"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="sk-dtable">
            <thead>
              <tr>
                <th>ID / Loại</th>
                <th>Tên Máy Ảo & Hệ Điều Hành</th>
                <th>Trạng thái</th>
                <th>Địa chỉ IP</th>
                <th>Tải vCPU</th>
                <th>RAM Dùng / Cấp</th>
                <th>Lưu lượng Mạng</th>
                <th>Uptime</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center font-mono text-xs text-[var(--text-faint)]">
                    Không tìm thấy máy ảo hoặc container nào phù hợp.
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
                          <span>{formatBytes(guest.maxmem || 0)} (Cấp)</span>
                        )}
                      </td>

                      {/* Mạng */}
                      <td className="font-mono text-xs">
                        {isRunning ? (
                          <div>
                            <span className="text-[var(--green)] font-semibold">
                              ↓ {((guest.netin || 0) / 1000000).toFixed(1)}M
                            </span>{' '}
                            <span className="text-[var(--violet)] font-semibold">
                              ↑ {((guest.netout || 0) / 1000000).toFixed(1)}M
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-faint)]">—</span>
                        )}
                      </td>

                      {/* Uptime */}
                      <td className="font-mono text-xs text-[var(--text-faint)]">
                        {isRunning && guest.uptime ? formatDuration(guest.uptime) : '—'}
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
                                className="btn btn-secondary btn-sm text-[11px] px-2 py-0.5 h-7 font-mono"
                                title="Khởi động lại máy ảo"
                              >
                                ↺ Reboot
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGuestAction(guest, 'shutdown')}
                                disabled={actionBusyId === guest.vmid}
                                className="btn btn-danger btn-sm text-[11px] px-2 py-0.5 h-7 font-mono"
                                title="Tắt máy an toàn"
                              >
                                ⏹ Stop
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGuestAction(guest, 'start')}
                              disabled={actionBusyId === guest.vmid}
                              className="btn btn-primary btn-sm text-[11px] px-2.5 py-0.5 h-7 font-mono"
                              title="Bật máy ảo"
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

      {/* 5. Storage Pools & Linux Network Bridges */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Storage Pools */}
        <section className="sk-card">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Phân Vùng Ổ Cứng (Storage Pools)</h3>
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
                    <span className="font-bold text-[var(--green)]">Trống: {formatBytes(st.avail)}</span>
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
              <h3 className="text-sm font-bold text-[var(--text)]">Cổng Mạng & Linux Bridges (Networking)</h3>
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

      {/* 6. Footer Hypervisor */}
      <footer className="sk-card p-4 text-xs font-mono text-[var(--text-faint)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>🖥️ Kernel: Linux 6.8.4-2-pve</span>
          <span>·</span>
          <span>⏱️ Uptime Node: {node?.uptimeSeconds ? formatDuration(node.uptimeSeconds) : '18 ngày'}</span>
        </div>
        <div>
          Đồng bộ lần cuối: {lastUpdate ? lastUpdate.toLocaleTimeString('vi-VN') : '—'}
        </div>
      </footer>
    </div>
  );
}
