/**
 * Mock Home Assistant OS (HassOS) Engine
 * Mô phỏng chân thực các chỉ số tài nguyên, Supervisor Add-ons, Core Entities và Host System.
 */

const hostSpec = {
  hostname: 'homeassistant',
  operatingSystem: 'Home Assistant OS 12.4 (HassOS)',
  supervisorVersion: 'supervisor-2026.04.1',
  coreVersion: 'core-2026.4.2',
  pythonVersion: '3.12.3',
  architecture: 'aarch64',
  board: 'generic-x86-64',
  channel: 'stable',
  ipAddress: '192.168.20.10',
  port: 8123,
  cpuModel: 'Intel(R) Celeron(R) N5105 @ 2.00GHz (4 Cores)',
  cpuCores: 4,
  totalMemoryBytes: 8 * 1024 * 1024 * 1024,   // 8 GB
  totalDiskBytes: 128 * 1024 * 1024 * 1024,  // 128 GB NVMe
  bootTime: Date.now() - 845200 * 1000,      // ~9.7 ngày
  supervisorStatus: 'healthy',
  supported: true,
  autoUpdate: true,
};

let addons = [
  {
    slug: 'core_mosquitto',
    name: 'Mosquitto broker',
    version: '6.4.1',
    description: 'MQTT broker chuẩn cho các thiết bị IoT, Tasmota, Shelly và Zigbee2MQTT',
    state: 'started',
    boot: 'auto',
    auto_update: true,
    cpuUsage: 0.8,
    memoryBytes: 45 * 1024 * 1024, // 45 MB
    ports: { '1883/tcp': 1883, '8883/tcp': 8883 },
    icon: 'mqtt',
    category: 'Core IoT',
  },
  {
    slug: 'zigbee2mqtt',
    name: 'Zigbee2MQTT',
    version: '1.38.0',
    description: 'Cầu nối Zigbee 3.0 không dây điều khiển cảm biến, công tắc Aqara/Tuya/Sonoff',
    state: 'started',
    boot: 'auto',
    auto_update: false,
    cpuUsage: 2.4,
    memoryBytes: 142 * 1024 * 1024, // 142 MB
    ports: { '8099/tcp': 8099 },
    icon: 'zigbee',
    category: 'Home Automation',
  },
  {
    slug: 'core_nodered',
    name: 'Node-RED',
    version: '18.0.5',
    description: 'Flow-based visual programming cho tự động hóa nhà thông minh phức tạp',
    state: 'started',
    boot: 'auto',
    auto_update: true,
    cpuUsage: 3.1,
    memoryBytes: 215 * 1024 * 1024, // 215 MB
    ports: { '1880/tcp': 1880 },
    icon: 'nodered',
    category: 'Automation',
  },
  {
    slug: 'tailscale',
    name: 'Tailscale VPN',
    version: '0.9.2',
    description: 'Mạng riêng ảo Mesh VPN kết nối an toàn từ xa không cần mở port router',
    state: 'started',
    boot: 'auto',
    auto_update: true,
    cpuUsage: 0.5,
    memoryBytes: 68 * 1024 * 1024, // 68 MB
    ports: {},
    icon: 'vpn',
    category: 'Network & Security',
  },
  {
    slug: 'esphome',
    name: 'ESPHome Dashboard',
    version: '2026.4.0',
    description: 'Hệ thống nạp firmware và quản lý thiết bị vi điều khiển ESP8266/ESP32',
    state: 'started',
    boot: 'auto',
    auto_update: false,
    cpuUsage: 1.2,
    memoryBytes: 110 * 1024 * 1024, // 110 MB
    ports: { '6052/tcp': 6052 },
    icon: 'chip',
    category: 'Firmware & Hardware',
  },
  {
    slug: 'cloudflared',
    name: 'Cloudflare Tunnel',
    version: '5.1.7',
    description: 'Đường hầm bảo mật truy cập Home Assistant từ Internet với tên miền riêng',
    state: 'started',
    boot: 'auto',
    auto_update: true,
    cpuUsage: 1.0,
    memoryBytes: 52 * 1024 * 1024, // 52 MB
    ports: {},
    icon: 'cloud',
    category: 'Network & Security',
  },
  {
    slug: 'core_samba',
    name: 'Samba share',
    version: '12.3.1',
    description: 'Chia sẻ thư mục cấu hình config/ và backup qua giao thức Windows SMB',
    state: 'started',
    boot: 'auto',
    auto_update: true,
    cpuUsage: 0.3,
    memoryBytes: 38 * 1024 * 1024, // 38 MB
    ports: { '445/tcp': 445 },
    icon: 'folder',
    category: 'Storage & Backup',
  },
  {
    slug: 'core_configurator',
    name: 'File Editor',
    version: '5.8.0',
    description: 'Trình chỉnh sửa tệp cấu hình YAML trực tiếp trên giao diện web',
    state: 'stopped',
    boot: 'manual',
    auto_update: false,
    cpuUsage: 0,
    memoryBytes: 0,
    ports: { '8097/tcp': 8097 },
    icon: 'edit',
    category: 'Tools',
  },
  {
    slug: 'influxdb',
    name: 'InfluxDB 2.x',
    version: '5.0.1',
    description: 'Cơ sở dữ liệu chuỗi thời gian (Time-series DB) lưu trữ lịch sử cảm biến lâu dài',
    state: 'started',
    boot: 'auto',
    auto_update: false,
    cpuUsage: 4.5,
    memoryBytes: 380 * 1024 * 1024, // 380 MB
    ports: { '8086/tcp': 8086 },
    icon: 'database',
    category: 'Analytics',
  },
];

