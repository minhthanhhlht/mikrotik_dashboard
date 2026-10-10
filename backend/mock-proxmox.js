
// Danh sách Task Logs giả lập
const mockTasksList = [
  {
    upid: 'UPID:mtdd:0000A411:000AC488:6ABD4332:vzstart:100:root@pam!token-dashboard:',
    node: 'mtdd',
    pid: 42001,
    type: 'vzstart',
    id: '100',
    user: 'root@pam!token-dashboard',
    starttime: Math.floor(Date.now() / 1000) - 120,
    endtime: Math.floor(Date.now() / 1000) - 118,
    status: 'OK',
  },
  {
    upid: 'UPID:mtdd:0000A3CC:000AC2F0:6ABD432E:vzshutdown:100:root@pam!token-dashboard:',
    node: 'mtdd',
    pid: 41932,
    type: 'vzshutdown',
    id: '100',
    user: 'root@pam!token-dashboard',
    starttime: Math.floor(Date.now() / 1000) - 180,
    endtime: Math.floor(Date.now() / 1000) - 175,
    status: 'OK',
  },
  {
    upid: 'UPID:mtdd:00008F21:0009B112:6ABD3F10:vzcreate:100:root@pam!token-dashboard:',
    node: 'mtdd',
    pid: 36641,
    type: 'vzcreate',
    id: '100',
    user: 'root@pam!token-dashboard',
    starttime: Math.floor(Date.now() / 1000) - 1800,
    endtime: Math.floor(Date.now() / 1000) - 1765,
    status: 'OK',
  },
  {
    upid: 'UPID:mtdd:00007E12:0008A201:6ABD3E01:download:0:root@pam!token-dashboard:',
    node: 'mtdd',
    pid: 32274,
    type: 'download',
    id: '0',
    user: 'root@pam!token-dashboard',
    starttime: Math.floor(Date.now() / 1000) - 2400,
    endtime: Math.floor(Date.now() / 1000) - 2310,
    status: 'OK',
  },
  {
    upid: 'UPID:mtdd:00005C29:00067812:6ABD3B55:qmstart:101:root@pam!token-dashboard:',
    node: 'mtdd',
    pid: 23593,
    type: 'qmstart',
    id: '101',
    user: 'root@pam!token-dashboard',
    starttime: Math.floor(Date.now() / 1000) - 3600,
    endtime: Math.floor(Date.now() / 1000) - 3595,
    status: 'OK',
  },
];
/**
 * Mock Proxmox VE 8.x Hypervisor Engine
 * Mô phỏng chân thực các chỉ số tài nguyên, máy ảo KVM, container LXC, ZFS storage và Linux Network Bridges.
 */

// Trạng thái khởi tạo của Node ảo hóa
const nodeSpec = {
  node: 'pve-master',
  cluster: 'Proxmox-Cluster-01',
  pveVersion: 'pve-manager/8.2-4 (running kernel: 6.8.4-2-pve)',
  cpuModel: 'Intel(R) Xeon(R) E-2288G CPU @ 3.70GHz',
  sockets: 1,
  cores: 8,
  threads: 16,
  totalMemoryBytes: 64 * 1024 * 1024 * 1024, // 64 GB
  totalSwapBytes: 16 * 1024 * 1024 * 1024,    // 16 GB
  totalRootFsBytes: 120 * 1024 * 1024 * 1024, // 120 GB
  uptimeSeconds: 1584200,                     // ~18.3 ngày
  bootTime: Date.now() - 1584200 * 1000,
};

