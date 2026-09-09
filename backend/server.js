// ============================================================================
// MikroTik Hotspot Admin - Backend Proxy
// Express 5 + MikroTik REST API (RouterOS 7.x, endpoint /rest)
//
// Vai trò: trung gian giữa React (frontend) và router MikroTik:
//   - Tránh CORS, giữ mật khẩu router ở server
//   - Xác thực đăng nhập quản trị (ADMIN_USER/ADMIN_PASS trong .env)
//   - Serve frontend production (frontend/dist) nếu đã build
// ============================================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import ftp from 'basic-ftp';
import { getMockProxmoxSummary, executeMockProxmoxAction } from './mock-proxmox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  MTIK_SCHEME = 'http',
  MTIK_HOST = '192.168.88.1',
  MTIK_PORT = '80',
  MTIK_USER = 'admin',
  MTIK_PASS = '',
  PORT = 3000,
} = process.env;

const REST_BASE = `${MTIK_SCHEME}://${MTIK_HOST}:${MTIK_PORT}/rest`;
const AUTH = `Basic ${Buffer.from(`${MTIK_USER}:${MTIK_PASS}`).toString('base64')}`;

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------------------------------------------------------
// Helper: gọi MikroTik REST API
// ----------------------------------------------------------------------------
async function mtik(method, path, body) {
  const url = `${REST_BASE}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    const e = new Error(`Không thể kết nối MikroTik (${MTIK_HOST}): ${err.message}`);
    e.status = 502;
    throw e;
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail = data && typeof data === 'object' ? data : {};
    const e = new Error(
      detail.message ||
        detail.error ||
        detail.detail ||
        `MikroTik trả về HTTP ${res.status}`
    );
    e.status = 502;
    e.detail = detail;
    throw e;
  }
  return data;
}

// Làm sạch payload: bỏ field trống, chuyển boolean -> 'true'/'false'
function sanitizeUser(u) {
  const out = {};
  for (const [k, v] of Object.entries(u || {})) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  }
  return out;
}

// ----------------------------------------------------------------------------
// Time helpers: chuyển "1w2d03:04:05" / "1h30m" -> giây và ngược lại
// ----------------------------------------------------------------------------
function timeToSeconds(str) {
  if (!str) return 0;
  let s = String(str);
  let total = 0;
  const colon = s.match(/^(?:(\d+)w)?(?:(\d+)d)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colon) {
    total += colon[1] ? +colon[1] * 7 * 86400 : 0;
    total += colon[2] ? +colon[2] * 86400 : 0;
    total += +colon[3] * 3600 + +colon[4] * 60 + (colon[5] ? +colon[5] : 0);
    return total;
  }
  let m = s.match(/(\d+)\s*w(?:eeks?)?/i);
  if (m) total += +m[1] * 7 * 86400;
  m = s.match(/(\d+)\s*d(?:ays?)?/i);
  if (m) total += +m[1] * 86400;
  m = s.match(/(\d+)\s*h(?:ours?|rs?)?/i);
  if (m) total += +m[1] * 3600;
  m = s.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
  if (m) total += +m[1] * 60;
  m = s.match(/(\d+)\s*s(?:ec(?:onds?)?)?/i);
  if (m) total += +m[1];
  if (total > 0) return total;
  const num = Number(s);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function secondsToMikrotikTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const d = Math.floor(sec / 86400);
  sec %= 86400;
  const h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);
  sec %= 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  const dayPart = d > 0 ? `${d}d` : '';
  return d > 0 ? `${dayPart}${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

// Ánh xạ MikroTik User Group (full/write/read) -> Dashboard RBAC Role (admin/operator/viewer)
function mapGroupToRole(group) {
  const g = String(group || '').toLowerCase();
  if (g === 'full') return 'admin';
  if (g === 'write') return 'operator';
  if (g === 'read') return 'viewer';
  return 'operator'; // Nhóm tùy biến khác mặc định là operator
}

function mapRoleToGroup(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'full';
  if (r === 'viewer') return 'read';
  return 'write';
}

const tokens = new Map(); // token -> { id, username, group, role, fullName }

// ----------------------------------------------------------------------------
// Auth & RBAC middleware (Xác thực qua Session Token cấp từ MikroTik)
// ----------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const h = req.headers['x-auth-token'];
  if (!h) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' });
  }
  const session = tokens.get(h);
  if (session) {
    req.user = session;
    return next();
  }
  return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' });
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    const role = req.user?.role || 'admin';
    if (allowedRoles.includes(role)) {
      return next();
    }
    return res.status(403).json({
      error: `Từ chối truy cập: Nhóm quyền '${req.user?.group || role}' không được phép thực hiện thao tác này.`,
      requiredRoles: allowedRoles,
    });
  };
}

