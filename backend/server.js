// ============================================================================
// MikroTik Hotspot Admin - Backend Proxy
// Express 5 + MikroTik REST API (RouterOS 7.x, endpoint /rest)
//
// Vai trò: trung gian giữa React (frontend) và router MikroTik:
//   - Tránh CORS, giữ mật khẩu router ở server
//   - Xác thực đăng nhập quản trị (ADMIN_USER/ADMIN_PASS trong .env)
//   - Serve frontend production (frontend/dist) nếu đã build
// ============================================================================
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import ftp from 'basic-ftp';
import {
  getMockProxmoxSummary,
  executeMockProxmoxAction,
  getMockNextVmid,
  getMockTemplates,
  createMockVm,
  updateMockVm,
  deleteMockVm,
  createMockLxc,
  updateMockLxc,
  deleteMockLxc,
  getMockProxmoxTasks,
  executeMockProxmoxNodeAction,
} from './mock-proxmox.js';
import {
  isProxmoxConfigured,
  getRealProxmoxSummary,
  executeRealProxmoxAction,
  getRealNextVmid,
  getRealProxmoxTemplates,
  getRealProxmoxVms,
  getRealProxmoxVmConfig,
  createRealProxmoxVm,
  updateRealProxmoxVm,
  deleteRealProxmoxVm,
  getRealProxmoxLxcs,
  getRealProxmoxLxcConfig,
  createRealProxmoxLxc,
  updateRealProxmoxLxc,
  deleteRealProxmoxLxc,
  getRealProxmoxTasks,
  executeRealProxmoxNodeAction,
} from './proxmox-client.js';
import {
  getMockHassSummary,
  executeMockHassAddonAction,
  executeMockHassCoreAction,
} from './mock-hass.js';
import {
  isHassConfigured,
  getRealHassSummary,
  executeRealHassCoreAction,
  getRealHassStates,
  callRealHassService,
} from './hass-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  MTIK_SCHEME = 'http',
  MTIK_HOST = '192.168.88.1',
  MTIK_PORT = '80',
  MTIK_USER = 'admin',
  MTIK_PASS = '',
  PORT = 3000,
  AUTH_SOURCE = 'routeros', // 'routeros' | 'env' | 'both'
  ADMIN_USER = '',
  ADMIN_PASS = '',
  ADMIN_ROLE = 'admin',
  ADMIN_NAME = 'Administrator',
  OPERATOR_USER = '',
  OPERATOR_PASS = '',
  OPERATOR_ROLE = 'operator',
  OPERATOR_NAME = 'Operator',
  VIEWER_USER = '',
  VIEWER_PASS = '',
  VIEWER_ROLE = 'viewer',
  VIEWER_NAME = 'Viewer',
  ENV_USERS = '',
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

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 ngày (259,200,000 ms)
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

