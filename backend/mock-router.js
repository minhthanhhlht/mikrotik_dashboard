// ============================================================================
// Mock MikroTik REST API - dùng để phát triển/kiểm thử giao diện
// khi chưa có router thật (giả lập /rest/ip/hotspot/* với dữ liệu trong RAM).
//
// Chạy:  npm run mock   (trong thư mục backend)
//        -> lắng nghe tại http://localhost:4000/rest
// ============================================================================
import express from 'express';

const app = express();
app.use(express.json());

// Kiểm tra Basic Auth (chỉ cần có header, chấp nhận mọi user/pass)
app.use('/rest', (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) {
    return res.status(401).json({ error: 403, message: 'login failed' });
  }
  next();
});

// ID kiểu MikroTik: "*XX"
let seq = 0;
const mk = (obj) => {
  seq += 1;
  return { '.id': `*S${seq.toString(16).toUpperCase()}`, ...obj };
};

// ----------------------------------------------------------------------------
// Dữ liệu mẫu
// ----------------------------------------------------------------------------
const profiles = [
  { '.id': '*1', name: 'default', 'shared-users': '1' },
  { '.id': '*2', name: 'VIP', 'shared-users': '5', 'rate-limit': '20M/20M' },
  { '.id': '*3', name: 'khach-4h', 'shared-users': '1', 'rate-limit': '5M/5M' },
];

const users = [
  mk({
    name: 'khach1',
    password: '123456',
    profile: 'default',
    'limit-uptime': '00:30:00',
    'limit-bytes-total': '1073741824',
    comment: 'Khách lẻ tầng 1',
    disabled: 'false',
    uptime: '0s',
    'creation-time': '2026-09-01 10:00:00',
  }),
  mk({
    name: 'khach2',
    password: '123456',
    profile: 'default',
    'limit-uptime': '1d',
    'limit-bytes-total': '2147483648',
    comment: '',
    disabled: 'false',
    uptime: '0s',
    'creation-time': '2026-09-02 08:30:00',
  }),
  mk({
    name: 'vip-anh-tuan',
    password: 'vip123',
    profile: 'VIP',
    'limit-uptime': '7d',
    comment: 'NVIP ưu tiên',
    disabled: 'false',
    uptime: '0s',
    'creation-time': '2026-08-20 14:00:00',
  }),
  mk({
    name: 'khach-bloc',
    password: '234567',
    profile: 'khach-4h',
    'limit-bytes-total': '524288000',
    comment: 'Đã thanh toán chậm',
    disabled: 'true',
    uptime: '0s',
    'creation-time': '2026-08-25 09:15:00',
  }),
];

const active = [
  {
    '.id': '*A1',
    server: 'hotspot1',
    user: 'khach1',
    domain: '',
    ip: '192.168.88.15',
    'mac-address': 'AA:BB:CC:DD:EE:01',
    uptime: '00:12:34',
    'idle-time': '00:00:07',
    'bytes-in': 5234123,
    'bytes-out': 88219213,
    'session-time-left': '00:17:26',
  },
  {
    '.id': '*A2',
    server: 'hotspot1',
    user: 'vip-anh-tuan',
    domain: '',
    ip: '192.168.88.22',
    'mac-address': 'AA:BB:CC:DD:EE:02',
    uptime: '1d02:12:01',
    'idle-time': '00:01:02',
    'bytes-in': 145223489,
    'bytes-out': 2904412234,
    'session-time-left': '5d21:47:59',
  },
  {
    '.id': '*A3',
    server: 'hotspot1',
    user: '(chưa đăng nhập)',
    domain: 'login',
    ip: '192.168.88.199',
    'mac-address': 'AA:BB:CC:DD:EE:03',
    uptime: '00:00:11',
    'idle-time': '00:00:00',
    'bytes-in': 40550,
    'bytes-out': 2140,
    'session-time-left': '',
  },
];

