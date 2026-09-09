import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import Spinner from '../components/Spinner.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

// Kích thước mảng đệm đồ thị thời gian thực (30 giây)
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

  // Bộ lọc danh sách VM / LXC
  const [guestTab, setGuestTab] = useState('all'); // 'all' | 'qemu' | 'lxc' | 'running'
  const [guestSearch, setGuestSearch] = useState('');

  // Bộ đệm lịch sử biểu đồ sóng SVG
  const [cpuHistory, setCpuHistory] = useState(() => createEmptyBuffer());
  const [memHistory, setMemHistory] = useState(() => createEmptyBuffer());
  const [netRxHistory, setNetRxHistory] = useState(() => createEmptyBuffer());
  const [netTxHistory, setNetTxHistory] = useState(() => createEmptyBuffer());

  const eventSourceRef = useRef(null);

  // Tải dữ liệu ban đầu
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

  // Kết nối luồng Server-Sent Events (SSE) thời gian thực
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

            // Đẩy vào bộ đệm biểu đồ
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
          // Fallback sang polling nếu SSE không khả dụng
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

  // Xử lý bật / tắt / khởi động lại VM hoặc LXC
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
      // Tải lại dữ liệu ngay
      const updated = await api.proxmoxSummary();
      setData(updated);
    } catch (err) {
      toast.error(`Lỗi thực hiện: ${err.message}`, 'Thao tác thất bại');
    } finally {
      setActionBusyId(null);
    }
  }

  // Danh sách máy ảo & container đã lọc
  const filteredGuests = useMemo(() => {
    if (!data?.guests) return [];
    const q = guestSearch.trim().toLowerCase();
    return data.guests.filter((g) => {
      // Lọc theo Tab
      if (guestTab === 'qemu' && g.type !== 'qemu') return false;
      if (guestTab === 'lxc' && g.type !== 'lxc') return false;
      if (guestTab === 'running' && g.status !== 'running') return false;

      // Tìm kiếm theo từ khóa
      if (!q) return true;
      const haystack = `${g.vmid} ${g.name} ${g.os || ''} ${g.ip || ''} ${g.description || ''} ${(g.tags || []).join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data?.guests, guestTab, guestSearch]);

  // Hàm vẽ đường cong SVG Spline
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Trang & Trạng thái Node Hypervisor */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Proxmox VE Hypervisor
              <span className="text-primary">.</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Node: {node?.node || 'pve-master'} (Online)
            </span>
            <span className="rounded-xl bg-primary-soft/60 px-2.5 py-1 text-[11px] font-bold text-primary-deep">
              {data?.mode === 'mock' ? '🧪 Mock Engine Real-time' : '🌐 Kết nối PVE Thật'}
            </span>
          </div>
          <p className="mt-1 text-xs md:text-sm text-ink-soft">
            Giám sát thời gian thực máy chủ Proxmox VE 8.x · KVM Virtual Machines · LXC Containers · ZFS Storage
          </p>
        </div>

        {/* Thanh điều khiển Live Stream & Tần suất */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-xl border border-white/60 bg-white/40 p-1 backdrop-blur-md">
            {[
              { label: '1s', val: 1000 },
              { label: '1.5s', val: 1500 },
              { label: '3s', val: 3000 },
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setStreamInterval(item.val)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  streamInterval === item.val
                    ? 'bg-primary text-white shadow-[0_0_12px_rgba(0,132,255,0.45)]'
                    : 'text-ink-soft hover:bg-white/60'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`btn-ghost px-3.5 py-2 text-xs font-bold transition ${
              isPaused ? 'text-amber-600 bg-amber-50' : 'text-primary'
            }`}
            title={isPaused ? 'Tiếp tục nhận luồng dữ liệu' : 'Tạm dừng biểu đồ'}
          >
            {isPaused ? '▶️ Tiếp tục' : '⏸️ Tạm dừng'}
          </button>

          <button
            type="button"
            onClick={loadInitial}
            disabled={loading}
            className="btn-primary px-3.5 py-2 text-xs font-bold"
            title="Làm mới ngay"
          >
            {loading ? <Spinner size="sm" /> : '⟳'} Làm mới
          </button>
        </div>
      </header>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="glass rounded-2xl border-danger/40 p-4 shadow-[0_0_24px_rgba(225,29,72,0.15)]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-danger">⚠️ {error}</p>
            <button onClick={loadInitial} className="btn-danger px-3 py-1 text-xs">
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* 2. Hàng KPI Gauges Neon Giám sát Node */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* KPI 1: CPU Load */}
        <div className="glass rounded-2xl p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[11px] text-ink-soft">Tải CPU Node</span>
            <span className="text-base">⚡</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-ink">
            {node?.cpuPercentage ?? 0}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[#00d2ff] shadow-[0_0_10px_rgba(0,132,255,0.7)] transition-all duration-500"
              style={{ width: `${Math.min(100, node?.cpuPercentage ?? 0)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-faint">
            <span>{node?.cores ?? 8} Cores / {node?.threads ?? 16} Threads</span>
            <span>Xeon E-2288G</span>
          </div>
        </div>

        {/* KPI 2: RAM Usage */}
        <div className="glass rounded-2xl p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[11px] text-ink-soft">Bộ nhớ RAM</span>
            <span className="text-base">🧠</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-ink">
            {node?.memory?.percentage ?? 0}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_10px_rgba(168,85,247,0.7)] transition-all duration-500"
              style={{ width: `${Math.min(100, node?.memory?.percentage ?? 0)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-faint">
            <span>{formatBytes(node?.memory?.used ?? 0)} / {formatBytes(node?.memory?.total ?? 0)}</span>
          </div>
        </div>

        {/* KPI 3: ZFS Pool Storage */}
        <div className="glass rounded-2xl p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[11px] text-ink-soft">ZFS Storage Pool</span>
            <span className="text-base">💽</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-ink">
            39.2%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.7)] transition-all duration-500"
              style={{ width: '39.2%' }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-faint">
            <span>785 GB / 2.0 TB NVMe</span>
            <span className="text-emerald-600 font-bold">ONLINE</span>
          </div>
        </div>

        {/* KPI 4: Load Average & IO Wait */}
        <div className="glass rounded-2xl p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[11px] text-ink-soft">Load Average</span>
            <span className="text-base">⏱️</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-ink">
            {node?.loadAverage ? node.loadAverage[0] : '1.45'}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-mono text-ink-soft">
            <span>[1m: {node?.loadAverage?.[0] || '1.45'}</span>
            <span>5m: {node?.loadAverage?.[1] || '1.28'}</span>
            <span>15m: {node?.loadAverage?.[2] || '1.15'}]</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
            <span>IO Wait: <b>{node?.ioWaitPercentage ?? 1.2}%</b></span>
            <span>SWAP: <b>{node?.swap?.percentage ?? 7.5}%</b></span>
          </div>
        </div>

        {/* KPI 5: Live Network Bandwidth */}
        <div className="glass rounded-2xl p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[11px] text-ink-soft">Băng thông mạng</span>
            <span className="text-base">🌐</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-primary">
            {traffic?.rxMbps ?? 0} <span className="text-xs font-sans text-ink-soft">Mbps</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
            <span className="text-emerald-600 font-bold">↓ {traffic?.rxMbps ?? 0} M</span>
            <span className="text-violet-600 font-bold">↑ {traffic?.txMbps ?? 0} M</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
            <span>vmbr0 + vmbr1</span>
            <span>10 GbE SFP+</span>
          </div>
        </div>

        {/* KPI 6: Tổng Máy ảo & Containers */}
        <div className="glass rounded-2xl p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="label-caps text-[11px] text-ink-soft">Máy ảo & Containers</span>
            <span className="text-base">🖥️</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-ink">
            {counts?.totalRunning ?? 6} <span className="text-xs font-sans text-ink-faint">/ {counts?.totalGuests ?? 7}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
              KVM: {counts?.vmsRunning ?? 3}/{counts?.vmsTotal ?? 4}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-tertiary-soft px-1.5 py-0.5 text-[10px] font-bold text-tertiary">
              LXC: {counts?.lxcsRunning ?? 3}/{counts?.lxcsTotal ?? 3}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
            <span className="text-emerald-600 font-semibold">● {counts?.totalRunning ?? 6} Running</span>
            <span className="text-rose-500 font-semibold">○ {counts?.totalStopped ?? 1} Stopped</span>
          </div>
        </div>
      </div>

      {/* 3. Khối Biểu Đồ Sóng Vector SVG Thời Gian Thực */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Biểu đồ 1: Tải CPU Node & Mức sử dụng RAM (%) */}
        <div className="glass rounded-2xl p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-white/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs">
                📈
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">Đồ thị Tải CPU & Sử dụng RAM Node (%)</h3>
                <p className="text-[11px] text-ink-faint">Cập nhật liên tục 30 giây gần nhất</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-primary">
                <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,132,255,0.8)]" />
                CPU: <b>{node?.cpuPercentage ?? 0}%</b>
              </span>
              <span className="flex items-center gap-1.5 text-fuchsia-600">
                <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
                RAM: <b>{node?.memory?.percentage ?? 0}%</b>
              </span>
            </div>
          </div>

          <div className="relative h-32 w-full overflow-hidden rounded-xl border border-white/50 bg-white/40 p-2">
            <svg viewBox="0 0 300 80" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pveCpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0084ff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#0084ff" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="pveMemGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#d946ef" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />
              <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />

              {/* RAM Area & Spline */}
              <path
                d={`${renderSvgPath(memHistory, 80, 300, 100)} L 300,80 L 0,80 Z`}
                fill="url(#pveMemGrad)"
              />
              <path
                d={renderSvgPath(memHistory, 80, 300, 100)}
                fill="none"
                stroke="#d946ef"
                strokeWidth="2.2"
                strokeLinecap="round"
                className="transition-all duration-300"
              />

              {/* CPU Area & Spline */}
              <path
                d={`${renderSvgPath(cpuHistory, 80, 300, 100)} L 300,80 L 0,80 Z`}
                fill="url(#pveCpuGrad)"
              />
              <path
                d={renderSvgPath(cpuHistory, 80, 300, 100)}
                fill="none"
                stroke="#0084ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
          </div>
        </div>

        {/* Biểu đồ 2: Băng thông mạng qua Linux Bridges (Rx & Tx Mbps) */}
        <div className="glass rounded-2xl p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-white/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 text-xs">
                🌐
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">Băng thông Mạng qua Bridges (vmbr0/1)</h3>
                <p className="text-[11px] text-ink-faint">Lưu lượng dữ liệu mạng máy ảo & container (Mbps)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                Download: <b>{traffic?.rxMbps ?? 0} Mbps</b>
              </span>
              <span className="flex items-center gap-1.5 text-violet-600">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                Upload: <b>{traffic?.txMbps ?? 0} Mbps</b>
              </span>
            </div>
          </div>

          <div className="relative h-32 w-full overflow-hidden rounded-xl border border-white/50 bg-white/40 p-2">
            <svg viewBox="0 0 300 80" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pveNetRxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="pveNetTxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />
              <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />

              {/* Tx Spline */}
              <path
                d={`${renderSvgPath(netTxHistory, 80, 300, 80)} L 300,80 L 0,80 Z`}
                fill="url(#pveNetTxGrad)"
              />
              <path
                d={renderSvgPath(netTxHistory, 80, 300, 80)}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2.2"
                strokeLinecap="round"
                className="transition-all duration-300"
              />

              {/* Rx Spline */}
              <path
                d={`${renderSvgPath(netRxHistory, 80, 300, 80)} L 300,80 L 0,80 Z`}
                fill="url(#pveNetRxGrad)"
              />
              <path
                d={renderSvgPath(netRxHistory, 80, 300, 80)}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 4. Bảng Quản Lý Máy Ảo KVM & Container LXC */}
      <section className="glass rounded-2xl p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/40 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#00a2ff] text-white shadow-[0_0_16px_rgba(0,132,255,0.4)]">
              🖥️
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Danh sách Máy ảo (KVM) & Container (LXC)</h2>
              <p className="text-xs text-ink-faint">
                Quản lý trạng thái, cấp phát tài nguyên vCPU, RAM, IP và lưu lượng thời gian thực
              </p>
            </div>
          </div>

          {/* Bộ lọc Tab & Ô tìm kiếm */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 rounded-xl border border-white/60 bg-white/40 p-1 backdrop-blur-md text-xs font-bold">
              {[
                { id: 'all', label: `Tất cả (${data?.guests?.length ?? 7})` },
                { id: 'qemu', label: `KVM (${data?.counts?.vmsTotal ?? 4})` },
                { id: 'lxc', label: `LXC (${data?.counts?.lxcsTotal ?? 3})` },
                { id: 'running', label: `🟢 Chạy (${data?.counts?.totalRunning ?? 6})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setGuestTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    guestTab === tab.id
                      ? 'bg-primary text-white shadow-[0_0_10px_rgba(0,132,255,0.4)]'
                      : 'text-ink-soft hover:bg-white/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-56">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
              >
                <circle cx="9" cy="9" r="5.5" />
                <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder="Tìm theo tên / ID / IP…"
                className="input-ghost pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>
        </div>

        {/* Bảng danh sách Máy ảo / Container */}
        <div className="overflow-hidden rounded-xl border border-white/60 bg-white/40">
          <div className="overflow-x-auto">
            <table className="glass-table w-full text-left text-xs">
              <thead>
                <tr className="label-caps border-b border-ink/10">
                  <th className="px-4 py-3 font-semibold">ID / Loại</th>
                  <th className="px-4 py-3 font-semibold">Tên Máy Ảo & Hệ Điều Hành</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Địa chỉ IP</th>
                  <th className="px-4 py-3 font-semibold">Tải vCPU</th>
                  <th className="px-4 py-3 font-semibold">RAM Sử dụng / Cấp</th>
                  <th className="px-4 py-3 font-semibold">Lưu lượng Mạng</th>
                  <th className="px-4 py-3 font-semibold">Uptime</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-ink-faint">
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
                        className={`transition hover:bg-white/60 ${
                          isMikrotik ? 'bg-primary-soft/30' : ''
                        }`}
                      >
                        {/* 1. ID & Badge Loại */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-mono font-bold">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                                isLxc
                                  ? 'bg-tertiary-soft text-tertiary'
                                  : 'bg-primary-soft text-primary-deep'
                              }`}
                            >
                              {isLxc ? 'LXC' : 'KVM'}
                            </span>
                            <span className="text-ink">{guest.vmid}</span>
                          </div>
                        </td>

                        {/* 2. Tên & OS Info */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-xs text-base">
                              {isMikrotik ? '📡' : isLxc ? '📦' : '🖥️'}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-bold text-ink">
                                <span>{guest.name}</span>
                                {isMikrotik && (
                                  <span className="rounded-full bg-primary text-white px-2 py-0.2 text-[9px] font-bold shadow-[0_0_8px_rgba(0,132,255,0.6)]">
                                    RouterOS Gateway
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-ink-faint">
                                {guest.os} {guest.description ? `· ${guest.description}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Trạng thái */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              isRunning
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                              }`}
                            />
                            {isRunning ? 'Running' : 'Stopped'}
                          </span>
                        </td>

                        {/* 4. Địa chỉ IP */}
                        <td className="px-4 py-3 font-mono text-[11px] text-ink-soft">
                          {guest.ip ? (
                            <span className="rounded-md bg-ink/5 px-2 py-0.5">{guest.ip}</span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* 5. Tải vCPU */}
                        <td className="px-4 py-3">
                          {isRunning ? (
                            <div className="w-24">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span>{Math.round((guest.cpuUsage || 0) * 100)}%</span>
                                <span className="text-[10px] text-ink-faint">{guest.cpus} vCPU</span>
                              </div>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink/10">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${Math.min(100, Math.round((guest.cpuUsage || 0) * 100))}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>

                        {/* 6. RAM Sử dụng */}
                        <td className="px-4 py-3 font-mono text-[11px] text-ink-soft">
                          {isRunning ? (
                            <div>
                              <span>{formatBytes(guest.mem || 0)}</span>
                              <span className="text-ink-faint"> / {formatBytes(guest.maxmem || 0)}</span>
                            </div>
                          ) : (
                            <span>{formatBytes(guest.maxmem || 0)} (Cấp)</span>
                          )}
                        </td>

                        {/* 7. Lưu lượng Mạng */}
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {isRunning ? (
                            <div className="text-[11px]">
                              <span className="text-emerald-600 font-semibold">
                                ↓ {((guest.netin || 0) / 1000000).toFixed(1)}M
                              </span>{' '}
                              <span className="text-violet-600 font-semibold">
                                ↑ {((guest.netout || 0) / 1000000).toFixed(1)}M
                              </span>
                            </div>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>

                        {/* 8. Uptime */}
                        <td className="px-4 py-3 text-ink-soft">
                          {isRunning && guest.uptime ? formatDuration(guest.uptime) : '—'}
                        </td>

                        {/* 9. Thao tác */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isRunning ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleGuestAction(guest, 'reboot')}
                                  disabled={actionBusyId === guest.vmid}
                                  className="btn-ghost px-2 py-1 text-[11px] font-semibold text-primary"
                                  title="Khởi động lại máy ảo"
                                >
                                  ↺ Reboot
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGuestAction(guest, 'shutdown')}
                                  disabled={actionBusyId === guest.vmid}
                                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-50 transition"
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
                                className="btn-primary px-2.5 py-1 text-[11px] font-semibold"
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
        </div>
      </section>

      {/* 5. Khối Storage Pools & Linux Network Bridges */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Storage Pools */}
        <section className="glass rounded-2xl p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-white/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 text-xs">
                💽
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">Phân Vùng Ổ Cứng (Storage Pools)</h3>
                <p className="text-[11px] text-ink-faint">ZFS Pools, Local Rootfs và Proxmox Backup Server</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-ink-faint">
              {data?.storage?.length ?? 3} Pools Active
            </span>
          </div>

          <div className="space-y-3">
            {(data?.storage || []).map((st) => {
              const pct = Math.round(((st.used || 0) / (st.total || 1)) * 100);
              return (
                <div
                  key={st.storage}
                  className="rounded-xl border border-white/60 bg-white/50 p-3.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink">{st.storage}</span>
                      <span className="rounded-md bg-ink/5 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-soft">
                        {st.type}
                      </span>
                    </div>
                    <div className="text-xs font-bold font-mono text-ink">
                      {pct}% <span className="text-[10px] font-normal text-ink-faint">({formatBytes(st.used)} / {formatBytes(st.total)})</span>
                    </div>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct > 80 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-faint">
                    <span>{st.description}</span>
                    <span className="font-bold text-emerald-600">Còn trống: {formatBytes(st.avail)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Linux Network Bridges */}
        <section className="glass rounded-2xl p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-white/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs">
                🔌
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">Cổng Mạng & Linux Bridges (Networking)</h3>
                <p className="text-[11px] text-ink-faint">Card mạng vật lý, Virtual Bridges và VLAN trunking</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-ink-faint">
              {data?.network?.length ?? 4} Interfaces
            </span>
          </div>

          <div className="space-y-2.5">
            {(data?.network || []).map((iface) => (
              <div
                key={iface.iface}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/50 p-3 shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold font-mono">
                    {iface.type === 'bridge' ? 'BR' : 'NIC'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink">{iface.iface}</span>
                      {iface.cidr && (
                        <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary-deep">
                          {iface.cidr}
                        </span>
                      )}
                      {iface.bridge_vlan_aware ? (
                        <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
                          VLAN Aware
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-ink-faint truncate">
                      {iface.comment}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    UP
                  </span>
                  <div className="text-[10px] font-mono text-ink-faint mt-0.5">
                    {iface.speed}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 6. Footer thông số Phần cứng Hypervisor */}
      <footer className="glass rounded-2xl p-4 shadow-xs text-xs text-ink-soft flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>🖥️ <b>Kernel:</b> Linux 6.8.4-2-pve</span>
          <span>·</span>
          <span>⚙️ <b>CPU:</b> Intel(R) Xeon(R) E-2288G @ 3.70GHz (8C/16T)</span>
          <span>·</span>
          <span>⏱️ <b>Uptime Node:</b> {node?.uptimeSeconds ? formatDuration(node.uptimeSeconds) : '18 ngày'}</span>
        </div>
        <div className="text-[11px] text-ink-faint">
          Đồng bộ lần cuối: {lastUpdate ? lastUpdate.toLocaleTimeString('vi-VN') : '—'}
        </div>
      </footer>
    </div>
  );
}