// Trạng thái biến thiên ngẫu nhiên theo thời gian
let currentCpuPercent = 14.2;
let currentMemUsedBytes = 3.42 * 1024 * 1024 * 1024; // 3.42 GB
let currentDiskUsedBytes = 28.6 * 1024 * 1024 * 1024; // 28.6 GB
let currentCpuTemp = 42.5; // °C
let currentRxKbps = 380;
let currentTxKbps = 620;

function updateFluctuations() {
  // Biến thiên CPU 8% - 35%
  const deltaCpu = (Math.random() - 0.48) * 4;
  currentCpuPercent = Math.max(6.0, Math.min(45.0, currentCpuPercent + deltaCpu));

  // Biến thiên Nhiệt độ 39°C - 52°C
  const deltaTemp = (Math.random() - 0.5) * 0.8;
  currentCpuTemp = Math.max(38.0, Math.min(54.0, currentCpuTemp + deltaTemp));

  // Biến thiên RAM
  const deltaMem = (Math.random() - 0.5) * 25 * 1024 * 1024;
  currentMemUsedBytes = Math.max(
    2.5 * 1024 * 1024 * 1024,
    Math.min(6.5 * 1024 * 1024 * 1024, currentMemUsedBytes + deltaMem)
  );

  // Biến thiên mạng (Kbps)
  currentRxKbps = Math.max(80, Math.floor(currentRxKbps + (Math.random() - 0.5) * 150));
  currentTxKbps = Math.max(120, Math.floor(currentTxKbps + (Math.random() - 0.5) * 220));

  // Cập nhật ngẫu nhiên CPU của các Add-on đang chạy
  addons = addons.map((ad) => {
    if (ad.state !== 'started') return ad;
    const delta = (Math.random() - 0.5) * 0.4;
    const newCpu = Math.max(0.1, Number((ad.cpuUsage + delta).toFixed(1)));
    return { ...ad, cpuUsage: newCpu };
  });
}