// Danh sách Máy ảo (KVM/QEMU)
let vms = [
  {
    vmid: 100,
    name: 'MikroTik-CHR-Hotspot',
    type: 'qemu',
    os: 'RouterOS 7.16',
    status: 'running',
    cpus: 2,
    cpuUsage: 0.12,
    maxmem: 1024 * 1024 * 1024, // 1 GB
    mem: 384 * 1024 * 1024,      // 384 MB
    disk: 512 * 1024 * 1024,     // 512 MB
    maxdisk: 2 * 1024 * 1024 * 1024, // 2 GB
    netin: 45200000,             // 45.2 Mbps
    netout: 12800000,            // 12.8 Mbps
    diskread: 120000,
    diskwrite: 450000,
    uptime: 1584000,
    description: 'Chính - RouterOS Cloud Hosted Router phát WiFi Hotspot & Định tuyến VLAN',
    ip: '192.168.20.1',
    tags: ['mikrotik', 'gateway', 'routeros'],
  },
  {
    vmid: 101,
    name: 'Ubuntu-Docker-Services',
    type: 'qemu',
    os: 'Ubuntu 24.04 LTS',
    status: 'running',
    cpus: 4,
    cpuUsage: 0.28,
    maxmem: 8 * 1024 * 1024 * 1024,  // 8 GB
    mem: 4.6 * 1024 * 1024 * 1024,   // 4.6 GB
    disk: 42 * 1024 * 1024 * 1024,   // 42 GB
    maxdisk: 100 * 1024 * 1024 * 1024, // 100 GB
    netin: 18500000,
    netout: 24300000,
    diskread: 840000,
    diskwrite: 1250000,
    uptime: 984000,
    description: 'Docker Swarm Node chạy Portainer, Nginx Proxy Manager, Grafana',
    ip: '192.168.20.25',
    tags: ['docker', 'linux', 'production'],
  },
  {
    vmid: 102,
    name: 'WinServer-2022-AD',
    type: 'qemu',
    os: 'Windows Server 2022',
    status: 'running',
    cpus: 4,
    cpuUsage: 0.18,
    maxmem: 16 * 1024 * 1024 * 1024, // 16 GB
    mem: 9.8 * 1024 * 1024 * 1024,   // 9.8 GB
    disk: 68 * 1024 * 1024 * 1024,
    maxdisk: 150 * 1024 * 1024 * 1024,
    netin: 8200000,
    netout: 9400000,
    diskread: 320000,
    diskwrite: 890000,
    uptime: 620000,
    description: 'Active Directory Domain Controller & File Server cơ quan',
    ip: '192.168.20.15',
    tags: ['windows', 'activedirectory'],
  },
  {
    vmid: 103,
    name: 'pfSense-Firewall-Backup',
    type: 'qemu',
    os: 'FreeBSD / pfSense CE 2.7',
    status: 'stopped',
    cpus: 2,
    cpuUsage: 0,
    maxmem: 2 * 1024 * 1024 * 1024,
    mem: 0,
    disk: 0,
    maxdisk: 20 * 1024 * 1024 * 1024,
    netin: 0,
    netout: 0,
    diskread: 0,
    diskwrite: 0,
    uptime: 0,
    description: 'Máy ảo tường lửa dự phòng khi bảo trì MikroTik',
    ip: '192.168.20.254',
    tags: ['pfsense', 'standby'],
  },
];

// Danh sách Containers (LXC)
let lxcs = [
  {
    vmid: 200,
    name: 'NodeJS-Backend-Proxy',
    type: 'lxc',
    os: 'Alpine Linux 3.20',
    status: 'running',
    cpus: 2,
    cpuUsage: 0.08,
    maxmem: 2 * 1024 * 1024 * 1024,  // 2 GB
    mem: 412 * 1024 * 1024,          // 412 MB
    disk: 2.8 * 1024 * 1024 * 1024,  // 2.8 GB
    maxdisk: 15 * 1024 * 1024 * 1024,// 15 GB
    netin: 12400000,
    netout: 14200000,
    diskread: 80000,
    diskwrite: 190000,
    uptime: 1250000,
    description: 'Dịch vụ Express Proxy và giao diện Web Quản trị Hotspot',
    ip: '192.168.20.20',
    tags: ['web', 'proxy', 'alpine'],
  },
  {
    vmid: 201,
    name: 'Pihole-AdGuard-DNS',
    type: 'lxc',
    os: 'Debian 12 Bookworm',
    status: 'running',
    cpus: 1,
    cpuUsage: 0.04,
    maxmem: 512 * 1024 * 1024,       // 512 MB
    mem: 186 * 1024 * 1024,          // 186 MB
    disk: 1.6 * 1024 * 1024 * 1024,
    maxdisk: 8 * 1024 * 1024 * 1024,
    netin: 3200000,
    netout: 3400000,
    diskread: 15000,
    diskwrite: 45000,
    uptime: 1584000,
    description: 'Chặn quảng cáo, mã độc và phân giải DNS cục bộ tốc độ cao',
    ip: '192.168.20.2',
    tags: ['dns', 'pihole', 'security'],
  },
  {
    vmid: 202,
    name: 'PostgreSQL-16-Cluster',
    type: 'lxc',
    os: 'Debian 12 Bookworm',
    status: 'running',
    cpus: 2,
    cpuUsage: 0.15,
    maxmem: 4 * 1024 * 1024 * 1024,  // 4 GB
    mem: 2.1 * 1024 * 1024 * 1024,   // 2.1 GB
    disk: 8.5 * 1024 * 1024 * 1024,
    maxdisk: 50 * 1024 * 1024 * 1024,
    netin: 5800000,
    netout: 6200000,
    diskread: 420000,
    diskwrite: 860000,
    uptime: 890000,
    description: 'Cơ sở dữ liệu lưu trữ nhật ký truy cập Hotspot & Billing',
    ip: '192.168.20.30',
    tags: ['database', 'postgres'],
  },
];