// ----------------------------------------------------------------------------
// Xác thực đăng nhập thuần túy với MikroTik RouterOS (/user)
// ----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const userTrim = username.trim();
  if (!userTrim) {
    return res.status(400).json({ error: 'Vui lòng nhập tên tài khoản MikroTik.' });
  }

  // Xác thực trực tiếp qua MikroTik RouterOS REST API
  try {
    const authHeader = 'Basic ' + Buffer.from(`${userTrim}:${password}`).toString('base64');
    const mtikRes = await fetch(`${REST_BASE}/user`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (mtikRes.ok) {
      const usersList = await mtikRes.json();
      const current = Array.isArray(usersList)
        ? usersList.find((u) => u.name?.toLowerCase() === userTrim.toLowerCase())
        : null;

      if (current && current.disabled === 'true') {
        return res.status(403).json({ error: 'Tài khoản MikroTik này đã bị vô hiệu hóa (disabled).' });
      }

      const group = current?.group || 'read';
      const role = mapGroupToRole(group);
      const fullName = current?.comment || current?.name || userTrim;

      const token = `tk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      const session = {
        id: current?.['.id'] || `usr_${userTrim}`,
        username: current?.name || userTrim,
        group,
        role,
        fullName,
      };
      tokens.set(token, session);
      return res.json({ ok: true, token, ...session });
    }

    if (mtikRes.status === 401 || mtikRes.status === 403) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu MikroTik RouterOS.' });
    }

    return res.status(mtikRes.status).json({ error: `MikroTik trả về mã lỗi ${mtikRes.status}` });
  } catch (err) {
    return res.status(502).json({
      error: `Không thể kết nối tới MikroTik Router (${MTIK_HOST}): ${err.message}`,
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const h = req.headers['x-auth-token'];
  if (h) tokens.delete(h);
  res.json({ ok: true });
});

// Lấy thông tin tài khoản đang đăng nhập
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ----------------------------------------------------------------------------
// Quản lý System Users trực tiếp trên MikroTik RouterOS (/user)
// ----------------------------------------------------------------------------
app.get('/api/admin/users', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const list = await mtik('GET', '/user');
    const safe = (Array.isArray(list) ? list : []).map((u) => ({
      id: u['.id'],
      username: u.name,
      group: u.group || 'read',
      role: mapGroupToRole(u.group),
      fullName: u.comment || '',
      disabled: u.disabled || 'false',
    }));
    res.json(safe);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/admin/users', requireAuth, requireRole(['admin']), async (req, res) => {
  const { username, password, group, role, fullName = '' } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'Vui lòng nhập tên tài khoản.' });
  }
  const targetGroup = group || mapRoleToGroup(role);
  try {
    const payload = {
      name: username.trim(),
      password: password || '',
      group: targetGroup,
      comment: fullName.trim() || undefined,
      disabled: 'false',
    };
    let created;
    try {
      created = await mtik('PUT', '/user', payload);
    } catch {
      created = await mtik('POST', '/user', payload);
    }
    res.status(201).json({
      id: created?.['.id'] || created?.ret || `usr_${payload.name}`,
      username: payload.name,
      group: payload.group,
      role: mapGroupToRole(payload.group),
      fullName: payload.comment || '',
      disabled: 'false',
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.patch('/api/admin/users/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const { password, group, role, fullName, disabled } = req.body || {};
  const targetGroup = group || (role ? mapRoleToGroup(role) : undefined);
  try {
    const payload = {};
    if (password) payload.password = password;
    if (targetGroup) payload.group = targetGroup;
    if (fullName !== undefined) payload.comment = fullName;
    if (disabled !== undefined) payload.disabled = disabled === 'true' || disabled === true ? 'true' : 'false';

    let updated;
    try {
      updated = await mtik('PATCH', `/user/${req.params.id}`, payload);
    } catch {
      updated = await mtik('PUT', `/user/${req.params.id}`, payload);
    }
    res.json(updated || { ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const { password, group, role, fullName, disabled } = req.body || {};
  const targetGroup = group || (role ? mapRoleToGroup(role) : undefined);
  try {
    const payload = {};
    if (password) payload.password = password;
    if (targetGroup) payload.group = targetGroup;
    if (fullName !== undefined) payload.comment = fullName;
    if (disabled !== undefined) payload.disabled = disabled === 'true' || disabled === true ? 'true' : 'false';

    const updated = await mtik('PUT', `/user/${req.params.id}`, payload);
    res.json(updated || { ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const list = await mtik('GET', '/user');
    const target = Array.isArray(list)
      ? list.find((u) => u['.id'] === req.params.id || u.name === req.params.id)
      : null;

    if (target && target.group === 'full') {
      return res.status(400).json({
        error: 'Không thể xóa tài khoản thuộc nhóm quyền quản trị cao nhất (full).',
      });
    }

    await mtik('DELETE', `/user/${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Quản lý Cài đặt hệ thống tập trung (JSON File Storage: backend/data/settings.json)
// ----------------------------------------------------------------------------
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const DEFAULT_SETTINGS = {
  voucher: {
    locationName: 'Quán Cafe / Khách Sạn',
    ssid: 'WIFI_HOTSPOT_MIKROTIK',
    loginUrl: 'http://192.168.20.1',
    sampleUser: 'khach_vip88',
    samplePassword: '88889999',
    hotline: '0901 234 567',
    footerText: 'Chúc quý khách trải nghiệm mạng tốc độ cao vui vẻ!',
  },
  system: {
    theme: 'neon-glass-light',
    refreshIntervalSeconds: 15,
  },
  updatedAt: new Date().toISOString(),
};

function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      const dir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
      return DEFAULT_SETTINGS;
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Lỗi đọc settings.json:', err.message);
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(data) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const current = loadSettings();
    const payload = {
      ...current,
      ...data,
      voucher: {
        ...(current.voucher || {}),
        ...(data.voucher || {}),
      },
      system: {
        ...(current.system || {}),
        ...(data.system || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(payload, null, 2), 'utf8');
    console.log('[backend] Đã cập nhật file settings.json thành công');
    return payload;
  } catch (err) {
    console.error('Lỗi lưu settings.json:', err.message);
    throw new Error(`Không thể lưu cấu hình: ${err.message}`);
  }
}

app.get('/api/settings', requireAuth, (req, res) => {
  res.json(loadSettings());
});

app.put('/api/settings', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
  try {
    const updated = saveSettings(req.body || {});
    res.json({ ok: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bảo vệ toàn bộ API phía sau
app.use('/api', requireAuth);

// ----------------------------------------------------------------------------
// Health / cấu hình
// ----------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  let connected = false;
  let latencyMs = null;
  let error = null;

  if (MTIK_USER && MTIK_PASS) {
    const start = Date.now();
    try {
      await mtik('GET', '/ip/hotspot/user');
      connected = true;
      latencyMs = Date.now() - start;
    } catch (e) {
      error = e.message;
    }
  } else {
    error = 'Chưa cấu hình MTIK_USER/MTIK_PASS trong .env';
  }

  res.json({
    ok: true,
    connected,
    latencyMs,
    error,
    mikrotik: {
      host: MTIK_HOST,
      restBase: REST_BASE,
      user: MTIK_USER,
      configured: Boolean(MTIK_USER && MTIK_PASS),
    },
    authEnabled: true,
  });
});
// ----------------------------------------------------------------------------
// Real-Time System Performance Monitor (CPU, RAM, HDD, Traffic, Health)
// ----------------------------------------------------------------------------
let lastInterfaceStats = {
  timestamp: 0,
  interfaces: new Map(), // name -> { rxBytes, txBytes }
};

async function getRouterPerformance() {
  const now = Date.now();
  const [resR, rbR, healthR, ifaceR, activeR] = await Promise.allSettled([
    mtik('GET', '/system/resource'),
    mtik('GET', '/system/routerboard'),
    mtik('GET', '/system/health'),
    mtik('GET', '/interface'),
    mtik('GET', '/ip/hotspot/active'),
  ]);

  const value = (r) => (r.status === 'fulfilled' ? r.value : null);
  const resourceData = value(resR) || {};
  const rbData = value(rbR) || {};
  const healthDataRaw = value(healthR) || [];
  const ifaceList = Array.isArray(value(ifaceR)) ? value(ifaceR) : [];
  const activeList = Array.isArray(value(activeR)) ? value(activeR) : [];

  // Parse Memory & HDD
  const totalMem = Number(resourceData['total-memory'] || 0);
  const freeMem = Number(resourceData['free-memory'] || 0);
  const usedMem = Math.max(0, totalMem - freeMem);
  const memPercent = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10 : 0;

  const totalHdd = Number(resourceData['total-hdd-space'] || 0);
  const freeHdd = Number(resourceData['free-hdd-space'] || 0);
  const usedHdd = Math.max(0, totalHdd - freeHdd);
  const hddPercent = totalHdd > 0 ? Math.round(((totalHdd - freeHdd) / totalHdd) * 1000) / 10 : 0;

  // Parse Health (Nhiệt độ & Điện áp)
  let temperature = null;
  let voltage = null;
  if (Array.isArray(healthDataRaw)) {
    for (const h of healthDataRaw) {
      const name = String(h.name || '').toLowerCase();
      if (name.includes('temp') && temperature === null) temperature = Number(h.value);
      if (name.includes('volt') && voltage === null) voltage = Number(h.value);
    }
  } else if (typeof healthDataRaw === 'object' && healthDataRaw !== null) {
    if (healthDataRaw.temperature !== undefined) temperature = Number(healthDataRaw.temperature);
    if (healthDataRaw.voltage !== undefined) voltage = Number(healthDataRaw.voltage);
  }

  // Tính toán Bandwidth Traffic (Rx/Tx Rate bps) theo delta thời gian
  const deltaSec = lastInterfaceStats.timestamp > 0 ? (now - lastInterfaceStats.timestamp) / 1000 : 1;
  const validDelta = deltaSec >= 0.2 && deltaSec <= 30; // Tránh chia 0 hoặc khoảng cách quá dài

  let totalRxRateBps = 0;
  let totalTxRateBps = 0;
  let totalRxBytes = 0;
  let totalTxBytes = 0;

  const currentIfMap = new Map();

  const interfaces = ifaceList.map((item) => {
    const name = item.name || 'unknown';
    const rx = Number(item['rx-byte'] || 0);
    const tx = Number(item['tx-byte'] || 0);
    totalRxBytes += rx;
    totalTxBytes += tx;

    currentIfMap.set(name, { rx, tx });

    let rxRateBps = 0;
    let txRateBps = 0;

    if (validDelta && lastInterfaceStats.interfaces.has(name)) {
      const prev = lastInterfaceStats.interfaces.get(name);
      if (rx >= prev.rx) {
        rxRateBps = Math.round(((rx - prev.rx) * 8) / deltaSec);
      }
      if (tx >= prev.tx) {
        txRateBps = Math.round(((tx - prev.tx) * 8) / deltaSec);
      }
    }

    if (item.running === 'true' || item.running === true) {
      totalRxRateBps += rxRateBps;
      totalTxRateBps += txRateBps;
    }

    return {
      id: item['.id'] || name,
      name,
      type: item.type || 'ether',
      running: item.running === 'true' || item.running === true,
      disabled: item.disabled === 'true' || item.disabled === true,
      comment: item.comment || '',
      rxBytes: rx,
      txBytes: tx,
      rxRateBps,
      txRateBps,
      rxPacket: Number(item['rx-packet'] || 0),
      txPacket: Number(item['tx-packet'] || 0),
      rxDrop: Number(item['rx-drop'] || 0),
      txDrop: Number(item['tx-drop'] || 0),
      rxError: Number(item['rx-error'] || 0),
      txError: Number(item['tx-error'] || 0),
    };
  });

  lastInterfaceStats = {
    timestamp: now,
    interfaces: currentIfMap,
  };

  return {
    timestamp: now,
    resource: {
      uptime: resourceData.uptime || '—',
      version: resourceData.version || 'RouterOS 7',
      buildTime: resourceData['build-time'] || '',
      cpu: resourceData.cpu || 'CPU',
      cpuCount: Number(resourceData['cpu-count'] || 1),
      cpuFrequency: Number(resourceData['cpu-frequency'] || 0),
      cpuLoad: Number(resourceData['cpu-load'] || 0),
      freeMemory: freeMem,
      totalMemory: totalMem,
      usedMemory: usedMem,
      memoryUsagePercent: memPercent,
      freeHdd: freeHdd,
      totalHdd: totalHdd,
      usedHdd: usedHdd,
      hddUsagePercent: hddPercent,
      badBlocks: resourceData['bad-blocks'] || '0%',
      boardName: resourceData['board-name'] || rbData.model || 'MikroTik Router',
      architecture: resourceData['architecture-name'] || 'arm/mips',
      platform: resourceData.platform || 'MikroTik',
    },
    routerboard: {
      model: rbData.model || resourceData['board-name'] || 'RouterBOARD',
      serialNumber: rbData['serial-number'] || '—',
      currentFirmware: rbData['current-firmware'] || resourceData.version || '—',
      upgradeFirmware: rbData['upgrade-firmware'] || '—',
    },
    health: {
      temperature,
      voltage,
    },
    traffic: {
      totalRxRateBps,
      totalTxRateBps,
      totalRxBytes,
      totalTxBytes,
    },
    interfaces,
    hotspot: {
      activeCount: activeList.length,
    },
    host: MTIK_HOST,
  };
}

app.get('/api/system/performance', async (req, res) => {
  try {
    const data = await getRouterPerformance();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Không thể lấy dữ liệu hiệu năng: ' + err.message });
  }
});

// Realtime SSE Stream cho System Performance Dashboard (chu kỳ 1s hoặc 2s)
app.get('/api/system/performance/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const intervalMs = Math.max(1000, Number(req.query.interval) || 1500);

  const send = async () => {
    try {
      const perf = await getRouterPerformance();
      res.write(`data: ${JSON.stringify(perf)}\n\n`);
    } catch {
      /* bỏ qua lỗi tạm thời */
    }
  };

  await send();
  const timer = setInterval(send, intervalMs);
  req.on('close', () => clearInterval(timer));
});

// ----------------------------------------------------------------------------
// Thống kê tổng quan
// ----------------------------------------------------------------------------
async function makeStats() {
  const [usersR, activeR, profilesR] = await Promise.allSettled([
    mtik('GET', '/ip/hotspot/user'),
    mtik('GET', '/ip/hotspot/active'),
    mtik('GET', '/ip/hotspot/user/profile'),
  ]);

  const value = (r) => (r.status === 'fulfilled' ? r.value : null);
  const users = value(usersR) || [];
  const active = value(activeR) || [];
  const profiles = value(profilesR) || [];

  const errors = [usersR, activeR, profilesR]
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason.message);

  const usersByProfile = {};
  for (const u of users) {
    const p = u.profile || 'default';
    usersByProfile[p] = (usersByProfile[p] || 0) + 1;
  }

  return {
    users: users.length,
    active: active.length,
    profiles: profiles.map((p) => p.name),
    usersByProfile,
    errors,
    router: { host: MTIK_HOST, restBase: REST_BASE },
  };
}

app.get('/api/stats', async (req, res) => {
  res.json(await makeStats());
});

// Realtime: Server-Sent Events (thay thế polling)
app.get('/api/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = async () => {
    try {
      const stats = await makeStats();
      res.write(`data: ${JSON.stringify(stats)}\n\n`);
    } catch {
      /* bỏ qua lỗi tạm thời, gửi lần sau */
    }
  };
  await send();
  const timer = setInterval(send, 5000);
  req.on('close', () => clearInterval(timer));
});

// ----------------------------------------------------------------------------
// Hotspot users: /ip/hotspot/user
// ----------------------------------------------------------------------------
app.get('/api/users', async (req, res) => {
  res.json(await mtik('GET', '/ip/hotspot/user'));
});

app.post('/api/users', requireRole(['admin', 'operator']), async (req, res) => {
  const body = sanitizeUser(req.body);
  if (!body.name) {
    return res.status(400).json({ error: 'Vui lòng nhập tên người dùng (name).' });
  }
  // RouterOS 7.20 REST: tworzenie przez PUT na kolekcji (POST -> "no such command")
  const created = await mtik('PUT', '/ip/hotspot/user', body);
  res.status(201).json(created);
});

app.put('/api/users/:id', requireRole(['admin', 'operator']), async (req, res) => {
  const id = req.params.id;
  const body = sanitizeUser(req.body);
  // RouterOS yêu cầu `name` khi cập nhật qua PUT
  if (!body.name) {
    try {
      const u = await mtik('GET', `/ip/hotspot/user/${encodeURIComponent(id)}`);
      body.name = u.name;
    } catch {
      /* giữ nguyên body */
    }
  }
  const updated = await mtik(
    'PUT',
    `/ip/hotspot/user/${encodeURIComponent(id)}`,
    body
  );
  res.json(updated);
});

app.delete('/api/users/:id', requireRole(['admin', 'operator']), async (req, res) => {
  await mtik('DELETE', `/ip/hotspot/user/${encodeURIComponent(req.params.id)}`);
  res.json({ ok: true });
});

// Gia hạn thời gian: cộng thêm `time` vào limit-uptime hiện tại
app.post('/api/users/:id/extend', requireRole(['admin', 'operator']), async (req, res) => {
  const id = req.params.id;
  const extra = timeToSeconds(sanitizeUser(req.body)?.time || '');
  if (!extra || extra <= 0) {
    return res.status(400).json({ error: 'Vui lòng chỉ định thời gian gia hạn (vd: 1h30m, 2d).' });
  }
  const user = await mtik('GET', `/ip/hotspot/user/${encodeURIComponent(id)}`);
  const current = timeToSeconds(user['limit-uptime']);
  const next = secondsToTime(current + extra);
  const updated = await mtik(
    'PUT',
    `/ip/hotspot/user/${encodeURIComponent(id)}`,
    { name: user.name, 'limit-uptime': next }
  );
  res.json({ ...updated, _added: extra, _previous: user['limit-uptime'] || null });
});

// Reset bộ đếm dung lượng / odblokuj usera
app.post('/api/users/:id/reset', requireRole(['admin', 'operator']), async (req, res) => {
  const id = req.params.id;
  try {
    // Standard RouterOS: reset-counters-by-id (nie na każdej wersji przez REST)
    await mtik('POST', '/ip/hotspot/user/reset-counters-by-id', { id });
    return res.json({ ok: true, method: 'reset-counters' });
  } catch {
    // Fallback: zablokuj usera (disabled=false) — jest na wszystkich routerach
    const u = await mtik('GET', `/ip/hotspot/user/${encodeURIComponent(id)}`);
    const updated = await mtik(
      'PUT',
      `/ip/hotspot/user/${encodeURIComponent(id)}`,
      { name: u.name, disabled: 'false' }
    );
    return res.json({ ...updated, ok: true, method: 'unblock' });
  }
});

// ----------------------------------------------------------------------------
// Hotspot profiles: /ip/hotspot/user/profile
// ----------------------------------------------------------------------------
app.get('/api/profiles', async (req, res) => {
  res.json(await mtik('GET', '/ip/hotspot/user/profile'));
});

app.post('/api/profiles', requireRole(['admin']), async (req, res) => {
  const body = sanitizeUser(req.body);
  if (!body.name) {
    return res.status(400).json({ error: 'Vui lòng nhập tên hồ sơ (profile name).' });
  }
  delete body.default; // flaga móc tworzyć tylko przez PUT z id
  const created = await mtik('PUT', '/ip/hotspot/user/profile', body);
  res.status(201).json(created);
});

app.put('/api/profiles/:id', requireRole(['admin']), async (req, res) => {
  const body = sanitizeUser(req.body);
  delete body.default; // không cho sửa cờ "default"
  const updated = await mtik(
    'PUT',
    `/ip/hotspot/user/profile/${encodeURIComponent(req.params.id)}`,
    body
  );
  res.json(updated);
});

app.delete('/api/profiles/:id', requireRole(['admin']), async (req, res) => {
  await mtik('DELETE', `/ip/hotspot/user/profile/${encodeURIComponent(req.params.id)}`);
  res.json({ ok: true });
});

// ----------------------------------------------------------------------------
// Phiên đang hoạt động: /ip/hotspot/active
// ----------------------------------------------------------------------------
app.get('/api/active', async (req, res) => {
  res.json(await mtik('GET', '/ip/hotspot/active'));
});

// Ngắt kết nối phiên (kick user) = xoá entry khỏi active list
app.delete('/api/active/:id', requireRole(['admin', 'operator']), async (req, res) => {
  await mtik('DELETE', `/ip/hotspot/active/${encodeURIComponent(req.params.id)}`);
  res.json({ ok: true });
});

// ----------------------------------------------------------------------------
// Sao lưu & Xuất cấu hình RouterOS (/system/backup/save, /export, /file)
// ----------------------------------------------------------------------------
app.get('/api/router/backups', async (req, res) => {
  try {
    const list = await mtik('GET', '/file');
    const files = (Array.isArray(list) ? list : []).filter((f) => {
      const name = String(f.name || '').toLowerCase();
      const type = String(f.type || '').toLowerCase();
      return name.endsWith('.backup') || name.endsWith('.rsc') || type === 'backup' || type === 'script';
    });

    const formatted = files.map((f) => ({
      id: f['.id'] || f.name,
      name: f.name,
      type: f.name.endsWith('.backup') || f.type === 'backup' ? 'backup' : 'rsc',
      size: Number(f.size || 0),
      lastModified: f['last-modified'] || '',
      contents: f.contents || null,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể lấy danh sách file sao lưu: ' + err.message });
  }
});

// Helper: Tải file nhị phân (.backup) từ MikroTik qua FTP
async function downloadBackupBinary(filename) {
  // Nếu là mock router (port 4000)
  if (MTIK_PORT === '4000' || REST_BASE.includes(':4000')) {
    return Buffer.from(`MOCK_MIKROTIK_BINARY_BACKUP_DATA_${filename}_${Date.now()}`);
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await client.access({
      host: MTIK_HOST,
      user: MTIK_USER,
      password: MTIK_PASS,
      port: 21,
      timeout: 10000,
    });

    const chunks = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    await client.downloadTo(writable, filename);
    return Buffer.concat(chunks);
  } finally {
    client.close();
  }
}

app.post('/api/router/backup/create', requireRole(['admin', 'operator']), async (req, res) => {
  const {
    type = 'rsc', // 'rsc' | 'backup'
    name = '',
    showSensitive = true,
    compact = true,
    password = '',
    dontEncrypt = true,
  } = req.body || {};

  const cleanName = (name || `backup_${Date.now()}`).trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    if (type === 'rsc') {
      // 1. Xuất tập lệnh văn bản RouterOS Script (.rsc)
      const fileName = cleanName.endsWith('.rsc') ? cleanName : `${cleanName}.rsc`;
      const exportPayload = {
        file: cleanName,
        'show-sensitive': showSensitive ? 'true' : 'false',
        compact: compact ? 'true' : 'false',
      };

      try {
        await mtik('POST', '/export', exportPayload);
      } catch (err) {
        // Fallback cho routeros nếu POST trả lỗi
        await mtik('PUT', '/export', exportPayload);
      }

      // Đợi RouterOS ghi file vào bộ nhớ
      await new Promise((resolve) => setTimeout(resolve, 600));

      const files = await mtik('GET', '/file');
      const target = Array.isArray(files) ? files.find((f) => f.name === fileName || f.name === cleanName) : null;

      res.json({
        ok: true,
        type: 'rsc',
        id: target?.['.id'] || fileName,
        filename: target?.name || fileName,
        size: Number(target?.size || (target?.contents?.length || 0)),
        lastModified: target?.['last-modified'] || new Date().toISOString(),
        contents: target?.contents || '',
      });
    } else {
      // 2. Tạo bản sao lưu nhị phân toàn diện (.backup)
      const fileName = cleanName.endsWith('.backup') ? cleanName : `${cleanName}.backup`;
      const backupPayload = {
        name: cleanName,
      };
      if (password) {
        backupPayload.password = password;
      } else if (dontEncrypt) {
        backupPayload['dont-encrypt'] = 'true';
      }

      try {
        await mtik('POST', '/system/backup/save', backupPayload);
      } catch (err) {
        await mtik('PUT', '/system/backup/save', backupPayload);
      }

      // Đợi RouterOS đóng gói file backup
      await new Promise((resolve) => setTimeout(resolve, 800));

      const files = await mtik('GET', '/file');
      const target = Array.isArray(files) ? files.find((f) => f.name === fileName || f.name === cleanName) : null;

      res.json({
        ok: true,
        type: 'backup',
        id: target?.['.id'] || fileName,
        filename: target?.name || fileName,
        size: Number(target?.size || 0),
        lastModified: target?.['last-modified'] || new Date().toISOString(),
      });
    }
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Lỗi thực hiện sao lưu: ' + err.message });
  }
});

// Tải trực tiếp file sao lưu (.backup hoặc .rsc) về máy tính
app.get('/api/router/backups/download/:filename', async (req, res) => {
  const filename = req.params.filename;
  try {
    if (filename.toLowerCase().endsWith('.rsc')) {
      const files = await mtik('GET', '/file');
      const target = Array.isArray(files) ? files.find((f) => f.name === filename) : null;
      if (!target || !target.contents) {
        return res.status(404).json({ error: 'Không tìm thấy nội dung file script trên Router.' });
      }
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(target.contents);
    } else {
      // File nhị phân .backup -> tải qua FTP
      const buf = await downloadBackupBinary(filename);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', buf.length);
      return res.send(buf);
    }
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải file sao lưu: ' + err.message });
  }
});

app.delete('/api/router/backups/:id', requireRole(['admin']), async (req, res) => {
  try {
    await mtik('DELETE', `/file/${encodeURIComponent(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể xóa file sao lưu: ' + err.message });
  }
});

// ----------------------------------------------------------------------------
// PROXMOX VE HYPERVISOR PERFORMANCE & MONITORING API
// ----------------------------------------------------------------------------
const {
  PROXMOX_HOST,
  PROXMOX_PORT = '8006',
  PROXMOX_TOKEN_ID,
  PROXMOX_TOKEN_SECRET,
} = process.env;

// Lấy tóm tắt hiệu năng Proxmox VE (Real hoặc Mock)
app.get('/api/proxmox/summary', async (req, res) => {
  try {
    if (PROXMOX_HOST && PROXMOX_TOKEN_ID && PROXMOX_TOKEN_SECRET) {
      // Kết nối Proxmox VE thật qua REST API
      const authHeader = `PVEAPIToken=${PROXMOX_TOKEN_ID}=${PROXMOX_TOKEN_SECRET}`;
      const baseUrl = `https://${PROXMOX_HOST}:${PROXMOX_PORT}/api2/json`;
      const opt = {
        headers: { Authorization: authHeader },
        // Bỏ qua chứng chỉ SSL tự ký của Proxmox
        signal: AbortSignal.timeout(5000),
      };
      // Gọi API PVE thực tế
      const [nodesRes, versionRes] = await Promise.all([
        fetch(`${baseUrl}/nodes`, opt).then((r) => r.json()).catch(() => null),
        fetch(`${baseUrl}/version`, opt).then((r) => r.json()).catch(() => null),
      ]);
      if (nodesRes && nodesRes.data) {
        return res.json({
          mode: 'real',
          host: PROXMOX_HOST,
          version: versionRes?.data?.version || '8.x',
          nodes: nodesRes.data,
        });
      }
    }

    // Mặc định hoặc chế độ giả lập Mock
    const mockData = getMockProxmoxSummary();
    res.json(mockData);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy dữ liệu Proxmox VE: ' + err.message });
  }
});

// Luồng Server-Sent Events (SSE) đẩy dữ liệu Proxmox VE thời gian thực
app.get('/api/proxmox/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Gửi gói đầu tiên ngay khi kết nối
  try {
    const initial = getMockProxmoxSummary();
    res.write(`data: ${JSON.stringify(initial)}\n\n`);
  } catch {}

  const intervalMs = 1500; // 1.5 giây một lần
  const timer = setInterval(() => {
    try {
      const payload = getMockProxmoxSummary();
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      clearInterval(timer);
    }
  }, intervalMs);

  req.on('close', () => {
    clearInterval(timer);
  });
});

// Thực hiện tác vụ điều khiển máy ảo / container (start, stop, reboot)
app.post('/api/proxmox/guests/:type/:vmid/action', (req, res) => {
  const { type, vmid } = req.params;
  const { action } = req.body;
  try {
    const result = executeMockProxmoxAction(type, vmid, action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Serve frontend production (frontend/dist) nếu đã build
// ----------------------------------------------------------------------------
const DIST = path.resolve(process.cwd(), '..', 'frontend', 'dist');
const HAS_BUILD = fs.existsSync(path.join(DIST, 'index.html'));
if (HAS_BUILD) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

// ----------------------------------------------------------------------------
// 404 + error handling
// ----------------------------------------------------------------------------
app.use((req, res) => res.status(404).json({ error: 'Endpoint không tồn tại' }));

// Express 5 tự chuyển lỗi từ async handler xuống error middleware này
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  console.error(`[error] ${req.method} ${req.originalUrl} ->`, err.message);
  res.status(status).json({ error: err.message, detail: err.detail || null });
});

app.listen(PORT, () => {
  console.log(`[backend] MikroTik Hotspot Proxy: http://localhost:${PORT}`);
  console.log(`[backend] Kết nối REST: ${REST_BASE} (user: ${MTIK_USER})`);
  console.log(`[backend] Auth đăng nhập: Xác thực trực tiếp qua MikroTik RouterOS (/user)`);
  if (HAS_BUILD) {
    console.log(`[backend] Serve frontend production tại http://localhost:${PORT}`);
  }
});