export function getMockHassSummary() {
  updateFluctuations();

  const uptimeSeconds = Math.floor((Date.now() - hostSpec.bootTime) / 1000);
  const runningAddonsCount = addons.filter((a) => a.state === 'started').length;
  const stoppedAddonsCount = addons.filter((a) => a.state === 'stopped').length;

  return {
    mode: 'mock',
    status: 'connected',
    timestamp: new Date().toISOString(),
    host: {
      hostname: hostSpec.hostname,
      operatingSystem: hostSpec.operatingSystem,
      supervisorVersion: hostSpec.supervisorVersion,
      coreVersion: hostSpec.coreVersion,
      pythonVersion: hostSpec.pythonVersion,
      architecture: hostSpec.architecture,
      board: hostSpec.board,
      channel: hostSpec.channel,
      ipAddress: hostSpec.ipAddress,
      port: hostSpec.port,
      cpuModel: hostSpec.cpuModel,
      cpuCores: hostSpec.cpuCores,
      uptimeSeconds,
      bootTime: hostSpec.bootTime,
      supervisorStatus: hostSpec.supervisorStatus,
      supported: hostSpec.supported,
      autoUpdate: hostSpec.autoUpdate,
    },
    telemetry: {
      cpu: {
        usagePercent: Number(currentCpuPercent.toFixed(1)),
        cores: hostSpec.cpuCores,
        temperatureC: Number(currentCpuTemp.toFixed(1)),
      },
      memory: {
        totalBytes: hostSpec.totalMemoryBytes,
        usedBytes: currentMemUsedBytes,
        freeBytes: hostSpec.totalMemoryBytes - currentMemUsedBytes,
        percentage: Number(((currentMemUsedBytes / hostSpec.totalMemoryBytes) * 100).toFixed(1)),
      },
      disk: {
        totalBytes: hostSpec.totalDiskBytes,
        usedBytes: currentDiskUsedBytes,
        freeBytes: hostSpec.totalDiskBytes - currentDiskUsedBytes,
        percentage: Number(((currentDiskUsedBytes / hostSpec.totalDiskBytes) * 100).toFixed(1)),
      },
      network: {
        rxKbps: currentRxKbps,
        txKbps: currentTxKbps,
        rxMbps: Number((currentRxKbps / 1024).toFixed(2)),
        txMbps: Number((currentTxKbps / 1024).toFixed(2)),
      },
    },
    entitiesStats: {
      total: 168,
      active: 162,
      unavailable: 4,
      unknown: 2,
      domains: {
        sensor: 72,
        switch: 32,
        light: 26,
        binary_sensor: 20,
        automation: 12,
        climate: 4,
        camera: 2,
      },
    },
    addons: {
      total: addons.length,
      running: runningAddonsCount,
      stopped: stoppedAddonsCount,
      items: addons,
    },
  };
}

export function executeMockHassAddonAction(slug, action) {
  const addon = addons.find((a) => a.slug === slug);
  if (!addon) {
    throw new Error(`Không tìm thấy Add-on với slug '${slug}'`);
  }

  if (action === 'start') {
    addon.state = 'started';
    addon.cpuUsage = 1.0;
    addon.memoryBytes = 65 * 1024 * 1024;
    return { success: true, message: `Đã khởi động Add-on ${addon.name}`, slug, state: 'started' };
  } else if (action === 'stop') {
    addon.state = 'stopped';
    addon.cpuUsage = 0;
    addon.memoryBytes = 0;
    return { success: true, message: `Đã dừng Add-on ${addon.name}`, slug, state: 'stopped' };
  } else if (action === 'restart') {
    addon.state = 'started';
    addon.cpuUsage = 2.5;
    return { success: true, message: `Đã khởi động lại Add-on ${addon.name}`, slug, state: 'started' };
  } else {
    throw new Error(`Hành động '${action}' không được hỗ trợ cho Add-on.`);
  }
}

export function executeMockHassCoreAction(action) {
  if (action === 'restart_core') {
    return { success: true, message: 'Lệnh khởi động lại Home Assistant Core đã được gửi thành công.' };
  } else if (action === 'restart_supervisor') {
    return { success: true, message: 'Lệnh khởi động lại HassOS Supervisor đã được gửi thành công.' };
  } else if (action === 'reboot_host') {
    hostSpec.bootTime = Date.now();
    return { success: true, message: 'Hệ thống HassOS Host đang tiến hành khởi động lại toàn bộ.' };
  } else if (action === 'reload_automations') {
    return { success: true, message: 'Đã nạp lại toàn bộ Automations & Scripts của Home Assistant.' };
  } else {
    throw new Error(`Hành động '${action}' không hợp lệ.`);
  }
}