// Storage Pools (ZFS, LVM, NFS)
const storagePools = [
  {
    storage: 'local-zfs',
    type: 'zfspool',
    content: ['images', 'rootdir'],
    total: 2000 * 1024 * 1024 * 1024, // 2 TB NVMe
    used: 785 * 1024 * 1024 * 1024,   // 785 GB (39.25%)
    avail: 1215 * 1024 * 1024 * 1024,
    shared: 0,
    active: 1,
    enabled: 1,
    health: 'ONLINE',
    description: 'ZFS Pool trên ổ cứng Samsung 990 Pro NVMe SSD (RAID1 mirror)',
  },
  {
    storage: 'local',
    type: 'dir',
    content: ['iso', 'vztmpl', 'backup'],
    total: 120 * 1024 * 1024 * 1024,  // 120 GB
    used: 34 * 1024 * 1024 * 1024,    // 34 GB (28.3%)
    avail: 86 * 1024 * 1024 * 1024,
    shared: 0,
    active: 1,
    enabled: 1,
    health: 'OK',
    description: 'Thư mục hệ điều hành Rootfs chứa file ISO cài đặt và template LXC',
  },
  {
    storage: 'backup-pbs',
    type: 'pbs',
    content: ['backup'],
    total: 4000 * 1024 * 1024 * 1024, // 4 TB
    used: 1820 * 1024 * 1024 * 1024,  // 1.82 TB (45.5%)
    avail: 2180 * 1024 * 1024 * 1024,
    shared: 1,
    active: 1,
    enabled: 1,
    health: 'ONLINE',
    description: 'Proxmox Backup Server lưu trữ bản sao lưu deduplication nén ZSTD',
  },
];

// Network Interfaces & Bridges
const networkInterfaces = [
  {
    iface: 'vmbr0',
    type: 'bridge',
    active: 1,
    autostart: 1,
    cidr: '192.168.20.10/24',
    gateway: '192.168.20.1',
    bridge_ports: 'eno1',
    comment: 'Cổng Quản trị PVE & WAN Uplink (Card vật lý Intel I219-LM)',
    speed: '1000 Mbps Full Duplex',
  },
  {
    iface: 'vmbr1',
    type: 'bridge',
    active: 1,
    autostart: 1,
    cidr: '10.0.0.1/24',
    bridge_ports: 'eno2',
    bridge_vlan_aware: 1,
    comment: 'Cổng Trunking VLAN nội bộ & Kết nối Hotspot MikroTik CHR',
    speed: '10000 Mbps (10GbE SFP+)',
  },
  {
    iface: 'eno1',
    type: 'eth',
    active: 1,
    autostart: 1,
    comment: 'Card mạng vật lý 1GbE onboard',
    speed: '1000 Mbps',
  },
  {
    iface: 'eno2',
    type: 'eth',
    active: 1,
    autostart: 1,
    comment: 'Card mạng quang Intel X520 10GbE Dual Port',
    speed: '10000 Mbps',
  },
];