const tokens = new Map(); // token -> { id, username, group, role, fullName, createdAt, expiresAt }

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      const now = Date.now();
      if (Array.isArray(list)) {
        list.forEach((item) => {
          if (item.token && item.expiresAt && item.expiresAt > now) {
            tokens.set(item.token, item);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[sessions] Không thể đọc sessions.json:', err.message);
  }
}

function saveSessions() {
  try {
    const list = Array.from(tokens.entries()).map(([token, session]) => ({
      token,
      ...session,
    }));
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[sessions] Không thể lưu sessions.json:', err.message);
  }
}

loadSessions();

// ----------------------------------------------------------------------------
// Auth & RBAC middleware (Xác thực qua Session Token 3 ngày cấp từ MikroTik)
// ----------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const h = req.headers['x-auth-token'] || req.query.token || req.query.auth_token;
  if (!h) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' });
  }
  const session = tokens.get(h);
  if (session) {
    if (session.expiresAt && Date.now() > session.expiresAt) {
      tokens.delete(h);
      saveSessions();
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn (quá 3 ngày). Vui lòng đăng nhập lại.' });
    }
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
// Quản lý tài khoản từ biến môi trường (.env)
// ----------------------------------------------------------------------------
function getEnvUsers() {
  try {
    dotenv.config({ path: path.join(__dirname, '.env'), override: true });
  } catch {}
  const users = [];
  if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
    users.push({
      id: `env_${process.env.ADMIN_USER.trim()}`,
      username: process.env.ADMIN_USER.trim(),
      password: process.env.ADMIN_PASS,
      role: (process.env.ADMIN_ROLE || 'admin').toLowerCase(),
      group: mapRoleToGroup(process.env.ADMIN_ROLE || 'admin'),
      fullName: process.env.ADMIN_NAME || 'Quản trị viên (ENV)',
      source: 'env',
    });
  }
  if (process.env.OPERATOR_USER && process.env.OPERATOR_PASS) {
    users.push({
      id: `env_${process.env.OPERATOR_USER.trim()}`,
      username: process.env.OPERATOR_USER.trim(),
      password: process.env.OPERATOR_PASS,
      role: (process.env.OPERATOR_ROLE || 'operator').toLowerCase(),
      group: mapRoleToGroup(process.env.OPERATOR_ROLE || 'operator'),
      fullName: process.env.OPERATOR_NAME || 'Điều hành viên (ENV)',
      source: 'env',
    });
  }
  if (process.env.VIEWER_USER && process.env.VIEWER_PASS) {
    users.push({
      id: `env_${process.env.VIEWER_USER.trim()}`,
      username: process.env.VIEWER_USER.trim(),
      password: process.env.VIEWER_PASS,
      role: (process.env.VIEWER_ROLE || 'viewer').toLowerCase(),
      group: mapRoleToGroup(process.env.VIEWER_ROLE || 'viewer'),
      fullName: process.env.VIEWER_NAME || 'Khách xem (ENV)',
      source: 'env',
    });
  }
  if (process.env.ENV_USERS) {
    try {
      const parsed = JSON.parse(process.env.ENV_USERS);
      if (Array.isArray(parsed)) {
        parsed.forEach((u) => {
          if (u.username && u.password) {
            users.push({
              id: `env_${u.username.trim()}`,
              username: u.username.trim(),
              password: u.password,
              role: (u.role || 'operator').toLowerCase(),
              group: mapRoleToGroup(u.role || 'operator'),
              fullName: u.fullName || u.name || u.username,
              source: 'env',
            });
          }
        });
      }
    } catch (e) {
      console.warn('[auth] Không thể parse JSON từ ENV_USERS:', e.message);
    }
  }
  return users;
}

function verifyEnvUser(username, password) {
  const envUsers = getEnvUsers();
  const uTrim = String(username || '').trim().toLowerCase();
  return envUsers.find((u) => u.username.toLowerCase() === uTrim && u.password === password) || null;
}

// ----------------------------------------------------------------------------
// API cấu hình Auth (hỗ trợ kiểm tra chế độ xác thực)
// ----------------------------------------------------------------------------
app.get('/api/auth/config', (_req, res) => {
  try {
    dotenv.config({ path: path.join(__dirname, '.env'), override: true });
  } catch {}
  const authSource = (process.env.AUTH_SOURCE || 'routeros').toLowerCase().trim();
  res.json({
    ok: true,
    authSource,
    routerHost: process.env.MTIK_HOST || MTIK_HOST,
  });
});

// ----------------------------------------------------------------------------
// Xác thực đăng nhập (Hỗ trợ AUTH_SOURCE: 'routeros' | 'env' | 'both')
// ----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    dotenv.config({ path: path.join(__dirname, '.env'), override: true });
  } catch {}
  const { username = '', password = '', rememberMe = true } = req.body || {};
  const userTrim = username.trim();
  if (!userTrim) {
    return res.status(400).json({ error: 'Vui lòng nhập tên tài khoản đăng nhập.' });
  }

  const authSource = (process.env.AUTH_SOURCE || 'routeros').toLowerCase().trim();

  // 1. Kiểm tra xác thực qua file .env (nếu AUTH_SOURCE = 'env' hoặc 'both')
  if (authSource === 'env' || authSource === 'both') {
    const matchedEnvUser = verifyEnvUser(userTrim, password);
    if (matchedEnvUser) {
      const now = Date.now();
      const expiresAt = now + (rememberMe !== false ? THREE_DAYS_MS : 24 * 60 * 60 * 1000);
      const token = `tk_${Math.random().toString(36).slice(2)}${now.toString(36)}`;
      const session = {
        id: matchedEnvUser.id,
        username: matchedEnvUser.username,
        group: matchedEnvUser.group,
        role: matchedEnvUser.role,
        fullName: matchedEnvUser.fullName,
        source: 'env',
        createdAt: now,
        expiresAt,
        rememberMe: rememberMe !== false,
      };
      tokens.set(token, session);
      saveSessions();
      return res.json({ ok: true, token, expiresAt, ...session });
    }

    // Nếu người dùng chọn CHỈ xác thực từ .env
    if (authSource === 'env') {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu đăng nhập (.env).' });
    }
  }

  // 2. Xác thực trực tiếp qua MikroTik RouterOS REST API (khi AUTH_SOURCE = 'routeros' hoặc 'both')
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

      const now = Date.now();
      const expiresAt = now + (rememberMe !== false ? THREE_DAYS_MS : 24 * 60 * 60 * 1000);
      const token = `tk_${Math.random().toString(36).slice(2)}${now.toString(36)}`;
      const session = {
        id: current?.['.id'] || `usr_${userTrim}`,
        username: current?.name || userTrim,
        group,
        role,
        fullName,
        source: 'routeros',
        createdAt: now,
        expiresAt,
        rememberMe: rememberMe !== false,
      };
      tokens.set(token, session);
      saveSessions();
      return res.json({ ok: true, token, expiresAt, ...session });
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
  if (h) {
    tokens.delete(h);
    saveSessions();
  }
  res.json({ ok: true });
});

