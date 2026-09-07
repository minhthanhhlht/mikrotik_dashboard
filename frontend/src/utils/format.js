// Các hàm định dạng số liệu lấy từ MikroTik REST API

// Chuyển "1w2d03:04:05", "03:04", "3h4m5s", "1d", "2w" -> số giây
export function parseDuration(value) {
  if (value === null || value === undefined || value === '') return 0;
  const s = String(value).trim();
  let total = 0;

  // Dạng A: [Nw][Nd]HH:MM[:SS]
  const colon = s.match(/^(?:(\d+)w)?(?:(\d+)d)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colon) {
    total += colon[1] ? Number(colon[1]) * 7 * 86400 : 0;
    total += colon[2] ? Number(colon[2]) * 86400 : 0;
    total += Number(colon[3]) * 3600;
    total += Number(colon[4]) * 60;
    total += colon[5] ? Number(colon[5]) : 0;
    return total;
  }

  // Dạng A2: chỉ có tuần/ngày, vd "1d", "2w", "1w2d"
  const wd = s.match(/^(?:(\d+)w)?(?:(\d+)d)?$/);
  if (wd && (wd[1] || wd[2])) {
    total += wd[1] ? Number(wd[1]) * 7 * 86400 : 0;
    total += wd[2] ? Number(wd[2]) * 86400 : 0;
    return total;
  }

  // Dạng B: "3h4m5s" / "5m" / "30s"
  const re = /(\d+)([hms])/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[1]);
    if (m[2] === 'h') total += n * 3600;
    else if (m[2] === 'm') total += n * 60;
    else total += n;
  }
  return total;
}

// Hiển thị thời lượng dạng thân thiện
export function formatDuration(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return '—';
  }
  const total = parseDuration(value);
  if (!total) return '0s';

  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;

  if (d > 0) {
    if (h > 0 && m > 0) return `${d} ngày ${h} giờ ${m} phút`;
    if (h > 0) return `${d} ngày ${h} giờ`;
    return `${d} ngày`;
  }
  if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
  if (m > 0) return sec > 0 ? `${m} phút ${sec}s` : `${m} phút`;
  return `${sec}s`;
}

// Hiển thị số byte (từ MikroTik dạng số hoặc chuỗi)
export function formatBytes(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}