/**
 * Sinh số ngẫu nhiên dao động tự nhiên quanh giá trị gốc
 */
function fluctuate(base, variance, min = 0, max = 1) {
  const delta = (Math.random() * 2 - 1) * variance;
  return Math.min(max, Math.max(min, Number((base + delta).toFixed(4))));
}

/**
 * Lấy snapshot toàn diện hiệu năng Proxmox VE
 */
export function getMockProxmoxSummary() {
  const now = Date.now();
  const uptime = Math.floor((now - nodeSpec.bootTime) / 1000);

  // Dao động tải CPU của Node
  const baseCpu = 0.24; // 24%
  const currentCpu = fluctuate(baseCpu, 0.12, 0.08, 0.75);

  // Dao động RAM Node
  const usedMemBase = 25.4 * 1024 * 1024 * 1024; // ~25.4 GB
  const currentMem = Math.floor(fluctuate(usedMemBase, 1.2 * 1024 * 1024 * 1024, 18 * 1024 * 1024 * 1024, 45 * 1024 * 1024 * 1024));

  // Swap & KSM
  const currentSwap = Math.floor(1.2 * 1024 * 1024 * 1024 + Math.random() * 200 * 1024 * 1024);
  const ksmShared = Math.floor(3.8 * 1024 * 1024 * 1024);

  // Load averages
  const load1 = Number(fluctuate(1.45, 0.4, 0.2, 5.0).toFixed(2));
  const load5 = Number(fluctuate(1.28, 0.2, 0.3, 4.0).toFixed(2));
  const load15 = Number(fluctuate(1.15, 0.1, 0.3, 3.5).toFixed(2));

  // IO Wait
  const ioWait = Number(fluctuate(0.012, 0.008, 0.002, 0.06).toFixed(4));

  // Cập nhật thông số từng VM
  const dynamicVms = vms.map((vm) => {
    if (vm.status !== 'running') return vm;
    const cpu = fluctuate(vm.cpuUsage, 0.06, 0.01, 0.95);
    const netin = Math.floor(fluctuate(vm.netin, vm.netin * 0.25, 500000, 200000000));
    const netout = Math.floor(fluctuate(vm.netout, vm.netout * 0.25, 200000, 100000000));
    const memDelta = Math.floor((Math.random() * 2 - 1) * 30 * 1024 * 1024);
    return {
      ...vm,
      cpuUsage: cpu,
      mem: Math.min(vm.maxmem, Math.max(100 * 1024 * 1024, vm.mem + memDelta)),
      netin,
      netout,
    };
  });

  // Cập nhật thông số từng LXC
  const dynamicLxcs = lxcs.map((ct) => {
    if (ct.status !== 'running') return ct;
    const cpu = fluctuate(ct.cpuUsage, 0.04, 0.01, 0.85);
    const netin = Math.floor(fluctuate(ct.netin, ct.netin * 0.2, 100000, 50000000));
    const netout = Math.floor(fluctuate(ct.netout, ct.netout * 0.2, 100000, 50000000));
    return {
      ...ct,
      cpuUsage: cpu,
      netin,
      netout,
    };
  });

  // Băng thông mạng Proxmox thời gian thực (Bridge & Physical NICs)
  const baseRxBps = Math.round(2400000 + Math.sin(now / 4000) * 1200000 + currentCpu * 3500000);
  const baseTxBps = Math.round(1800000 + Math.cos(now / 4500) * 900000 + currentCpu * 2500000);
  const rxBytesPerSec = Math.max(102400, baseRxBps);
  const txBytesPerSec = Math.max(81920, baseTxBps);
  const rxBitsPerSec = rxBytesPerSec * 8;
  const txBitsPerSec = txBytesPerSec * 8;
  const rxMbps = Number((rxBitsPerSec / 1000000).toFixed(2));
  const txMbps = Number((txBitsPerSec / 1000000).toFixed(2));

  // Cảm biến phần cứng Proxmox (Nhiệt độ, Điện áp, Quạt tản nhiệt)
  const cpuPercentage = Number((currentCpu * 100).toFixed(1));
  const cpuTemp = Number((41.5 + (cpuPercentage / 100) * 26.0 + (Math.sin(now / 15000) * 1.5)).toFixed(1));
  const mbTemp = Number((34.5 + (cpuPercentage / 100) * 10.0 + (Math.cos(now / 20000) * 0.8)).toFixed(1));
  const voltage = Number((12.10 + (Math.sin(now / 30000) * 0.05)).toFixed(2));
  const vcore = Number((1.08 + (cpuPercentage / 100) * 0.20).toFixed(2));
  const fanSpeed = Math.round(1200 + (cpuPercentage / 100) * 1100);
  const sensorStatus = cpuTemp > 80 ? 'CRITICAL' : cpuTemp > 65 ? 'WARM' : 'OPTIMAL';

  const sensors = {
    temperature: cpuTemp,
    cpuTemp,
    motherboardTemp: mbTemp,
    voltage,
    vcore,
    fanSpeed,
    status: sensorStatus,
  };

  return {
    timestamp: now,
    mode: 'mock',
    node: {
      ...nodeSpec,
      uptimeSeconds: uptime,
      cpuUsage: currentCpu,
      cpuPercentage,
      sensors,
      memory: {
        total: nodeSpec.totalMemoryBytes,
        used: currentMem,
        free: nodeSpec.totalMemoryBytes - currentMem,
        percentage: Number(((currentMem / nodeSpec.totalMemoryBytes) * 100).toFixed(1)),
      },
      swap: {
        total: nodeSpec.totalSwapBytes,
        used: currentSwap,
        free: nodeSpec.totalSwapBytes - currentSwap,
        percentage: Number(((currentSwap / nodeSpec.totalSwapBytes) * 100).toFixed(1)),
      },
      ksm: {
        shared: ksmShared,
      },
      loadAverage: [load1, load5, load15],
      ioWait: ioWait,
      ioWaitPercentage: Number((ioWait * 100).toFixed(1)),
      rootFs: {
        total: nodeSpec.totalRootFsBytes,
        used: 34 * 1024 * 1024 * 1024,
        free: 86 * 1024 * 1024 * 1024,
        percentage: 28.3,
      },
    },
    sensors,
    counts: {
      totalGuests,
      totalRunning,
      totalStopped: totalGuests - totalRunning,
      vmsTotal: dynamicVms.length,
      vmsRunning: runningVms,
      lxcsTotal: dynamicLxcs.length,
      lxcsRunning: runningLxcs,
    },
    traffic: {
      rxBytesPerSec,
      txBytesPerSec,
      rxBitsPerSec,
      txBitsPerSec,
      rxMbps,
      txMbps,
    },
    vms: dynamicVms,
    lxcs: dynamicLxcs,
    guests: [...dynamicVms, ...dynamicLxcs].sort((a, b) => a.vmid - b.vmid),
    storage: storagePools,
    network: networkInterfaces,
    tasks: mockTasksList,
  };
}