// ----------------------------------------------------------------------------
// Routes giả lập
// ----------------------------------------------------------------------------
app.get('/rest/ip/hotspot/user/profile', (req, res) => res.json(profiles));

app.put('/rest/ip/hotspot/user/profile', (req, res) => {
  const p = req.body || {};
  if (!p.name) return res.status(400).json({ error: 'missing field name' });
  const created = mk(p);
  profiles.push(created);
  res.status(201).json(created);
});

app.patch('/rest/ip/hotspot/user/profile/:id', (req, res) => {
  const p = profiles.find((x) => x['.id'] === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { '.id': _drop, ...patch } = req.body || {};
  Object.assign(p, patch);
  res.json(p);
});
app.put('/rest/ip/hotspot/user/profile/:id', (req, res) => {
  const p = profiles.find((x) => x['.id'] === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { '.id': _drop, ...patch } = req.body || {};
  Object.assign(p, patch);
  res.json(p);
});

app.delete('/rest/ip/hotspot/user/profile/:id', (req, res) => {
  const i = profiles.findIndex((x) => x['.id'] === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  profiles.splice(i, 1);
  res.status(200).json({});
});

app.get('/rest/ip/hotspot/user', (req, res) => res.json(users));

// RouterOS 7.20 tạo item bằng PUT zbiorczy (không có id)
app.put('/rest/ip/hotspot/user', (req, res) => {
  const u = req.body || {};
  if (!u.name) return res.status(400).json({ error: 'missing field name' });
  if (users.some((x) => x.name === u.name)) {
    return res.status(400).json({ error: `duplicate user name - ${u.name}` });
  }
  const created = mk({ ...u, disabled: u.disabled || 'false', uptime: '0s' });
  users.push(created);
  res.status(201).json(created);
});

app.post('/rest/ip/hotspot/user', (req, res) => {
  const u = req.body || {};
  if (!u.name) return res.status(400).json({ error: 'missing field name' });
  if (users.some((x) => x.name === u.name)) {
    return res.status(400).json({ error: `duplicate user name - ${u.name}` });
  }
  const created = mk({ ...u, disabled: u.disabled || 'false', uptime: '0s' });
  users.push(created);
  res.status(201).json(created);
});

// reset-counters-by-id (backend có fallback -> unblock)
app.post('/rest/ip/hotspot/user/reset-counters-by-id', (req, res) => {
  const id = req.body?.id || req.body?.['.id'];
  const target = users.find((u) => u['.id'] === id);
  if (!target) return res.status(404).json({ error: 'not found' });
  target['bytes-in'] = '0';
  target['bytes-out'] = '0';
  res.json({});
});

const findUser = (id) => users.find((u) => u['.id'] === id);

function patchUser(req, res) {
  const u = findUser(req.params.id);
  if (!u) return res.status(404).json({ error: 'not found' });
  const { '.id': _drop, uptime: _drop2, ...patch } = req.body || {};
  Object.assign(u, patch);
  res.json(u);
}

app.patch('/rest/ip/hotspot/user/:id', patchUser);
app.put('/rest/ip/hotspot/user/:id', patchUser);

app.delete('/rest/ip/hotspot/user/:id', (req, res) => {
  const i = users.findIndex((u) => u['.id'] === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  users.splice(i, 1);
  res.status(200).json({});
});

app.get('/rest/ip/hotspot/active', (req, res) => res.json(active));

app.delete('/rest/ip/hotspot/active/:id', (req, res) => {
  const i = active.findIndex((a) => a['.id'] === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  active.splice(i, 1);
  res.status(200).json({});
});

// ----------------------------------------------------------------------------
// System Users (/user) - tài khoản quản trị MikroTik RouterOS
// ----------------------------------------------------------------------------
const routerUsers = [
  mk({
    name: 'admin',
    password: 'mikrotik2026',
    group: 'full',
    comment: 'Quản trị viên Hệ thống (MikroTik full)',
    disabled: 'false',
  }),
  mk({
    name: 'nhanvien',
    password: 'nhanvien123',
    group: 'write',
    comment: 'Nhân viên Vận hành Hotspot (MikroTik write)',
    disabled: 'false',
  }),
  mk({
    name: 'giamstat',
    password: 'giamstat123',
    group: 'read',
    comment: 'Giám sát viên (MikroTik read)',
    disabled: 'false',
  }),
];

app.get('/rest/user', (req, res) => {
  // Trả về danh sách user không kèm plain password
  const safe = routerUsers.map(({ password: _p, ...u }) => u);
  res.json(safe);
});

app.put('/rest/user', (req, res) => {
  const u = req.body || {};
  if (!u.name) return res.status(400).json({ error: 'missing field name' });
  if (routerUsers.some((x) => x.name === u.name)) {
    return res.status(400).json({ error: `duplicate user name - ${u.name}` });
  }
  const created = mk({
    name: u.name,
    password: u.password || '',
    group: u.group || 'read',
    comment: u.comment || '',
    disabled: u.disabled || 'false',
  });
  routerUsers.push(created);
  const { password: _p, ...safe } = created;
  res.status(201).json(safe);
});

app.post('/rest/user', (req, res) => {
  const u = req.body || {};
  if (!u.name) return res.status(400).json({ error: 'missing field name' });
  if (routerUsers.some((x) => x.name === u.name)) {
    return res.status(400).json({ error: `duplicate user name - ${u.name}` });
  }
  const created = mk({
    name: u.name,
    password: u.password || '',
    group: u.group || 'read',
    comment: u.comment || '',
    disabled: u.disabled || 'false',
  });
  routerUsers.push(created);
  const { password: _p, ...safe } = created;
  res.status(201).json(safe);
});

function patchRouterUser(req, res) {
  const u = routerUsers.find((x) => x['.id'] === req.params.id);
  if (!u) return res.status(404).json({ error: 'not found' });
  const { '.id': _drop, ...patch } = req.body || {};
  Object.assign(u, patch);
  const { password: _p, ...safe } = u;
  res.json(safe);
}

app.patch('/rest/user/:id', patchRouterUser);
app.put('/rest/user/:id', patchRouterUser);

// ----------------------------------------------------------------------------
// System Resource, Health & Interfaces - Giả lập giám sát hiệu năng RouterOS 7
// ----------------------------------------------------------------------------
const startTime = Date.now() - 3600000 * 52; // Giả lập uptime ~2 ngày 4 giờ

const mockInterfaces = [
  {
    '.id': '*I1',
    name: 'ether1-WAN',
    type: 'ether',
    running: 'true',
    disabled: 'false',
    'rx-byte': 14208920194,
    'tx-byte': 3290481024,
    'rx-packet': 10492012,
    'tx-packet': 6492014,
    'rx-drop': 0,
    'tx-drop': 0,
    'rx-error': 0,
    'tx-error': 0,
    comment: 'Internet Fiber VNPT / Viettel',
  },
  {
    '.id': '*I2',
    name: 'ether2-LAN',
    type: 'ether',
    running: 'true',
    disabled: 'false',
    'rx-byte': 3120481024,
    'tx-byte': 13808920194,
    'rx-packet': 6392014,
    'tx-packet': 10292012,
    'rx-drop': 0,
    'tx-drop': 0,
    'rx-error': 0,
    'tx-error': 0,
    comment: 'LAN Switch Trunk',
  },
  {
    '.id': '*I3',
    name: 'ether3-Local',
    type: 'ether',
    running: 'false',
    disabled: 'false',
    'rx-byte': 1204891,
    'tx-byte': 489201,
    'rx-packet': 8920,
    'tx-packet': 4102,
    'rx-drop': 0,
    'tx-drop': 0,
    'rx-error': 0,
    'tx-error': 0,
    comment: 'Quản trị nội bộ',
  },
  {
    '.id': '*I4',
    name: 'wlan1-Hotspot',
    type: 'wlan',
    running: 'true',
    disabled: 'false',
    'rx-byte': 5820481024,
    'tx-byte': 8920481024,
    'rx-packet': 4920184,
    'tx-packet': 7120481,
    'rx-drop': 12,
    'tx-drop': 0,
    'rx-error': 0,
    'tx-error': 0,
    comment: 'WiFi Hotspot Access Points',
  },
];

app.get('/rest/system/resource', (req, res) => {
  const upSec = Math.floor((Date.now() - startTime) / 1000);
  const d = Math.floor(upSec / 86400);
  const h = Math.floor((upSec % 86400) / 3600);
  const m = Math.floor((upSec % 3600) / 60);
  const s = upSec % 60;
  const uptimeStr = `${d > 0 ? `${d}d` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  // Giả lập CPU load dao động tự nhiên từ 8% đến 65%
  const randomCpuLoad = Math.floor(12 + Math.sin(Date.now() / 3000) * 10 + Math.random() * 8);
  const totalMem = 1073741824; // 1 GB
  const usedMem = Math.floor(totalMem * (0.35 + Math.sin(Date.now() / 8000) * 0.05));
  const freeMem = totalMem - usedMem;

  res.json({
    uptime: uptimeStr,
    version: '7.16.1 (stable)',
    'build-time': '2024-09-01 10:12:00',
    'factory-software': '7.1.0',
    'free-memory': freeMem,
    'total-memory': totalMem,
    cpu: 'ARM64',
    'cpu-count': 4,
    'cpu-frequency': 1400,
    'cpu-load': Math.max(2, Math.min(99, randomCpuLoad)),
    'free-hdd-space': 118489088,
    'total-hdd-space': 134217728,
    'write-sect-since-reboot': 14205,
    'write-sect-total': 682014,
    'bad-blocks': '0%',
    'architecture-name': 'arm64',
    'board-name': 'hEX S (RB760iGS)',
    platform: 'MikroTik',
  });
});

app.get('/rest/system/routerboard', (req, res) => {
  res.json({
    routerboard: 'true',
    model: 'RB760iGS',
    'serial-number': 'HE760A9B2C3D',
    'current-firmware': '7.16.1',
    'upgrade-firmware': '7.16.1',
    'factory-firmware': '7.1.0',
  });
});

app.get('/rest/system/health', (req, res) => {
  const temp = Math.round((42 + Math.sin(Date.now() / 10000) * 2 + Math.random() * 0.5) * 10) / 10;
  const volt = Math.round((24.1 + Math.random() * 0.1) * 10) / 10;
  res.json([
    { name: 'temperature', value: temp, type: 'C' },
    { name: 'voltage', value: volt, type: 'V' },
  ]);
});

app.get('/rest/interface', (req, res) => {
  // Giả lập lưu lượng byte tăng dần theo thời gian (mô phỏng tốc độ mạng ~5 - 35 Mbps)
  const now = Date.now();
  const simulatedBytesRx = Math.floor((now % 10000000) * 1500);
  const simulatedBytesTx = Math.floor((now % 10000000) * 800);

  const list = mockInterfaces.map((item, idx) => ({
    ...item,
    'rx-byte': item['rx-byte'] + (item.running === 'true' ? simulatedBytesRx * (idx + 1) : 0),
    'tx-byte': item['tx-byte'] + (item.running === 'true' ? simulatedBytesTx * (idx + 1) : 0),
  }));
  res.json(list);
});

// ----------------------------------------------------------------------------
// File & Backup Storage Mock (/rest/file, /rest/system/backup/save, /rest/export)
// ----------------------------------------------------------------------------
const mockFiles = [
  {
    '.id': '*F1',
    name: 'auto-backup-system.backup',
    type: 'backup',
    size: '32840',
    'last-modified': '2026-09-01 10:00:00',
  },
  {
    '.id': '*F2',
    name: 'hotspot-config-export.rsc',
    type: 'script',
    size: '3450',
    'last-modified': '2026-09-02 14:30:00',
    contents: `# 2026-09-02 14:30:00 by RouterOS 7.16.1
# software id = SEH8-HNVQ
# model = RB760iGS
/interface bridge
add name=BridgeLAN vlan-filtering=yes
/ip hotspot profile
add hotspot-address=192.168.20.1 name=hsprof1
/ip hotspot user profile
add name=VIP rate-limit=20M/20M shared-users=5
add name=default rate-limit=5M/5M shared-users=1
/ip pool
add name=dhcp_pool0 ranges=192.168.20.2-192.168.20.254
/ip dhcp-server
add address-pool=dhcp_pool0 interface=BridgeLAN name=dhcp1
/ip address
add address=192.168.20.1/24 interface=BridgeLAN network=192.168.20.0
/ip hotspot user
add name=khach1 password=123456 profile=default limit-uptime=00:30:00
add name=vip-anh-tuan password=vip123 profile=VIP limit-uptime=7d`,
  },
];

app.get('/rest/file', (req, res) => {
  res.json(mockFiles);
});

app.delete('/rest/file/:id', (req, res) => {
  const i = mockFiles.findIndex((f) => f['.id'] === req.params.id || f.name === req.params.id);
  if (i !== -1) mockFiles.splice(i, 1);
  res.status(204).json({});
});

app.post('/rest/system/backup/save', (req, res) => {
  const { name = 'backup', password = '', 'dont-encrypt': dontEncrypt = 'false' } = req.body || {};
  const filename = name.endsWith('.backup') ? name : `${name}.backup`;
  const newFile = mk({
    name: filename,
    type: 'backup',
    size: String(30000 + Math.floor(Math.random() * 5000)),
    'last-modified': new Date().toISOString().replace('T', ' ').slice(0, 19),
  });
  mockFiles.unshift(newFile);
  res.json([]);
});

app.post('/rest/export', (req, res) => {
  const { file = 'export', 'show-sensitive': showSens = 'true', compact = 'true' } = req.body || {};
  const filename = file.endsWith('.rsc') ? file : `${file}.rsc`;
  const sampleScript = `# ${new Date().toISOString().replace('T', ' ').slice(0, 19)} by RouterOS 7.16.1
# software id = SEH8-HNVQ
# model = RB760iGS
/interface bridge
add name=BridgeLAN vlan-filtering=yes
/ip hotspot profile
add hotspot-address=192.168.20.1 name=hsprof1
/ip hotspot user profile
add name=VIP rate-limit=20M/20M shared-users=5
add name=default rate-limit=5M/5M shared-users=1
/ip pool
add name=dhcp_pool0 ranges=192.168.20.2-192.168.20.254
/ip dhcp-server
add address-pool=dhcp_pool0 interface=BridgeLAN name=dhcp1
/ip address
add address=192.168.20.1/24 interface=BridgeLAN network=192.168.20.0
/ip hotspot user
add name=khach1 password=123456 profile=default limit-uptime=00:30:00
add name=vip-anh-tuan password=vip123 profile=VIP limit-uptime=7d
/system clock
set time-zone-name=Asia/Bangkok`;

  const newFile = mk({
    name: filename,
    type: 'script',
    size: String(sampleScript.length),
    'last-modified': new Date().toISOString().replace('T', ' ').slice(0, 19),
    contents: sampleScript,
  });
  mockFiles.unshift(newFile);
  res.json([]);
});

const PORT = process.env.MTIK_MOCK_PORT || 4000;
app.listen(PORT, () => {
  console.log(`[mock-router] MikroTik REST giả: http://localhost:${PORT}/rest`);
});