// Lấy thông tin tài khoản đang đăng nhập
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ----------------------------------------------------------------------------
// Quản lý System Users trực tiếp trên MikroTik RouterOS (/user) & .env
// ----------------------------------------------------------------------------
app.get('/api/admin/users', requireAuth, requireRole(['admin']), async (req, res) => {
  const authSource = (process.env.AUTH_SOURCE || 'routeros').toLowerCase().trim();
  const envList = (authSource === 'env' || authSource === 'both')
    ? getEnvUsers().map((u) => ({
        id: u.id,
        username: u.username,
        group: u.group,
        role: u.role,
        fullName: `${u.fullName} (.env)`,
        disabled: 'false',
        source: 'env',
      }))
    : [];

  try {
    let safe = [];
    if (authSource !== 'env') {
      const list = await mtik('GET', '/user');
      safe = (Array.isArray(list) ? list : []).map((u) => ({
        id: u['.id'],
        username: u.name,
        group: u.group || 'read',
        role: mapGroupToRole(u.group),
        fullName: u.comment || '',
        disabled: u.disabled || 'false',
        source: 'routeros',
      }));
    }
    res.json([...envList, ...safe]);
  } catch (err) {
    if (envList.length > 0) {
      return res.json(envList);
    }
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
// Tất cả thiết bị kết nối vào Router (/ip/hotspot/host & /ip/dhcp-server/lease)
// ----------------------------------------------------------------------------
app.get('/api/hosts', async (req, res) => {
  try {
    const [hostsRaw, leasesRaw] = await Promise.all([
      mtik('GET', '/ip/hotspot/host').catch(() => []),
      mtik('GET', '/ip/dhcp-server/lease').catch(() => []),
    ]);

    const hosts = Array.isArray(hostsRaw) ? hostsRaw : [];
    const leases = Array.isArray(leasesRaw) ? leasesRaw : [];

    // Tạo Map DHCP lease theo MAC để gán host-name chính xác cho host
    const leaseMap = new Map();
    leases.forEach((l) => {
      const mac = String(l['mac-address'] || '').toUpperCase();
      if (mac) leaseMap.set(mac, l);
    });

    const enrichedHosts = hosts.map((h) => {
      const mac = String(h['mac-address'] || h.mac_address || '').toUpperCase();
      const lease = leaseMap.get(mac);
      return {
        id: h['.id'] || mac,
        macAddress: mac,
        ipAddress: h.address || h['to-address'] || lease?.address || '',
        toAddress: h['to-address'] || '',
        server: h.server || lease?.server || 'hotspot',
        bridgePort: h['bridge-port'] || '',
        uptime: h.uptime || '',
        idleTime: h['idle-time'] || '',
        bytesIn: Number(h['bytes-in'] || 0),
        bytesOut: Number(h['bytes-out'] || 0),
        authorized: h.authorized === 'true' || h.authorized === true,
        bypassed: h.bypassed === 'true' || h.bypassed === true,
        hostName: lease?.['host-name'] || h.comment || '',
        comment: h.comment || lease?.comment || '',
        dynamic: lease?.dynamic !== 'false',
        status: h.authorized === 'true' ? 'authorized' : h.bypassed === 'true' ? 'bypassed' : 'unauthorized',
      };
    });

    res.json(enrichedHosts);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể lấy danh sách thiết bị kết nối: ' + err.message });
  }
});

app.delete('/api/hosts/:id', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    await mtik('DELETE', `/ip/hotspot/host/${encodeURIComponent(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// DHCP Servers & Static Leases Management (/ip/dhcp-server & /ip/dhcp-server/lease)
// ----------------------------------------------------------------------------
app.get('/api/dhcp/servers', async (req, res) => {
  try {
    const list = await mtik('GET', '/ip/dhcp-server');
    const safe = (Array.isArray(list) ? list : []).map((s) => ({
      id: s['.id'] || s.name,
      name: s.name || '',
      interface: s.interface || '',
      leaseTime: s['lease-time'] || '',
      addressPool: s['address-pool'] || '',
      disabled: s.disabled === 'true',
    }));
    res.json(safe);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể lấy danh sách DHCP Server: ' + err.message });
  }
});

// DHCP Leases trực tiếp kết hợp với ARP & Hotspot Hosts (đảm bảo thiết bị động luôn hiển thị)
app.get('/api/dhcp/leases', async (req, res) => {
  try {
    const [leasesRaw, hostsRaw, arpRaw] = await Promise.all([
      mtik('GET', '/ip/dhcp-server/lease').catch(() => []),
      mtik('GET', '/ip/hotspot/host').catch(() => []),
      mtik('GET', '/ip/arp').catch(() => []),
    ]);

    const leases = Array.isArray(leasesRaw) ? leasesRaw : [];
    const hosts = Array.isArray(hostsRaw) ? hostsRaw : [];
    const arp = Array.isArray(arpRaw) ? arpRaw : [];

    const leaseMacMap = new Map();
    const result = [];

    // 1. Toàn bộ bản ghi từ /ip/dhcp-server/lease
    leases.forEach((l) => {
      const mac = String(l['mac-address'] || l['active-mac-address'] || '').toUpperCase();
      const item = {
        id: l['.id'] || mac,
        ipAddress: l.address || l['active-address'] || '',
        macAddress: mac,
        hostName: l['host-name'] || '',
        server: l.server || l['active-server'] || 'all',
        status: l.status || 'bound',
        lastSeen: l['last-seen'] || '',
        expiresAfter: l['expires-after'] || '',
        dynamic: l.dynamic !== 'false' && l.dynamic !== false,
        comment: l.comment || '',
        disabled: l.disabled === 'true' || l.disabled === true,
      };
      if (mac) leaseMacMap.set(mac, item);
      result.push(item);
    });

    // 2. Bổ sung các thiết bị đang kết nối thực tế trong ARP / Hotspot Host nếu chưa có trong lease table
    const seenMacs = new Set(leaseMacMap.keys());

    // Hotspot Hosts
    hosts.forEach((h) => {
      const mac = String(h['mac-address'] || h.mac_address || '').toUpperCase();
      if (!mac || seenMacs.has(mac)) return;
      const ip = h.address || h['to-address'] || '';
      if (!ip) return;

      seenMacs.add(mac);
      result.push({
        id: h['.id'] || mac,
        ipAddress: ip,
        macAddress: mac,
        hostName: h.comment || '',
        server: h.server || 'all',
        status: 'bound',
        lastSeen: h.uptime ? `active (${h.uptime})` : 'active',
        expiresAfter: '',
        dynamic: true,
        comment: h.comment || '',
        disabled: false,
      });
    });

    // ARP Table (LAN clients)
    arp.forEach((a) => {
      const mac = String(a['mac-address'] || '').toUpperCase();
      if (!mac || seenMacs.has(mac)) return;
      const ip = a.address || '';
      if (!ip || a.invalid === 'true' || a.disabled === 'true') return;
      // Bỏ qua địa chỉ broadcast hoặc WAN
      if (ip.startsWith('127.') || ip.startsWith('169.254.') || ip.endsWith('.255')) return;

      seenMacs.add(mac);
      result.push({
        id: a['.id'] || mac,
        ipAddress: ip,
        macAddress: mac,
        hostName: a.comment || '',
        server: a.interface || 'all',
        status: a.status === 'reachable' ? 'bound' : 'waiting',
        lastSeen: 'active (arp)',
        expiresAfter: '',
        dynamic: true,
        comment: a.comment || '',
        disabled: false,
      });
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể lấy danh sách DHCP Leases: ' + err.message });
  }
});

// Thêm mới IP Tĩnh (Static DHCP Lease)
app.post('/api/dhcp/leases', requireRole(['admin', 'operator']), async (req, res) => {
  const { ipAddress, macAddress, server, hostName = '', comment = '', disabled = false } = req.body || {};
  if (!ipAddress || !macAddress) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Địa chỉ IP và MAC Address.' });
  }

  const cleanMac = macAddress.trim().toUpperCase();
  const cleanIp = ipAddress.trim();

  try {
    const payload = {
      address: cleanIp,
      'mac-address': cleanMac,
      comment: comment ? comment.trim() : (hostName ? hostName.trim() : undefined),
      disabled: disabled ? 'true' : 'false',
    };
    if (server && server !== 'all' && server !== 'all (Tất cả Server)') {
      payload.server = server.trim();
    }

    let created;
    try {
      created = await mtik('PUT', '/ip/dhcp-server/lease', payload);
    } catch (putErr) {
      try {
        created = await mtik('POST', '/ip/dhcp-server/lease', payload);
      } catch {
        created = await mtik('POST', '/ip/dhcp-server/lease/add', payload);
      }
    }

    res.status(201).json({
      ok: true,
      id: created?.['.id'] || created?.ret || cleanMac,
      ipAddress: cleanIp,
      macAddress: cleanMac,
      hostName: hostName || '',
      server: payload.server || 'all',
      dynamic: false,
      comment: payload.comment || '',
      disabled: Boolean(disabled),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể tạo IP tĩnh: ' + err.message });
  }
});

// Chỉnh sửa IP Tĩnh (Update Static/Dynamic DHCP Lease)
app.put('/api/dhcp/leases/:id', requireRole(['admin', 'operator']), async (req, res) => {
  const { id } = req.params;
  const { ipAddress, macAddress, server, hostName, comment, disabled } = req.body || {};
  try {
    const payload = {};
    if (ipAddress) payload.address = ipAddress.trim();
    if (macAddress) payload['mac-address'] = macAddress.trim().toUpperCase();
    if (server !== undefined) {
      if (server && server !== 'all' && server !== 'all (Tất cả Server)') {
        payload.server = server.trim();
      }
    }
    if (comment !== undefined) {
      payload.comment = comment.trim();
    } else if (hostName !== undefined) {
      payload.comment = hostName.trim();
    }
    if (disabled !== undefined) payload.disabled = disabled ? 'true' : 'false';

    // 1. Kiểm tra xem lease có phải là dynamic không
    let isDynamic = false;
    try {
      const current = await mtik('GET', `/ip/dhcp-server/lease/${encodeURIComponent(id)}`);
      if (current && (current.dynamic === 'true' || current.dynamic === true)) {
        isDynamic = true;
      }
    } catch {
      /* bỏ qua nếu không lấy được */
    }

    // 2. Nếu là dynamic lease, gọi make-static trước để chuyển thành static
    if (isDynamic) {
      try {
        await mtik('POST', '/ip/dhcp-server/lease/make-static', { numbers: id });
      } catch {
        try {
          await mtik('POST', `/ip/dhcp-server/lease/${encodeURIComponent(id)}/make-static`, {});
        } catch {}
      }
    }

    // 3. Tiến hành PATCH cập nhật IP mới và các thông số
    let updated;
    try {
      updated = await mtik('PATCH', `/ip/dhcp-server/lease/${encodeURIComponent(id)}`, payload);
    } catch (patchErr) {
      // Nếu PATCH báo lỗi "can not change dynamic lease", thử make-static rồi PATCH lại
      if (String(patchErr.message || '').includes('dynamic')) {
        try {
          await mtik('POST', '/ip/dhcp-server/lease/make-static', { numbers: id });
          updated = await mtik('PATCH', `/ip/dhcp-server/lease/${encodeURIComponent(id)}`, payload);
        } catch {
          updated = await mtik('PUT', `/ip/dhcp-server/lease/${encodeURIComponent(id)}`, payload);
        }
      } else {
        updated = await mtik('PUT', `/ip/dhcp-server/lease/${encodeURIComponent(id)}`, payload);
      }
    }

    res.json(updated || { ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể cập nhật IP tĩnh: ' + err.message });
  }
});

// Chuyển Lease động thành IP Tĩnh (Make Static)
app.post('/api/dhcp/leases/:id/make-static', requireRole(['admin', 'operator']), async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body || {};
  try {
    // 1. Gọi lệnh make-static chuẩn RouterOS 7 ({ numbers: id })
    try {
      await mtik('POST', '/ip/dhcp-server/lease/make-static', { numbers: id });
    } catch {
      try {
        await mtik('POST', `/ip/dhcp-server/lease/${encodeURIComponent(id)}/make-static`, {});
      } catch {}
    }

    // 2. Cập nhật comment nếu có
    if (comment !== undefined && comment !== null) {
      const patchPayload = { comment: String(comment).trim() };
      try {
        await mtik('PATCH', `/ip/dhcp-server/lease/${encodeURIComponent(id)}`, patchPayload);
      } catch {}
    }

    res.json({ ok: true, message: 'Đã chuyển thành IP tĩnh thành công' });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể chuyển thành IP tĩnh: ' + err.message });
  }
});

// Chuyển Lease tĩnh thành IP Động (Make Dynamic - Xóa cố định Static Lease để Router tự cấp phát IP Động)
app.post('/api/dhcp/leases/:id/make-dynamic', requireRole(['admin', 'operator']), async (req, res) => {
  const { id } = req.params;
  try {
    // Trên MikroTik RouterOS, xóa bản ghi static lease sẽ đưa thiết bị trở về chế độ IP động do DHCP Server tự động cấp phát
    await mtik('DELETE', `/ip/dhcp-server/lease/${encodeURIComponent(id)}`);
    res.json({ ok: true, message: 'Đã chuyển sang IP động thành công' });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể chuyển sang IP động: ' + err.message });
  }
});

app.delete('/api/dhcp/leases/:id', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    await mtik('DELETE', `/ip/dhcp-server/lease/${encodeURIComponent(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
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
// PROXMOX VE HYPERVISOR PERFORMANCE & MONITORING API (REAL & MOCK)
// ----------------------------------------------------------------------------

let currentProxmoxMode = 'auto'; // 'auto' | 'real' | 'mock'

// API cấu hình & chế độ Proxmox VE
app.get('/api/proxmox/config', (_req, res) => {
  res.json({
    ok: true,
    mode: currentProxmoxMode,
    configured: isProxmoxConfigured(),
    host: process.env.PROXMOX_HOST || '',
  });
});

app.post('/api/proxmox/mode', requireAuth, (req, res) => {
  const { mode = 'auto' } = req.body || {};
  currentProxmoxMode = ['real', 'mock', 'auto'].includes(mode) ? mode : 'auto';
  res.json({ ok: true, mode: currentProxmoxMode });
});

// Lấy tóm tắt hiệu năng Proxmox VE (Real hoặc Mock fallback)
app.get('/api/proxmox/summary', async (req, res) => {
  try {
    if (currentProxmoxMode !== 'mock' && isProxmoxConfigured()) {
      try {
        const realData = await getRealProxmoxSummary();
        return res.json(realData);
      } catch (err) {
        console.warn('[proxmox] Không thể kết nối Proxmox VE thật, chuyển sang Mock:', err.message);
        if (currentProxmoxMode === 'real') {
          const mock = getMockProxmoxSummary();
          mock.realError = err.message;
          mock.isFallback = true;
          return res.json(mock);
        }
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
app.get('/api/proxmox/events', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  async function fetchProxmox() {
    if (currentProxmoxMode !== 'mock' && isProxmoxConfigured()) {
      try {
        return await getRealProxmoxSummary();
      } catch (err) {
        // Fallback to mock on connection glitch
      }
    }
    return getMockProxmoxSummary();
  }

  // Gửi gói đầu tiên ngay khi kết nối
  try {
    const initial = await fetchProxmox();
    res.write(`data: ${JSON.stringify(initial)}\n\n`);
  } catch {}

  const intervalMs = 2000; // 2 giây một lần cho Real Proxmox API
  const timer = setInterval(async () => {
    try {
      const payload = await fetchProxmox();
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      clearInterval(timer);
    }
  }, intervalMs);

  req.on('close', () => {
    clearInterval(timer);
  });
});


// Điều khiển nguồn máy chủ vật lý Proxmox Node (Reboot / Shutdown)
app.post('/api/proxmox/node/action', requireRole(['admin']), async (req, res) => {
  const { command = 'reboot' } = req.body || {};
  try {
    if (isProxmoxConfigured()) {
      const result = await executeRealProxmoxNodeAction(command);
      return res.json(result);
    }
    const result = executeMockProxmoxNodeAction(command);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Lỗi điều khiển nguồn máy chủ Proxmox: ' + err.message });
  }
});

// Điều khiển nguồn MikroTik RouterOS (Reboot / Shutdown)
app.post('/api/router/reboot', requireRole(['admin']), async (req, res) => {
  try {
    await mtik('POST', '/system/reboot', {});
    res.json({ ok: true, message: 'Đang khởi động lại Router MikroTik...' });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể khởi động lại Router: ' + err.message });
  }
});

app.post('/api/router/shutdown', requireRole(['admin']), async (req, res) => {
  try {
    await mtik('POST', '/system/shutdown', {});
    res.json({ ok: true, message: 'Đang tắt nguồn Router MikroTik...' });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Không thể tắt nguồn Router: ' + err.message });
  }
});

// Thực hiện tác vụ điều khiển máy ảo / container (start, stop, reboot)
app.post('/api/proxmox/guests/:type/:vmid/action', requireRole(['admin', 'operator']), async (req, res) => {
  const { type, vmid } = req.params;
  const { action } = req.body || {};
  try {
    if (isProxmoxConfigured()) {
      try {
        const result = await executeRealProxmoxAction(type, vmid, action);
        return res.json(result);
      } catch (err) {
        console.warn(`[proxmox] Lỗi thực thi tác vụ trên Proxmox thật (${type} ${vmid}):`, err.message);
        return res.status(err.status || 500).json({ error: err.message });
      }
    }

    const result = executeMockProxmoxAction(type, vmid, action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// PROXMOX VE VM & CONTAINER (LXC) MANAGEMENT CRUD ENDPOINTS
// ----------------------------------------------------------------------------

// Lấy Next VMID khả dụng
app.get('/api/proxmox/nextid', requireAuth, async (req, res) => {
  try {
    if (isProxmoxConfigured()) {
      const nextId = await getRealNextVmid();
      return res.json({ nextId });
    }
    const nextId = getMockNextVmid();
    res.json({ nextId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Lấy danh sách Task Logs gần nhất
app.get('/api/proxmox/tasks', requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    if (isProxmoxConfigured()) {
      const tasks = await getRealProxmoxTasks(limit);
      return res.json(tasks);
    }
    const tasks = getMockProxmoxTasks(limit);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy danh sách Template & ISO
app.get('/api/proxmox/templates', requireAuth, async (req, res) => {
  try {
    if (isProxmoxConfigured()) {
      const templates = await getRealProxmoxTemplates();
      return res.json(templates);
    }
    const templates = getMockTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Quản trị Máy ảo (VM / QEMU) ---

// Danh sách VM
app.get('/api/proxmox/vms', requireAuth, async (req, res) => {
  try {
    if (isProxmoxConfigured()) {
      const vms = await getRealProxmoxVms();
      return res.json(vms);
    }
    const summary = getMockProxmoxSummary();
    res.json(summary.vms || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chi tiết cấu hình 1 VM
app.get('/api/proxmox/vms/:vmid/config', requireAuth, async (req, res) => {
  try {
    const { vmid } = req.params;
    if (isProxmoxConfigured()) {
      const config = await getRealProxmoxVmConfig(vmid);
      return res.json(config);
    }
    const summary = getMockProxmoxSummary();
    const vm = (summary.vms || []).find((v) => v.vmid === Number(vmid));
    if (!vm) return res.status(404).json({ error: 'Không tìm thấy VM' });
    res.json(vm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tạo VM mới
app.post('/api/proxmox/vms', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
  try {
    if (isProxmoxConfigured()) {
      const result = await createRealProxmoxVm(req.body);
      return res.status(201).json(result);
    }
    const created = createMockVm(req.body);
    res.status(201).json({ success: true, mode: 'mock', ...created });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Cập nhật VM
app.put('/api/proxmox/vms/:vmid', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
  try {
    const { vmid } = req.params;
    if (isProxmoxConfigured()) {
      const result = await updateRealProxmoxVm(vmid, req.body);
      return res.json(result);
    }
    const updated = updateMockVm(vmid, req.body);
    res.json({ success: true, mode: 'mock', ...updated });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Xóa VM
app.delete('/api/proxmox/vms/:vmid', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { vmid } = req.params;
    const purge = req.query.purge !== 'false';
    if (isProxmoxConfigured()) {
      const result = await deleteRealProxmoxVm(vmid, purge);
      return res.json(result);
    }
    const result = deleteMockVm(vmid);
    res.json({ success: true, mode: 'mock', ...result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// --- Quản trị Containers (LXC / CT) ---

// Danh sách LXC
app.get('/api/proxmox/lxcs', requireAuth, async (req, res) => {
  try {
    if (isProxmoxConfigured()) {
      const lxcs = await getRealProxmoxLxcs();
      return res.json(lxcs);
    }
    const summary = getMockProxmoxSummary();
    res.json(summary.lxcs || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chi tiết cấu hình 1 LXC
app.get('/api/proxmox/lxcs/:vmid/config', requireAuth, async (req, res) => {
  try {
    const { vmid } = req.params;
    if (isProxmoxConfigured()) {
      const config = await getRealProxmoxLxcConfig(vmid);
      return res.json(config);
    }
    const summary = getMockProxmoxSummary();
    const lxc = (summary.lxcs || []).find((c) => c.vmid === Number(vmid));
    if (!lxc) return res.status(404).json({ error: 'Không tìm thấy LXC' });
    res.json(lxc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tạo LXC mới
app.post('/api/proxmox/lxcs', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
  try {
    if (isProxmoxConfigured()) {
      const result = await createRealProxmoxLxc(req.body);
      return res.status(201).json(result);
    }
    const created = createMockLxc(req.body);
    res.status(201).json({ success: true, mode: 'mock', ...created });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Cập nhật LXC
app.put('/api/proxmox/lxcs/:vmid', requireAuth, requireRole(['admin', 'operator']), async (req, res) => {
  try {
    const { vmid } = req.params;
    if (isProxmoxConfigured()) {
      const result = await updateRealProxmoxLxc(vmid, req.body);
      return res.json(result);
    }
    const updated = updateMockLxc(vmid, req.body);
    res.json({ success: true, mode: 'mock', ...updated });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Xóa LXC
app.delete('/api/proxmox/lxcs/:vmid', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { vmid } = req.params;
    const purge = req.query.purge !== 'false';
    if (isProxmoxConfigured()) {
      const result = await deleteRealProxmoxLxc(vmid, purge);
      return res.json(result);
    }
    const result = deleteMockLxc(vmid);
    res.json({ success: true, mode: 'mock', ...result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// ============================================================================
// Giám sát Home Assistant OS (HassOS) - Hỗ trợ Real REST/Supervisor API & Mock
// ============================================================================

let currentHassMode = 'auto'; // 'auto' | 'real' | 'mock'

// API cấu hình & chế độ Home Assistant OS
app.get('/api/hass/config', (_req, res) => {
  res.json({
    ok: true,
    mode: currentHassMode,
    configured: isHassConfigured(),
    url: process.env.HASS_URL || 'http://192.168.20.20:8123',
  });
});

app.post('/api/hass/mode', requireAuth, (req, res) => {
  const { mode = 'auto' } = req.body || {};
  currentHassMode = ['real', 'mock', 'auto'].includes(mode) ? mode : 'auto';
  cachedHassData = null;
  lastHassFetchTime = 0;
  res.json({ ok: true, mode: currentHassMode });
});

// Helper lấy dữ liệu Hass (Real hoặc Mock fallback) với bộ nhớ đệm ngắn 1500ms
let cachedHassData = null;
let lastHassFetchTime = 0;
let hassFetchPromise = null;

async function fetchHassData() {
  const now = Date.now();
  if (cachedHassData && now - lastHassFetchTime < 1500) {
    return cachedHassData;
  }

  if (hassFetchPromise) {
    return hassFetchPromise;
  }

  hassFetchPromise = (async () => {
    try {
      // 1. Chế độ Mock cưỡng bức
      if (currentHassMode === 'mock') {
        const mock = getMockHassSummary();
        cachedHassData = mock;
        lastHassFetchTime = Date.now();
        return mock;
      }

      // 2. Chế độ Real hoặc Auto
      if (isHassConfigured()) {
        try {
          const real = await getRealHassSummary();
          cachedHassData = real;
          lastHassFetchTime = Date.now();
          return real;
        } catch (err) {
          console.warn('[HassOS] Không thể lấy dữ liệu từ HassOS thật, chuyển Mock:', err.message);
          if (currentHassMode === 'real') {
            const fallbackMock = getMockHassSummary();
            fallbackMock.realError = err.message;
            fallbackMock.isFallback = true;
            cachedHassData = fallbackMock;
            lastHassFetchTime = Date.now();
            return fallbackMock;
          }
        }
      }
      const mock = getMockHassSummary();
      cachedHassData = mock;
      lastHassFetchTime = Date.now();
      return mock;
    } finally {
      hassFetchPromise = null;
    }
  })();

  return hassFetchPromise;
}

// Lấy tóm tắt chỉ số Home Assistant OS
app.get('/api/hass/summary', async (req, res) => {
  try {
    const data = await fetchHassData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy dữ liệu Home Assistant OS: ' + err.message });
  }
});

// Luồng Server-Sent Events (SSE) đẩy dữ liệu HassOS thời gian thực
app.get('/api/hass/events', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  let isClosed = false;
  let timer = null;

  async function pushEvent() {
    if (isClosed) return;
    try {
      const payload = await fetchHassData();
      if (!isClosed) {
        res.write('data: ' + JSON.stringify(payload) + '\n\n');
      }
    } catch {
      // Bỏ qua lỗi tạm thời
    } finally {
      if (!isClosed) {
        timer = setTimeout(pushEvent, 2000);
      }
    }
  }

  pushEvent();

  req.on('close', () => {
    isClosed = true;
    if (timer) clearTimeout(timer);
  });
});

// Điều khiển Add-on của HassOS (start, stop, restart)
app.post('/api/hass/addons/:slug/action', (req, res) => {
  const { slug } = req.params;
  const { action } = req.body || {};
  try {
    const result = executeMockHassAddonAction(slug, action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Điều khiển hệ thống Core / Supervisor / Host của HassOS
app.post('/api/hass/core/action', async (req, res) => {
  const { action } = req.body || {};
  try {
    if (isHassConfigured()) {
      try {
        const result = await executeRealHassCoreAction(action);
        return res.json(result);
      } catch (err) {
        console.warn('[HassOS] Lỗi gọi Action trên Hass thật:', err.message);
      }
    }
    const result = executeMockHassCoreAction(action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lấy danh sách States thực tế từ Home Assistant (Proxy qua backend Express để tránh CORS/Mixed Content)
app.get('/api/hass/states', async (req, res) => {
  try {
    if (currentHassMode !== 'mock' && isHassConfigured()) {
      try {
        const states = await getRealHassStates();
        return res.json(states);
      } catch (err) {
        console.warn('[HassOS] Lỗi lấy danh sách states từ Home Assistant thật:', err.message);
        if (currentHassMode === 'real') {
          return res.status(502).json({ error: 'Không thể kết nối Home Assistant thật: ' + err.message });
        }
      }
    }
    // Chế độ Mock fallback
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy states Home Assistant: ' + err.message });
  }
});

// Proxy gọi Service điều khiển thiết bị Home Assistant (turn_on, turn_off, toggle, set_temperature,...)
app.post('/api/hass/services/:domain/:service', async (req, res) => {
  const { domain, service } = req.params;
  const serviceData = req.body || {};
  try {
    if (currentHassMode !== 'mock' && isHassConfigured()) {
      try {
        const result = await callRealHassService(domain, service, serviceData);
        return res.json(result);
      } catch (err) {
        console.warn(`[HassOS] Lỗi gọi service ${domain}.${service}:`, err.message);
        if (currentHassMode === 'real') {
          return res.status(502).json({ error: 'Lỗi điều khiển thiết bị: ' + err.message });
        }
      }
    }
    // Mock fallback response
    res.json({ success: true, mode: 'mock', domain, service });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thực thi service: ' + err.message });
  }
});


// ----------------------------------------------------------------------------
// Sổ quản lý IP (IPAM - IP Address Management) - Lưu JSON tại backend/data/ip-plan.json
// ----------------------------------------------------------------------------
const IPAM_FILE = path.join(__dirname, 'data', 'ip-plan.json');
const IPAM_DEFAULT_FILE = path.join(__dirname, 'data', 'ip-plan.default.json');

function loadIpamData() {
  try {
    if (fs.existsSync(IPAM_FILE)) {
      const raw = fs.readFileSync(IPAM_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    if (fs.existsSync(IPAM_DEFAULT_FILE)) {
      const raw = fs.readFileSync(IPAM_DEFAULT_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[ipam] Không thể đọc ip-plan.json:', err.message);
  }
  return [];
}

function saveIpamData(list) {
  try {
    const dir = path.dirname(IPAM_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(IPAM_FILE, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[ipam] Không thể ghi ip-plan.json:', err.message);
    throw new Error('Lỗi khi lưu dữ liệu sổ quản lý IP vào tệp tin');
  }
}

// Lấy danh sách IP logbook
app.get('/api/ipam', requireAuth, (_req, res) => {
  const data = loadIpamData();
  res.json({ ok: true, data });
});

// Thêm mới mục IP logbook
app.post('/api/ipam', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
  const body = req.body || {};
  if (!body.ip || !String(body.ip).trim()) {
    return res.status(400).json({ error: 'Địa chỉ IP hoặc dải IP là bắt buộc' });
  }
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ error: 'Tên thiết bị / dịch vụ là bắt buộc' });
  }

  const list = loadIpamData();
  const nowIso = new Date().toISOString();
  
  const newItem = {
    id: body.id ? String(body.id) : String(Date.now()),
    zoneKey: body.zoneKey || 'infra',
    zoneVi: body.zoneVi || 'Hạ tầng mạng',
    zoneEn: body.zoneEn || 'Network Infrastructure',
    ip: String(body.ip).trim(),
    name: String(body.name).trim(),
    mac: body.mac ? String(body.mac).trim() : '—',
    os: body.os ? String(body.os).trim() : '—',
    port: body.port ? String(body.port).trim() : '—',
    webUrl: body.webUrl ? String(body.webUrl).trim() : '',
    location: body.location ? String(body.location).trim() : '—',
    status: body.status || 'Online',
    notesVi: body.notesVi ? String(body.notesVi).trim() : '',
    notesEn: body.notesEn ? String(body.notesEn).trim() : '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  list.push(newItem);
  saveIpamData(list);

  res.status(201).json({ ok: true, item: newItem });
});

// Chỉnh sửa mục IP logbook
app.put('/api/ipam/:id', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const list = loadIpamData();
  
  const index = list.findIndex((item) => String(item.id) === String(id));
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy mục IP cần chỉnh sửa' });
  }

  const existing = list[index];
  const nowIso = new Date().toISOString();

  const updatedItem = {
    ...existing,
    zoneKey: body.zoneKey !== undefined ? body.zoneKey : existing.zoneKey,
    zoneVi: body.zoneVi !== undefined ? body.zoneVi : existing.zoneVi,
    zoneEn: body.zoneEn !== undefined ? body.zoneEn : existing.zoneEn,
    ip: body.ip !== undefined ? String(body.ip).trim() : existing.ip,
    name: body.name !== undefined ? String(body.name).trim() : existing.name,
    mac: body.mac !== undefined ? String(body.mac).trim() : existing.mac,
    os: body.os !== undefined ? String(body.os).trim() : existing.os,
    port: body.port !== undefined ? String(body.port).trim() : existing.port,
    webUrl: body.webUrl !== undefined ? String(body.webUrl).trim() : existing.webUrl,
    location: body.location !== undefined ? String(body.location).trim() : existing.location,
    status: body.status !== undefined ? body.status : existing.status,
    notesVi: body.notesVi !== undefined ? String(body.notesVi).trim() : existing.notesVi,
    notesEn: body.notesEn !== undefined ? String(body.notesEn).trim() : existing.notesEn,
    updatedAt: nowIso,
  };

  list[index] = updatedItem;
  saveIpamData(list);

  res.json({ ok: true, item: updatedItem });
});

// Xóa một mục IP logbook
app.delete('/api/ipam/:id', requireAuth, requireRole(['admin', 'operator']), (req, res) => {
  const { id } = req.params;
  const list = loadIpamData();
  
  const index = list.findIndex((item) => String(item.id) === String(id));
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy mục IP cần xóa' });
  }

  const deleted = list.splice(index, 1)[0];
  saveIpamData(list);

  res.json({ ok: true, item: deleted });
});

// Khôi phục danh sách IP logbook về dữ liệu gốc mặc định
app.post('/api/ipam/reset-default', requireAuth, requireRole(['admin', 'operator']), (_req, res) => {
  try {
    let defaultList = [];
    if (fs.existsSync(IPAM_DEFAULT_FILE)) {
      const raw = fs.readFileSync(IPAM_DEFAULT_FILE, 'utf-8');
      defaultList = JSON.parse(raw);
    }
    saveIpamData(defaultList);
    res.json({ ok: true, data: defaultList });
  } catch (err) {
    res.status(500).json({ error: 'Không thể khôi phục dữ liệu mặc định: ' + err.message });
  }
});


// ----------------------------------------------------------------------------
// Serve frontend production (frontend/dist) nếu đã build
// ----------------------------------------------------------------------------
const DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const HAS_BUILD = fs.existsSync(path.join(DIST, 'index.html'));
if (HAS_BUILD) {
  app.use(express.static(DIST, { maxAge: '1y', immutable: true, index: false }));
  app.get(/^\/(?!api|assets|fonts).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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
  const authSourceMode = (AUTH_SOURCE || 'routeros').toLowerCase().trim();
  const authDesc = authSourceMode === 'env' 
    ? 'Chỉ xác thực qua biến môi trường (.env)' 
    : authSourceMode === 'both' 
      ? 'Kết hợp file .env và RouterOS (/user)' 
      : 'Xác thực trực tiếp qua MikroTik RouterOS (/user)';
  console.log(`[backend] Auth đăng nhập: ${authSourceMode.toUpperCase()} (${authDesc})`);
  if (HAS_BUILD) {
    console.log(`[backend] Serve frontend production tại http://localhost:${PORT}`);
  }
});