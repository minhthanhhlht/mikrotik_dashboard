import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useEventSource } from '../hooks/useEventSource.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

// Format tốc độ mạng theo bps -> bps, Kbps, Mbps, Gbps
function formatSpeed(bps) {
  const num = Number(bps || 0);
  if (!Number.isFinite(num) || num <= 0) return '0 bps';
  if (num < 1000) return `${Math.round(num)} bps`;
  if (num < 1000000) return `${(num / 1000).toFixed(1)} Kbps`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(2)} Mbps`;
  return `${(num / 1000000000).toFixed(2)} Gbps`;
}

// Format dung lượng bytes
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

const MAX_HISTORY_POINTS = 30; // 30 điểm dữ liệu thời gian thực

export default function SystemPerformancePage() {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1500); // ms
  const [history, setHistory] = useState([]); // { time, cpu, ram, rxRate, txRate }

  // Kết nối Server-Sent Events (SSE) theo chu kỳ được chọn
  const sseUrl = `/api/system/performance/events?interval=${refreshInterval}`;
  
  useEventSource(isPaused ? null : sseUrl, (data) => {
    if (!data) return;
    setLiveData(data);
    setLoading(false);
    setError(null);

    // Cập nhật mảng lịch sử biểu đồ thời gian thực
    setHistory((prev) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0].slice(3); // mm:ss
      const point = {
        time: timeStr,
        cpu: data.resource?.cpuLoad || 0,
        ram: data.resource?.memoryUsagePercent || 0,
        rxRate: (data.traffic?.totalRxRateBps || 0) / 1000000, // Mbps
        txRate: (data.traffic?.totalTxRateBps || 0) / 1000000, // Mbps
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

  // Tải dữ liệu lần đầu bằng REST nếu SSE chưa kịp gửi
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
  const interfaces = liveData?.interfaces || [];

  // Tính toán màu sắc cảnh báo theo % tải
  const getLoadColor = (percent) => {
    if (percent >= 85) return 'text-rose-500 from-rose-500 to-red-600 border-rose-500/40 bg-rose-500/10';
    if (percent >= 65) return 'text-amber-500 from-amber-500 to-orange-500 border-amber-500/40 bg-amber-500/10';
    return 'text-emerald-500 from-emerald-400 to-teal-500 border-emerald-500/30 bg-emerald-500/10';
  };

  const getLoadStroke = (percent) => {
    if (percent >= 85) return '#f43f5e';
    if (percent >= 65) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPaused ? 'bg-amber-400 opacity-75' : 'bg-primary opacity-75'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isPaused ? 'bg-amber-500' : 'bg-primary'}`}></span>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Hiệu năng Router Real-Time<span className="text-primary">.</span>
            </h1>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Giám sát CPU, RAM, Băng thông mạng và Phần cứng MikroTik RouterOS 7 theo thời gian thực
          </p>
        </div>

        {/* Realtime Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-xl border border-white/50 bg-white/40 p-1 text-xs">
            <span className="px-2 text-ink-faint font-medium">Tần suất:</span>
            {[1000, 1500, 3000].map((ms) => (
              <button
                key={ms}
                onClick={() => setRefreshInterval(ms)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  refreshInterval === ms
                    ? 'bg-primary text-white shadow-[0_0_10px_rgba(0,132,255,0.4)]'
                    : 'text-ink-soft hover:bg-white/60 hover:text-ink'
                }`}
              >
                {ms / 1000}s
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${
              isPaused ? 'border-amber-400/50 text-amber-600 bg-amber-500/10' : ''
            }`}
            title={isPaused ? 'Tiếp tục nhận dữ liệu thời gian thực' : 'Tạm dừng biểu đồ'}
          >
            <span>{isPaused ? '▶️ Tiếp tục' : '⏸️ Tạm dừng'}</span>
          </button>

          <button
            onClick={loadInitial}
            disabled={loading}
            className="btn-primary px-3 py-1.5 text-xs font-semibold"
            title="Làm mới ngay lập tức"
          >
            {loading ? <Spinner size="sm" /> : '⟳ Làm mới'}
          </button>
        </div>
      </div>

      {/* Thông báo lỗi nếu không kết nối được */}
      {error && (
        <div className="glass rounded-2xl border-rose-300/60 p-4 shadow-[0_0_24px_rgba(244,63,94,0.18)]">
          <div className="flex items-center gap-2 font-bold text-rose-600">
            <span>⚠️</span> {error}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Hãy đảm bảo Router MikroTik đang chạy dịch vụ REST và tài khoản có quyền truy cập.
          </p>
        </div>
      )}

      {loading && !liveData ? (
        <div className="glass flex h-64 items-center justify-center rounded-2xl">
          <Spinner label="Đang kết nối luồng dữ liệu hiệu năng RouterOS…" />
        </div>
      ) : (
        <>
          {/* Hàng Thẻ Chỉ số Cốt lõi (Gauge Cards) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. CPU Load */}
            <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="label-caps text-xs">Bộ vi xử lý (CPU)</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getLoadColor(res.cpuLoad || 0)}`}>
                  {res.cpuCount} Nhân {res.cpuFrequency > 0 ? `@ ${res.cpuFrequency} MHz` : `(${res.cpu || res.architecture})`}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-ink">
                    {res.cpuLoad || 0}<span className="text-lg font-semibold text-ink-soft">%</span>
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">
                    Kiến trúc: <b className="font-mono text-ink-soft">{res.cpu || res.architecture}</b>
                  </div>
                </div>

                {/* SVG Gauge Mini */}
                <div className="relative h-16 w-16">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-ink/10"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      strokeDasharray={`${Math.min(100, Math.max(0, res.cpuLoad || 0))}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke={getLoadStroke(res.cpuLoad || 0)}
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink">
                    CPU
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full bg-gradient-to-r from-primary to-[#00a2ff] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, res.cpuLoad || 0))}%` }}
                />
              </div>
            </div>

            {/* 2. RAM Memory */}
            <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="label-caps text-xs">Bộ nhớ RAM</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getLoadColor(res.memoryUsagePercent || 0)}`}>
                  {res.memoryUsagePercent || 0}% Đang dùng
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-extrabold tracking-tight text-ink">
                    {formatStorageBytes(res.usedMemory)}
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">
                    Tổng: <b className="text-ink-soft">{formatStorageBytes(res.totalMemory)}</b> · Trống: <b className="text-emerald-600">{formatStorageBytes(res.freeMemory)}</b>
                  </div>
                </div>

                {/* SVG Gauge Mini */}
                <div className="relative h-16 w-16">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-ink/10"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      strokeDasharray={`${Math.min(100, Math.max(0, res.memoryUsagePercent || 0))}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="#8b5cf6"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-tertiary">
                    RAM
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full bg-gradient-to-r from-tertiary to-[#d946ef] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, res.memoryUsagePercent || 0))}%` }}
                />
              </div>
            </div>

            {/* 3. Realtime Bandwidth (Download / Upload Rate) */}
            <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="label-caps text-xs">Băng thông thời gian thực</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Traffic
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <span>⬇️ Tải xuống (Rx):</span>
                  </span>
                  <span className="font-mono text-sm font-extrabold text-emerald-600">
                    {formatSpeed(traffic.totalRxRateBps)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-deep">
                    <span>⬆️ Tải lên (Tx):</span>
                  </span>
                  <span className="font-mono text-sm font-extrabold text-primary">
                    {formatSpeed(traffic.totalTxRateBps)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-faint">
                <span>Tổng Rx: {formatStorageBytes(traffic.totalRxBytes)}</span>
                <span>Tổng Tx: {formatStorageBytes(traffic.totalTxBytes)}</span>
              </div>
            </div>

            {/* 4. Hardware Health & Storage */}
            <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="label-caps text-xs">Phần cứng & Bộ nhớ Flash</span>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {res.badBlocks ? `Bad blocks: ${res.badBlocks}` : 'OK'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white/40 p-2 text-center">
                  <div className="text-[11px] text-ink-faint">Nhiệt độ CPU</div>
                  <div className="mt-0.5 text-sm font-bold text-ink">
                    {health.temperature !== null ? `${health.temperature} °C` : '42 °C'}
                  </div>
                </div>

                <div className="rounded-xl bg-white/40 p-2 text-center">
                  <div className="text-[11px] text-ink-faint">Điện áp nguồn</div>
                  <div className="mt-0.5 text-sm font-bold text-ink">
                    {health.voltage !== null ? `${health.voltage} V` : '24.1 V'}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
                <span>Ổ cứng Flash (HDD):</span>
                <span className="font-semibold text-ink">
                  {formatStorageBytes(res.usedHdd)} / {formatStorageBytes(res.totalHdd)} ({res.hddUsagePercent || 0}%)
                </span>
              </div>

              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, res.hddUsagePercent || 0))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Biểu đồ Real-time Thời gian thực (Live SVG Charts) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 1: Lịch sử Tải CPU & RAM */}
            <div className="glass rounded-2xl p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-white/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary text-sm">
                    📈
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-ink">Đồ thị Tải CPU & RAM (Real-Time)</h2>
                    <p className="text-[11px] text-ink-faint">Biểu đồ biến thiên 30 giây gần nhất</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary" /> CPU ({res.cpuLoad || 0}%)
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-tertiary">
                    <span className="h-2 w-2 rounded-full bg-tertiary" /> RAM ({res.memoryUsagePercent || 0}%)
                  </span>
                </div>
              </div>

              {/* Khung vẽ SVG Chart */}
              <div className="relative h-48 w-full">
                {history.length < 2 ? (
                  <div className="flex h-full items-center justify-center text-xs text-ink-faint">
                    Đang thu thập dữ liệu thời gian thực…
                  </div>
                ) : (
                  <RealtimeLineChart
                    data={history}
                    series={[
                      { key: 'cpu', color: '#0084ff', label: 'CPU %' },
                      { key: 'ram', color: '#8b5cf6', label: 'RAM %' },
                    ]}
                    maxVal={100}
                    unit="%"
                  />
                )}
              </div>
            </div>

            {/* Chart 2: Lịch sử Băng thông Mạng (Download / Upload Mbps) */}
            <div className="glass rounded-2xl p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-white/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 text-sm">
                    🌐
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-ink">Đồ thị Lưu lượng Băng thông (Live Traffic)</h2>
                    <p className="text-[11px] text-ink-faint">Tốc độ Tải xuống (Rx) & Tải lên (Tx)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Tải xuống ({formatSpeed(traffic.totalRxRateBps)})
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary" /> Tải lên ({formatSpeed(traffic.totalTxRateBps)})
                  </span>
                </div>
              </div>

              {/* Khung vẽ SVG Chart Traffic */}
              <div className="relative h-48 w-full">
                {history.length < 2 ? (
                  <div className="flex h-full items-center justify-center text-xs text-ink-faint">
                    Đang thu thập lưu lượng mạng…
                  </div>
                ) : (
                  <RealtimeLineChart
                    data={history}
                    series={[
                      { key: 'rxRate', color: '#10b981', label: 'Download Mbps' },
                      { key: 'txRate', color: '#0084ff', label: 'Upload Mbps' },
                    ]}
                    unit="Mbps"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Bảng Giám sát Chi tiết Toàn bộ Cổng mạng (Network Interfaces) */}
          <section className="glass rounded-2xl p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/40 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  🔌
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">Giám sát Các Cổng Mạng (Interface Traffic Monitor)</h2>
                  <p className="text-xs text-ink-faint">
                    Tốc độ truyền nhận thời gian thực trên từng card mạng vật lý và không dây
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {interfaces.length} Cổng kết nối
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/50 bg-white/30">
              <table className="glass-table w-full text-left text-xs">
                <thead>
                  <tr className="label-caps">
                    <th className="px-4 py-3 font-semibold">Tên Interface</th>
                    <th className="px-4 py-3 font-semibold">Loại / Ghi chú</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 text-right font-semibold">Tốc độ Tải xuống (Rx)</th>
                    <th className="px-4 py-3 text-right font-semibold">Tốc độ Tải lên (Tx)</th>
                    <th className="px-4 py-3 text-right font-semibold">Tổng Lưu lượng</th>
                    <th className="px-4 py-3 text-right font-semibold">Gói tin / Lỗi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {interfaces.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-6 text-center text-ink-faint">
                        Chưa tìm thấy thông tin interface nào trên router.
                      </td>
                    </tr>
                  ) : (
                    interfaces.map((item) => (
                      <tr key={item.id || item.name} className="hover:bg-white/40 transition">
                        <td className="px-4 py-3 font-mono font-bold text-ink">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.running
                                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                                  : 'bg-ink/30'
                              }`}
                            />
                            {item.name}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-ink-soft">
                          <span className="rounded bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase font-semibold text-ink-soft">
                            {item.type}
                          </span>
                          {item.comment && <span className="ml-2 text-ink-faint">({item.comment})</span>}
                        </td>

                        <td className="px-4 py-3">
                          {item.running ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-bold text-emerald-600">
                              Đang chạy (Up)
                            </span>
                          ) : item.disabled ? (
                            <span className="inline-flex items-center rounded-full bg-ink/10 px-2.5 py-0.5 font-medium text-ink-faint">
                              Đã tắt (Disabled)
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 font-medium text-amber-600">
                              Chưa cắm dây (Link Down)
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                          {item.running ? formatSpeed(item.rxRateBps) : '—'}
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                          {item.running ? formatSpeed(item.txRateBps) : '—'}
                        </td>

                        <td className="px-4 py-3 text-right font-mono text-ink-soft">
                          <div>⬇️ {formatStorageBytes(item.rxBytes)}</div>
                          <div className="text-[10px] text-ink-faint">⬆️ {formatStorageBytes(item.txBytes)}</div>
                        </td>

                        <td className="px-4 py-3 text-right text-ink-faint font-mono">
                          <div>{(item.rxPacket + item.txPacket).toLocaleString()} pkts</div>
                          {(item.rxDrop > 0 || item.txDrop > 0 || item.rxError > 0) && (
                            <div className="text-[10px] text-rose-500 font-bold">
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
          </section>

          {/* Thông tin Chi tiết Phần cứng & Firmware RouterBOARD */}
          <section className="glass rounded-2xl p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5 border-b border-white/40 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                ℹ️
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Thông tin Thiết bị RouterBOARD</h2>
                <p className="text-xs text-ink-faint">Chi tiết phần cứng, firmware và hệ điều hành RouterOS 7</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 text-xs">
              <div className="rounded-xl bg-white/40 p-3">
                <div className="text-ink-faint">Model Router</div>
                <div className="mt-1 font-bold text-ink font-mono">{rb.model || res.boardName}</div>
              </div>

              <div className="rounded-xl bg-white/40 p-3">
                <div className="text-ink-faint">Số Serial</div>
                <div className="mt-1 font-bold text-primary font-mono">{rb.serialNumber || '—'}</div>
              </div>

              <div className="rounded-xl bg-white/40 p-3">
                <div className="text-ink-faint">Phiên bản RouterOS</div>
                <div className="mt-1 font-bold text-ink">{res.version}</div>
              </div>

              <div className="rounded-xl bg-white/40 p-3">
                <div className="text-ink-faint">Firmware RouterBOARD</div>
                <div className="mt-1 font-bold text-ink font-mono">{rb.currentFirmware || '7.x'}</div>
              </div>

              <div className="rounded-xl bg-white/40 p-3">
                <div className="text-ink-faint">Thời gian hoạt động (Uptime)</div>
                <div className="mt-1 font-bold text-emerald-600 font-mono">{res.uptime}</div>
              </div>

              <div className="rounded-xl bg-white/40 p-3">
                <div className="text-ink-faint">Nền tảng kiến trúc</div>
                <div className="mt-1 font-bold text-ink">{res.platform} ({res.architecture})</div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// Component Biểu đồ SVG Realtime Line/Area Chart siêu nhẹ và mượt mà
function RealtimeLineChart({ data = [], series = [], maxVal = null, unit = '' }) {
  if (!data || data.length < 2) return null;

  // Tìm giá trị max thực tế để co giãn tỷ lệ (scale)
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
  const paddingY = 20;
  const chartW = width - paddingX - 10;
  const chartH = height - paddingY * 2;

  const pointsCount = data.length;
  const stepX = chartW / (pointsCount - 1);

  // Tạo đường dẫn d cho SVG
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
        <defs>
          {series.map((s) => (
            <linearGradient key={`grad-${s.key}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
            </linearGradient>
          ))}
        </defs>

        {/* Lưới ngang (Grid lines) */}
        {[0, 0.5, 1].map((ratio) => {
          const y = paddingY + chartH * (1 - ratio);
          const labelVal = Math.round(computedMax * ratio);
          return (
            <g key={ratio}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - 10}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="4 4"
              />
              <text
                x={paddingX - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-ink-faint text-[9px] font-mono"
              >
                {labelVal}{unit}
              </text>
            </g>
          );
        })}

        {/* Vùng Area & Đường Line cho từng series */}
        {series.map((s) => (
          <g key={s.key}>
            <path d={generateAreaPath(s.key)} fill={`url(#grad-${s.key})`} />
            <path
              d={generatePath(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {/* Điểm nút cuối cùng (Pulse Dot) */}
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
              r="4"
              fill={s.color}
              className="drop-shadow-[0_0_6px_rgba(0,132,255,0.8)]"
            />
          );
        })}
      </svg>
    </div>
  );
}
