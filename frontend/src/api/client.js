// Client gọi backend proxy (Express) - mọi request đi qua /api
const BASE = '/api';

// Lấy token đăng nhập từ localStorage
function getToken() {
  try {
    return localStorage.getItem('hs_token') || '';
  } catch {
    return '';
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-auth-token'] = token;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      'Không kết nối được backend proxy. Hãy chạy "npm run dev:backend".'
    );
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    if (res.status === 401 && !path.includes('/auth/login')) {
      // Phiên hết hạn -> đăng xuất
      try {
        localStorage.removeItem('hs_token');
        window.location.href = '/login';
      } catch {
        /* ignore */
      }
    }
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  health: () => request('/health'),

  // Auth & Profile info
  login: (username, password, rememberMe = true) =>
    request('/auth/login', { method: 'POST', body: { username, password, rememberMe } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Quản lý tài khoản Dashboard (Admin only)
  adminUsers: () => request('/admin/users'),
  createAdminUser: (payload) =>
    request('/admin/users', { method: 'POST', body: payload }),
  updateAdminUser: (id, payload) =>
    request(`/admin/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload,
    }),
  deleteAdminUser: (id) =>
    request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Thống kê / realtime
  stats: () => request('/stats'),
  systemPerformance: () => request('/system/performance'),

  // Users
  users: () => request('/users'),
  profiles: () => request('/profiles'),
  createUser: (payload) => request('/users', { method: 'POST', body: payload }),
  updateUser: (id, payload) =>
    request(`/users/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  deleteUser: (id) =>
    request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  extendUser: (id, time) =>
    request(`/users/${encodeURIComponent(id)}/extend`, {
      method: 'POST',
      body: { time },
    }),
  resetUser: (id) =>
    request(`/users/${encodeURIComponent(id)}/reset`, { method: 'POST' }),

  // Profiles
  createProfile: (payload) => request('/profiles', { method: 'POST', body: payload }),
  updateProfile: (id, payload) =>
    request(`/profiles/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  deleteProfile: (id) =>
    request(`/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Cài đặt hệ thống (Lưu tập trung JSON trên server)
  getSettings: () => request('/settings'),
  updateSettings: (payload) =>
    request('/settings', { method: 'PUT', body: payload }),

  // Phiên hoạt động & Thiết bị kết nối Router
  active: () => request('/active'),
  disconnect: (id) =>
    request(`/active/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hosts: () => request('/hosts'),
  deleteHost: (id) =>
    request(`/hosts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  dhcpServers: () => request('/dhcp/servers'),
  dhcpLeases: () => request('/dhcp/leases'),
  createDhcpLease: (payload) => request('/dhcp/leases', { method: 'POST', body: payload }),
  updateDhcpLease: (id, payload) =>
    request(`/dhcp/leases/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  makeDhcpLeaseStatic: (id, payload) =>
    request(`/dhcp/leases/${encodeURIComponent(id)}/make-static`, { method: 'POST', body: payload }),
  makeDhcpLeaseDynamic: (id) =>
    request(`/dhcp/leases/${encodeURIComponent(id)}/make-dynamic`, { method: 'POST' }),
  deleteDhcpLease: (id) =>
    request(`/dhcp/leases/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Sao lưu & Xuất cấu hình RouterOS
  getRouterBackups: () => request('/router/backups'),
  createRouterBackup: (payload) =>
    request('/router/backup/create', { method: 'POST', body: payload }),
  deleteRouterBackup: (id) =>
    request(`/router/backups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  downloadRouterBackup: async (filename) => {
    const token = getToken();
    const headers = {};
    if (token) headers['x-auth-token'] = token;
    const res = await fetch(`/api/router/backups/download/${encodeURIComponent(filename)}`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Lỗi tải file' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Proxmox VE Hypervisor Performance & Guests
  proxmoxSummary: () => request('/proxmox/summary'),
  proxmoxNodeAction: (command) => request('/proxmox/node/action', { method: 'POST', body: { command } }),
  proxmoxNextId: () => request('/proxmox/nextid'),
  proxmoxTemplates: () => request('/proxmox/templates'),
  proxmoxTasks: (limit = 50) => request(`/proxmox/tasks?limit=${encodeURIComponent(limit)}`),
  proxmoxGuestAction: (type, vmid, action) =>
    request(`/proxmox/guests/${encodeURIComponent(type)}/${encodeURIComponent(vmid)}/action`, {
      method: 'POST',
      body: { action },
    }),

  // Proxmox VMs (QEMU / KVM) Management
  proxmoxVms: () => request('/proxmox/vms'),
  proxmoxVmConfig: (vmid) => request(`/proxmox/vms/${encodeURIComponent(vmid)}/config`),
  createProxmoxVm: (payload) => request('/proxmox/vms', { method: 'POST', body: payload }),
  updateProxmoxVm: (vmid, payload) =>
    request(`/proxmox/vms/${encodeURIComponent(vmid)}`, { method: 'PUT', body: payload }),
  deleteProxmoxVm: (vmid, purge = 1) =>
    request(`/proxmox/vms/${encodeURIComponent(vmid)}?purge=${purge ? 1 : 0}`, { method: 'DELETE' }),

  // Proxmox LXC (Containers) Management
  proxmoxLxcs: () => request('/proxmox/lxcs'),
  proxmoxLxcConfig: (vmid) => request(`/proxmox/lxcs/${encodeURIComponent(vmid)}/config`),
  createProxmoxLxc: (payload) => request('/proxmox/lxcs', { method: 'POST', body: payload }),
  updateProxmoxLxc: (vmid, payload) =>
    request(`/proxmox/lxcs/${encodeURIComponent(vmid)}`, { method: 'PUT', body: payload }),
  deleteProxmoxLxc: (vmid, purge = 1) =>
    request(`/proxmox/lxcs/${encodeURIComponent(vmid)}?purge=${purge ? 1 : 0}`, { method: 'DELETE' }),

  // Proxmox Mode & Config
  proxmoxConfig: () => request('/proxmox/config'),
  setProxmoxMode: (mode) => request('/proxmox/mode', { method: 'POST', body: { mode } }),

  // Home Assistant OS (HassOS) Performance, Add-ons & Core
  hassSummary: () => request('/hass/summary'),
  hassConfig: () => request('/hass/config'),
  setHassMode: (mode) => request('/hass/mode', { method: 'POST', body: { mode } }),
  hassAddonAction: (slug, action) =>
    request(`/hass/addons/${encodeURIComponent(slug)}/action`, {
      method: 'POST',
      body: { action },
    }),
  hassCoreAction: (action) =>
    request('/hass/core/action', {
      method: 'POST',
      body: { action },
    }),

  // Sổ Quản lý IP (IPAM)
  getIpam: () => request('/ipam'),
  createIpam: (payload) => request('/ipam', { method: 'POST', body: payload }),
  updateIpam: (id, payload) =>
    request(`/ipam/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  deleteIpam: (id) =>
    request(`/ipam/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  resetIpamDefault: () =>
    request('/ipam/reset-default', { method: 'POST' }),
};