/**
 * Xử lý tác vụ bật/tắt/khởi động lại VM hoặc LXC
 */
export function executeMockProxmoxAction(type, vmid, action) {
  const targetArray = type === 'lxc' ? lxcs : vms;
  const target = targetArray.find((item) => item.vmid === Number(vmid));
  if (!target) {
    throw new Error(`Không tìm thấy ${type.toUpperCase()} ID ${vmid} trên Proxmox`);
  }

  if (action === 'start') {
    target.status = 'running';
    target.uptime = 10;
  } else if (action === 'stop' || action === 'shutdown') {
    target.status = 'stopped';
    target.uptime = 0;
    target.cpuUsage = 0;
    target.mem = 0;
    target.netin = 0;
    target.netout = 0;
  } else if (action === 'reboot' || action === 'reset') {
    target.status = 'running';
    target.uptime = 5;
  }

  return { success: true, vmid, action, status: target.status };
}

/**
 * Lấy VMID tiếp theo khả dụng
 */
export function getMockNextVmid() {
  const allIds = [...vms.map((v) => v.vmid), ...lxcs.map((c) => c.vmid)];
  const max = allIds.length > 0 ? Math.max(...allIds) : 100;
  return max + 1;
}

/**
 * Lấy danh sách template & ISO mẫu
 */
