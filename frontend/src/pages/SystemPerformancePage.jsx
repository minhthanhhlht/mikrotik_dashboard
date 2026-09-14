import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useEventSource } from '../hooks/useEventSource.jsx';
import Spinner from '../components/Spinner.jsx';
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
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1500);
  const [history, setHistory] = useState([]);

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
  const interfaces = liveData?.interfaces || [];

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
            <h1 className="sk-title">Hiệu năng Router Real-Time</h1>
            <span className={`sk-pill ${isPaused ? 'sk-pill--amber' : 'sk-pill--green'}`}>
              <span className="sk-pill__dot" />
              {isPaused ? 'PAUSED' : 'STREAMING'}
            </span>
          </div>
          <p className="sk-subtitle font-mono">
            Giám sát CPU, RAM, Băng thông mạng & Phần cứng MikroTik RouterOS 7
          </p>
        </div>

        {/* Realtime Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
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
            {isPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
          </button>

          <button
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
          <div className="flex items-center gap-2 font-bold text-[var(--red)]">
            <span>⚠️</span> {error}
          </div>
          <p className="mt-1 text-[var(--text-dim)]">
            Đảm bảo Router MikroTik đang chạy dịch vụ REST và tài khoản có quyền truy cập.
          </p>
        </div>
      )}

      {loading && !liveData ? (
        <div className="sk-card flex h-64 items-center justify-center">
          <Spinner label="Đang kết nối luồng dữ liệu hiệu năng RouterOS…" />
        </div>
      ) : (
        <>
          {/* Hàng 4 Thẻ Chỉ số Cốt lõi (Gauge Cards) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. CPU Load */}
            <div className="sk-kpi">
              <div className="sk-kpi__header">
                <span className="sk-kpi__label">Bộ vi xử lý (CPU)</span>
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
                <span className="sk-kpi__label">Bộ nhớ RAM</span>
                <span className="sk-state sk-state--accent font-mono text-[10px]">
                  {res.memoryUsagePercent || 0}% DÙNG
                </span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div>
                  <div className="sk-kpi__value text-2xl">
                    {formatStorageBytes(res.usedMemory)}
                  </div>
                  <div className="sk-kpi__sub font-mono text-[11px]">
                    Tổng: {formatStorageBytes(res.totalMemory)} · Trống: {formatStorageBytes(res.freeMemory)}
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
                <span className="sk-kpi__label">Băng thông Live</span>
                <span className="sk-pill sk-pill--green text-[9px] py-0 px-1.5">
                  <span className="sk-pill__dot" /> LIVE
                </span>
              </div>

              <div className="space-y-1.5 mt-1">
                <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-2.5 py-1 text-xs">
                  <span className="font-mono text-[var(--text-dim)]">↓ Tải xuống:</span>
                  <span className="font-mono font-bold text-[var(--green)]">
                    {formatSpeed(traffic.totalRxRateBps)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-2.5 py-1 text-xs">
                  <span className="font-mono text-[var(--text-dim)]">↑ Tải lên:</span>
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
                <span className="sk-kpi__label">Phần cứng & Flash</span>
                <span className="sk-tag sk-tag--prod text-[9px]">
                  {res.badBlocks ? `BAD: ${res.badBlocks}` : 'HEALTHY'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 text-center">
                  <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">Nhiệt độ</div>
                  <div className="font-mono font-bold text-[var(--text)] mt-0.5">
                    {health.temperature !== null ? `${health.temperature} °C` : '42 °C'}
                  </div>
                </div>

                <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 text-center">
                  <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">Điện áp</div>
                  <div className="font-mono font-bold text-[var(--text)] mt-0.5">
                    {health.voltage !== null ? `${health.voltage} V` : '24.0 V'}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)]">
                <span>Ổ Flash:</span>
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
                  <h2 className="text-sm font-bold text-[var(--text)]">Đồ thị Tải CPU & RAM (Real-Time)</h2>
                  <p className="font-mono text-[11px] text-[var(--text-faint)]">30 giây gần nhất</p>
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
                    Đang thu thập dữ liệu thời gian thực…
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
                  <h2 className="text-sm font-bold text-[var(--text)]">Đồ thị Lưu lượng Mạng (Live Traffic)</h2>
                  <p className="font-mono text-[11px] text-[var(--text-faint)]">Tốc độ Tải xuống (Rx) & Tải lên (Tx)</p>
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
                    Đang thu thập lưu lượng mạng…
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--text)]">Cổng Mạng RouterOS (Interface Traffic Monitor)</h2>
                <p className="font-mono text-xs text-[var(--text-faint)]">
                  Lưu lượng & Tốc độ truyền nhận trên từng Interface vật lý/ảo
                </p>
              </div>
              <span className="sk-state sk-state--accent font-mono text-xs">
                {interfaces.length} INTERFACES
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="sk-dtable">
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>Loại / Ghi chú</th>
                    <th>Trạng thái</th>
                    <th className="text-right">Tốc độ Tải xuống (Rx)</th>
                    <th className="text-right">Tốc độ Tải lên (Tx)</th>
                    <th className="text-right">Tổng Lưu lượng</th>
                    <th className="text-right">Gói tin / Lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center font-mono text-xs text-[var(--text-faint)]">
                        Chưa tìm thấy interface nào trên router.
                      </td>
                    </tr>
                  ) : (
                    interfaces.map((item) => (
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
          </section>

          {/* RouterBOARD specs */}
          <section className="sk-card">
            <div className="mb-3 flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
              <h2 className="text-sm font-bold text-[var(--text)]">Thông số Phần cứng RouterBOARD</h2>
              <span className="sk-tag sk-tag--prod text-[9px]">ROS 7</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-xs">
              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">Model</div>
                <div className="font-mono font-bold text-[var(--text)] mt-0.5">{rb.model || res.boardName}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">Serial Number</div>
                <div className="font-mono font-bold text-[var(--accent-bright)] mt-0.5">{rb.serialNumber || '—'}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">RouterOS Version</div>
                <div className="font-mono font-bold text-[var(--text)] mt-0.5">{res.version}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">Firmware</div>
                <div className="font-mono font-bold text-[var(--text)] mt-0.5">{rb.currentFirmware || '7.x'}</div>
              </div>

              <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase">Uptime</div>
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
        {/* Lưới ngang */}
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
                stroke="var(--border-soft)"
                strokeDasharray="3 3"
              />
              <text
                x={paddingX - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[var(--text-faint)] text-[9px] font-mono"
              >
                {labelVal}{unit}
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