export function getMockTemplates() {
  return [
    { volid: 'local:iso/ubuntu-24.04-live-server-amd64.iso', format: 'iso', size: 2800000000, content: 'iso', description: 'Ubuntu Server 24.04 LTS' },
    { volid: 'local:iso/debian-12.5.0-amd64-netinst.iso', format: 'iso', size: 650000000, content: 'iso', description: 'Debian 12 Netinst' },
    { volid: 'local:iso/chr-7.16.1.iso', format: 'iso', size: 95000000, content: 'iso', description: 'MikroTik RouterOS 7.16 CHR' },
    { volid: 'local:iso/Windows_Server_2022.iso', format: 'iso', size: 5100000000, content: 'iso', description: 'Windows Server 2022 Standard' },
    { volid: 'local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst', format: 'tar.zst', size: 145000000, content: 'vztmpl', description: 'Ubuntu 24.04 LXC Template' },
    { volid: 'local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst', format: 'tar.zst', size: 125000000, content: 'vztmpl', description: 'Debian 12 LXC Template' },
    { volid: 'local:vztmpl/alpine-3.20-default_20240606_amd64.tar.xz', format: 'tar.xz', size: 3500000, content: 'vztmpl', description: 'Alpine Linux 3.20 Minimal' },
  ];
}

/**
 * Thêm máy ảo VM mới (KVM)
 */
export function createMockVm(payload = {}) {
  const vmid = Number(payload.vmid) || getMockNextVmid();
  const exists = vms.find((v) => v.vmid === vmid) || lxcs.find((c) => c.vmid === vmid);
  if (exists) {
    throw new Error(`ID ${vmid} đã tồn tại trên Proxmox`);
  }

  const memoryMb = Number(payload.memory) || 2048;
  const diskGb = Number(payload.disk) || 32;
  const tags = typeof payload.tags === 'string' ? payload.tags.split(/[,;\s]+/).filter(Boolean) : Array.isArray(payload.tags) ? payload.tags : [];

  const newVm = {
    vmid,
    name: payload.name || `VM-${vmid}`,
    type: 'qemu',
    os: payload.ostype || payload.os || 'Linux Guest',
    status: payload.start ? 'running' : 'stopped',
    cpus: Number(payload.cores || 2),
    cpuUsage: payload.start ? 0.05 : 0,
    maxmem: memoryMb * 1024 * 1024,
    mem: payload.start ? memoryMb * 0.3 * 1024 * 1024 : 0,
    disk: payload.start ? 2 * 1024 * 1024 * 1024 : 0,
    maxdisk: diskGb * 1024 * 1024 * 1024,
    netin: 0,
    netout: 0,
    diskread: 0,
    diskwrite: 0,
    uptime: payload.start ? 1 : 0,
    description: payload.description || '',
    ip: payload.ip || '',
    tags,
  };

  vms.push(newVm);
  return newVm;
}

/**
 * Cập nhật cấu hình VM
 */
export function updateMockVm(vmid, payload = {}) {
  const vm = vms.find((v) => v.vmid === Number(vmid));
  if (!vm) throw new Error(`Không tìm thấy VM ID ${vmid}`);

  if (payload.name) vm.name = payload.name;
  if (payload.cores) vm.cpus = Number(payload.cores);
  if (payload.memory) vm.maxmem = Number(payload.memory) * 1024 * 1024;
  if (payload.description !== undefined) vm.description = payload.description;
  if (payload.ip !== undefined) vm.ip = payload.ip;
  if (payload.tags !== undefined) {
    vm.tags = typeof payload.tags === 'string' ? payload.tags.split(/[,;\s]+/).filter(Boolean) : Array.isArray(payload.tags) ? payload.tags : [];
  }

  return vm;
}

/**
 * Xóa VM
 */
export function deleteMockVm(vmid) {
  const idx = vms.findIndex((v) => v.vmid === Number(vmid));
  if (idx === -1) throw new Error(`Không tìm thấy VM ID ${vmid}`);
  if (vms[idx].status === 'running') {
    throw new Error(`VM ${vmid} đang chạy. Vui lòng dừng VM trước khi xóa.`);
  }
  const deleted = vms.splice(idx, 1)[0];
  return { success: true, deleted };
}

/**
 * Thêm Container LXC mới (CT)
 */
export function createMockLxc(payload = {}) {
  const vmid = Number(payload.vmid) || getMockNextVmid();
  const exists = vms.find((v) => v.vmid === vmid) || lxcs.find((c) => c.vmid === vmid);
  if (exists) {
    throw new Error(`ID ${vmid} đã tồn tại trên Proxmox`);
  }

  const memoryMb = Number(payload.memory) || 1024;
  const diskGb = Number(payload.disk) || 8;
  const tags = typeof payload.tags === 'string' ? payload.tags.split(/[,;\s]+/).filter(Boolean) : Array.isArray(payload.tags) ? payload.tags : [];

  const newLxc = {
    vmid,
    name: payload.hostname || payload.name || `CT-${vmid}`,
    type: 'lxc',
    os: payload.ostemplate || payload.os || 'LXC Container',
    status: payload.start ? 'running' : 'stopped',
    cpus: Number(payload.cores || 1),
    cpuUsage: payload.start ? 0.03 : 0,
    maxmem: memoryMb * 1024 * 1024,
    mem: payload.start ? memoryMb * 0.2 * 1024 * 1024 : 0,
    disk: payload.start ? 1 * 1024 * 1024 * 1024 : 0,
    maxdisk: diskGb * 1024 * 1024 * 1024,
    netin: 0,
    netout: 0,
    diskread: 0,
    diskwrite: 0,
    uptime: payload.start ? 1 : 0,
    description: payload.description || '',
    ip: payload.ip || '',
    tags,
  };

  lxcs.push(newLxc);
  return newLxc;
}

/**
 * Cập nhật cấu hình LXC
 */
export function updateMockLxc(vmid, payload = {}) {
  const lxc = lxcs.find((c) => c.vmid === Number(vmid));
  if (!lxc) throw new Error(`Không tìm thấy LXC ID ${vmid}`);

  if (payload.hostname || payload.name) lxc.name = payload.hostname || payload.name;
  if (payload.cores) lxc.cpus = Number(payload.cores);
  if (payload.memory) lxc.maxmem = Number(payload.memory) * 1024 * 1024;
  if (payload.description !== undefined) lxc.description = payload.description;
  if (payload.ip !== undefined) lxc.ip = payload.ip;
  if (payload.tags !== undefined) {
    lxc.tags = typeof payload.tags === 'string' ? payload.tags.split(/[,;\s]+/).filter(Boolean) : Array.isArray(payload.tags) ? payload.tags : [];
  }

  return lxc;
}

/**
 * Xóa LXC
 */
export function deleteMockLxc(vmid) {
  const idx = lxcs.findIndex((c) => c.vmid === Number(vmid));
  if (idx === -1) throw new Error(`Không tìm thấy LXC ID ${vmid}`);
  if (lxcs[idx].status === 'running') {
    throw new Error(`LXC ${vmid} đang chạy. Vui lòng dừng LXC trước khi xóa.`);
  }
  const deleted = lxcs.splice(idx, 1)[0];
  return { success: true, deleted };
}



/**
 * Lấy danh sách Task Logs giả lập
 */
export function getMockProxmoxTasks(limit = 50) {
  return mockTasksList.slice(0, limit);
}

/**
 * Xử lý tác vụ tắt/khởi động lại máy chủ vật lý Proxmox Node giả lập
 */
export function executeMockProxmoxNodeAction(command) {
  const cleanCommand = command === 'reboot' ? 'reboot' : 'shutdown';
  return {
    success: true,
    node: 'mtdd',
    command: cleanCommand,
    mode: 'mock',
    result: `UPID:mtdd:0000B100:000B0000:6ABD4500:srv${cleanCommand}::root@pam!token-dashboard:`,
  };
}
