import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { api } from '../api/client.js';
import Modal from '../components/Modal.jsx';

// Dữ liệu Quy hoạch phân vùng (Tab 2)
const PARTITION_DATA = [
  {
    id: 'infra',
    nameVi: 'Hạ Tầng Mạng',
    nameEn: 'Network Infrastructure',
    ipRange: '192.168.20.1 – 192.168.20.19',
    prefix: '.1 – .19',
    totalIp: 19,
    typeVi: 'Cố định (Static)',
    typeEn: 'Static IP',
    typeBadge: 'infra',
    devicesVi: 'Router Chính, Switch Managed, Access Point, Gateway Zigbee/BLE',
    devicesEn: 'Main Router, Managed Switch, Access Points, Zigbee/BLE Gateway',
    notesVi: 'Ưu tiên gán tĩnh trên thiết bị hoặc gán Static Lease theo MAC trên RouterOS để quản lý tập trung.',
    notesEn: 'Assign static directly on device or Static Lease via MAC on RouterOS for centralized control.',
    color: 'var(--accent)',
    barWidth: '7.5%',
    sampleIps: ['192.168.20.1', '192.168.20.2', '192.168.20.3', '192.168.20.4', '192.168.20.5', '192.168.20.6'],
  },
  {
    id: 'server',
    nameVi: 'Máy Chủ & Ảo Hóa',
    nameEn: 'Servers & Virtualization',
    ipRange: '192.168.20.20 – 192.168.20.49',
    prefix: '.20 – .49',
    totalIp: 30,
    typeVi: 'Cố định (Static)',
    typeEn: 'Static IP',
    typeBadge: 'server',
    devicesVi: 'Proxmox VE Host, Home Assistant (HASS), SLZB-06, OLLAMA Server',
    devicesEn: 'Proxmox VE Host, Home Assistant (HASS), SLZB-06, OLLAMA Server',
    notesVi: 'Dải IP dành riêng cho Server / VM / LXC để thiết lập DNS nội bộ và chuyển tiếp cổng (Port Forwarding).',
    notesEn: 'Reserved for Servers / VMs / LXCs for internal DNS resolution and Port Forwarding rules.',
    color: 'var(--green)',
    barWidth: '11.8%',
    sampleIps: ['192.168.20.20', '192.168.20.21', '192.168.20.22', '192.168.20.23'],
  },
  {
    id: 'iot',
    nameVi: 'IoT & Thiết Bị Tĩnh',
    nameEn: 'IoT & Static Devices',
    ipRange: '192.168.20.50 – 192.168.20.149',
    prefix: '.50 – .149',
    totalIp: 100,
    typeVi: 'Cố định (DHCP Lease)',
    typeEn: 'Static DHCP Lease',
    typeBadge: 'iot',
    devicesVi: 'Camera an ninh (RTSP), Cảm biến, Công tắc thông minh, Khóa cửa TTLock, ESPHome',
    devicesEn: 'Security Cameras (RTSP), Sensors, Smart Switches, TTLock Door Locks, ESPHome',
    notesVi: 'Khuyên dùng gán DHCP Static Binding theo MAC trên MikroTik để dễ thay thế linh kiện mà không sửa IP thủ công.',
    notesEn: 'Recommended DHCP Static Binding by MAC on MikroTik for hassle-free hardware replacements.',
    color: 'var(--amber)',
    barWidth: '39.4%',
    sampleIps: ['192.168.20.50', '192.168.20.51', '192.168.20.60', '192.168.20.70', '192.168.20.80', '192.168.20.90'],
  },
  {
    id: 'dhcp',
    nameVi: 'Thiết Bị Khách & Động',
    nameEn: 'Guest & Dynamic DHCP',
    ipRange: '192.168.20.150 – 192.168.20.254',
    prefix: '.150 – .254',
    totalIp: 105,
    typeVi: 'Cấp động (DHCP Pool)',
    typeEn: 'Dynamic DHCP Pool',
    typeBadge: 'dhcp',
    devicesVi: 'Điện thoại, Laptop, TV, Máy tính bảng, Khách vãng lai, Thiết bị cá nhân',
    devicesEn: 'Smartphones, Laptops, Smart TVs, Tablets, Guest Clients, Personal Devices',
    notesVi: 'Router tự động cấp phát qua DHCP Server Pool (Lease time 1d – 3d) có thể kèm giới hạn băng thông.',
    notesEn: 'Automatically assigned by MikroTik DHCP Server Pool (Lease time 1d – 3d) with optional rate limits.',
    color: 'var(--violet)',
    barWidth: '41.3%',
    sampleIps: ['192.168.20.150 - .254'],
  },
];

// Định nghĩa các dải phân vùng cho dropdown
const ZONE_OPTIONS = [
  { key: 'infra', vi: 'Hạ tầng mạng (.1 – .19)', en: 'Network Infrastructure (.1 – .19)' },
  { key: 'server', vi: 'Máy chủ ảo hóa (.20 – .49)', en: 'Virtualization & Servers (.20 – .49)' },
  { key: 'iot', vi: 'IoT & Thiết bị tĩnh (.50 – .149)', en: 'IoT & Static Devices (.50 – .149)' },
  { key: 'dhcp', vi: 'DHCP cấp động (.150 – .254)', en: 'Dynamic DHCP Pool (.150 – .254)' },
];

const INITIAL_FORM_STATE = {
  id: '',
  zoneKey: 'infra',
  ip: '',
  name: '',
  mac: '',
  os: '',
  port: '',
  webUrl: '',
  location: '',
  status: 'Online',
  notesVi: '',
  notesEn: '',
};

export default function IpManagementPage() {
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const toast = useToast();

  // Tabs: 'detail' (Sổ quản lý IP chi tiết) | 'overview' (Tổng quan phân vùng)
  const [activeTab, setActiveTab] = useState('detail');

  // IPAM API Data State
  const [ipLog, setIpLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Tab 1 Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [copiedText, setCopiedText] = useState(null);

  // Pagination (10 items / page)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [formError, setFormError] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Fetch IPAM data from backend API
  const fetchIpam = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await api.getIpam();
      if (res && res.data) {
        setIpLog(res.data);
      } else {
        setIpLog([]);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu IPAM:', err);
      setFetchError(err.message || 'Không thể kết nối đến server IPAM');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIpam();
  }, [fetchIpam]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedZone, selectedStatus, pageSize]);

  // Copy helper
  const copyToClipboard = (text, label) => {
    if (!text || text === '—') return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedText(`${label}: ${text}`);
      setTimeout(() => setCopiedText(null), 2500);
      toast.success(isVi ? `Đã sao chép ${label}: ${text}` : `Copied ${label}: ${text}`);
    }).catch(() => {});
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setFormData(INITIAL_FORM_STATE);
    setFormError('');
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setModalMode('edit');
    setFormData({
      id: item.id || '',
      zoneKey: item.zoneKey || 'infra',
      ip: item.ip || '',
      name: item.name || '',
      mac: item.mac && item.mac !== '—' ? item.mac : '',
      os: item.os && item.os !== '—' ? item.os : '',
      port: item.port && item.port !== '—' ? item.port : '',
      webUrl: item.webUrl || '',
      location: item.location && item.location !== '—' ? item.location : '',
      status: item.status || 'Online',
      notesVi: item.notesVi || '',
      notesEn: item.notesEn || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  // Submit Form (Create / Edit)
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formData.ip || !formData.ip.trim()) {
      setFormError(isVi ? 'Vui lòng nhập địa chỉ IP' : 'Please enter an IP address');
      return;
    }
    if (!formData.name || !formData.name.trim()) {
      setFormError(isVi ? 'Vui lòng nhập tên thiết bị / máy chủ' : 'Please enter a device or server name');
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      // Auto resolve zone names
      const matchedZone = ZONE_OPTIONS.find((z) => z.key === formData.zoneKey);
      const zoneVi = matchedZone ? matchedZone.vi.split(' (')[0] : 'Hạ tầng mạng';
      const zoneEn = matchedZone ? matchedZone.en.split(' (')[0] : 'Network Infrastructure';

      const payload = {
        zoneKey: formData.zoneKey,
        zoneVi,
        zoneEn,
        ip: formData.ip.trim(),
        name: formData.name.trim(),
        mac: formData.mac.trim() || '—',
        os: formData.os.trim() || '—',
        port: formData.port.trim() || '—',
        webUrl: formData.webUrl.trim() || '',
        location: formData.location.trim() || '—',
        status: formData.status,
        notesVi: formData.notesVi.trim(),
        notesEn: formData.notesEn.trim(),
      };

      if (modalMode === 'create') {
        await api.createIpam(payload);
        toast.success(isVi ? 'Thêm mới địa chỉ IP thành công!' : 'Added new IP record successfully!');
      } else {
        await api.updateIpam(formData.id, payload);
        toast.success(isVi ? 'Cập nhật địa chỉ IP thành công!' : 'Updated IP record successfully!');
      }

      setModalOpen(false);
      await fetchIpam();
    } catch (err) {
      setFormError(err.message || (isVi ? 'Lỗi khi lưu dữ liệu' : 'Error saving record'));
      toast.error(err.message || (isVi ? 'Lỗi khi lưu dữ liệu' : 'Error saving record'));
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setSaving(true);
      await api.deleteIpam(itemToDelete.id);
      toast.success(isVi ? `Đã xóa thiết bị ${itemToDelete.name} (${itemToDelete.ip})` : `Deleted ${itemToDelete.name} (${itemToDelete.ip})`);
      setDeleteModalOpen(false);
      setItemToDelete(null);
      await fetchIpam();
    } catch (err) {
      toast.error(err.message || (isVi ? 'Lỗi khi xóa thiết bị' : 'Error deleting item'));
    } finally {
      setSaving(false);
    }
  };

  // Confirm Reset Default
  const handleConfirmReset = async () => {
    try {
      setSaving(true);
      await api.resetIpamDefault();
      toast.success(isVi ? 'Đã khôi phục sổ tay IP về danh sách gốc mặc định!' : 'Reset IP logbook to default records successfully!');
      setResetModalOpen(false);
      await fetchIpam();
    } catch (err) {
      toast.error(err.message || (isVi ? 'Lỗi khi khôi phục dữ liệu' : 'Error resetting records'));
    } finally {
      setSaving(false);
    }
  };

  // Filtered detailed log
  const filteredLog = useMemo(() => {
    return ipLog.filter((row) => {
      // Zone filter
      if (selectedZone !== 'all' && row.zoneKey !== selectedZone) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'all' && row.status !== selectedStatus) {
        return false;
      }
      // Text search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchIp = (row.ip || '').toLowerCase().includes(q);
        const matchName = (row.name || '').toLowerCase().includes(q);
        const matchMac = (row.mac || '').toLowerCase().includes(q);
        const matchOs = (row.os || '').toLowerCase().includes(q);
        const matchPort = (row.port || '').toLowerCase().includes(q);
        const matchLoc = (row.location || '').toLowerCase().includes(q);
        const matchNotes = (isVi ? (row.notesVi || '') : (row.notesEn || '')).toLowerCase().includes(q);
        const matchZone = (isVi ? (row.zoneVi || '') : (row.zoneEn || '')).toLowerCase().includes(q);
        return matchIp || matchName || matchMac || matchOs || matchPort || matchLoc || matchNotes || matchZone;
      }
      return true;
    });
  }, [ipLog, searchQuery, selectedZone, selectedStatus, isVi]);

  // Paginated Log
  const totalPages = Math.max(1, Math.ceil(filteredLog.length / pageSize));
  const paginatedLog = useMemo(() => {
    if (pageSize === 0) return filteredLog; // all
    const start = (page - 1) * pageSize;
    return filteredLog.slice(start, start + pageSize);
  }, [filteredLog, page, pageSize]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      isVi ? 'Dải Phân Vùng' : 'Zone',
      isVi ? 'Địa chỉ IP' : 'IP Address',
      isVi ? 'Tên Thiết Bị / Máy Chủ' : 'Device / Server Name',
      isVi ? 'Địa chỉ MAC' : 'MAC Address',
      isVi ? 'Hệ Điều Hành / Nền Tảng' : 'OS / Platform',
      isVi ? 'Port / Dịch Vụ Chính' : 'Port / Services',
      isVi ? 'Vị Trí Lắp Đặt' : 'Installation Location',
      isVi ? 'Trạng Thái' : 'Status',
      isVi ? 'Ghi Chú Chi Tiết' : 'Notes',
    ];

    const rows = filteredLog.map((r) => [
      `"${isVi ? r.zoneVi : r.zoneEn}"`,
      `"${r.ip}"`,
      `"${r.name}"`,
      `"${r.mac}"`,
      `"${r.os}"`,
      `"${r.port}"`,
      `"${r.location}"`,
      `"${r.status}"`,
      `"${(isVi ? r.notesVi : r.notesEn).replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `So_Quan_Ly_Dia_Chi_IP_192.168.20.0_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(isVi ? 'Đã xuất file CSV thành công!' : 'Exported CSV successfully!');
  };

  // Helper render Zone Chip
  const renderZoneState = (zoneKey, zoneLabel) => {
    switch (zoneKey) {
      case 'infra':
        return <span className="sk-state sk-state--accent">{zoneLabel}</span>;
      case 'server':
        return <span className="sk-state sk-state--green">{zoneLabel}</span>;
      case 'iot':
        return <span className="sk-state sk-state--amber">{zoneLabel}</span>;
      case 'dhcp':
        return <span className="sk-state sk-state--cyan">{zoneLabel}</span>;
      default:
        return <span className="sk-state">{zoneLabel}</span>;
    }
  };

  // Helper render Status Pill
  const renderStatusPill = (status) => {
    if (status === 'Online') {
      return (
        <span className="sk-pill sk-pill--green">
          <span className="sk-pill__dot" />
          Online
        </span>
      );
    }
    if (status === 'Active Range') {
      return (
        <span className="sk-pill sk-pill--violet">
          <span className="sk-pill__dot" />
          Active Range
        </span>
      );
    }
    return (
      <span className="sk-pill">
        <span className="sk-pill__dot" />
        Available
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header (PageTopbar) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)]">
              {isVi ? 'Quy Hoạch & Quản Lý Địa Chỉ IP' : 'IP Address Management (IPAM)'}
            </h1>
            <span className="sk-tag sk-tag--prod text-xs font-mono">
              192.168.20.0/24
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-dim)]">
            {isVi
              ? 'Sơ đồ phân bổ subnet 192.168.20.0/24 & Sổ theo dõi thiết bị mạng hạ tầng'
              : 'Subnet 192.168.20.0/24 IP Plan & Infrastructure Device Inventory'}
          </p>
        </div>

        {/* Header Action Buttons & Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Control Tabs */}
          <div className="sk-seg">
            <button
              onClick={() => setActiveTab('detail')}
              className={`sk-seg__btn ${activeTab === 'detail' ? 'is-on' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>{isVi ? 'Sổ Quản Lý IP' : 'IP Registry'}</span>
              <span className="sk-seg__count">{ipLog.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`sk-seg__btn ${activeTab === 'overview' ? 'is-on' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>{isVi ? 'Tổng Quan Phân Vùng' : 'Subnet Overview'}</span>
              <span className="sk-seg__count">4</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top KPI Stat Band (.sk-kpiband) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Subnet Info */}
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-[var(--text-dim)] uppercase tracking-wider">
              {isVi ? 'Subnet / Gateway' : 'Subnet / Gateway'}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--accent-bright)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
          </div>
          <div className="mt-2 font-mono text-xl sm:text-2xl font-extrabold text-[var(--text)] tracking-tight">
            192.168.20.0/24
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--text-faint)]">
            Gateway: 192.168.20.1 · Mask: /24
          </div>
        </div>

        {/* Total IPs */}
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-[var(--text-dim)] uppercase tracking-wider">
              {isVi ? 'Tổng IP Khả Dụng' : 'Total Usable IPs'}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
          </div>
          <div className="mt-2 font-mono text-xl sm:text-2xl font-extrabold text-[var(--text)] tracking-tight">
            254 <span className="text-sm font-normal text-[var(--text-dim)]">IPs</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--text-faint)]">
            Dải: 192.168.20.1 – .254
          </div>
        </div>

        {/* Static Pool */}
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-emerald-400 uppercase tracking-wider">
              {isVi ? 'Dải Tĩnh / IoT / Server' : 'Static / Servers'}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-emerald-500/15 text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 font-mono text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-tight">
            149 <span className="text-sm font-normal text-emerald-400/80">IPs</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-400/80">
            .1 – .149 (58.7% Subnet)
          </div>
        </div>

        {/* Dynamic DHCP Pool */}
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-[var(--violet)] uppercase tracking-wider">
              {isVi ? 'DHCP Cấp Động' : 'Dynamic DHCP'}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--violet-bg)] text-[var(--violet)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--violet)] shadow-[0_0_8px_var(--violet)]" />
            </div>
          </div>
          <div className="mt-2 font-mono text-xl sm:text-2xl font-extrabold text-[var(--violet)] tracking-tight">
            105 <span className="text-sm font-normal text-[var(--violet)]/80">IPs</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--violet)]/80">
            .150 – .254 (41.3% Subnet)
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SỔ QUẢN LÝ IP CHI TIẾT                                             */}
      {/* ========================================================================= */}
      {activeTab === 'detail' && (
        <div className="space-y-4">
          {/* Toolbar & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3.5 lg:flex-row lg:items-center lg:justify-between shadow-sm">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-[var(--text-faint)] z-10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isVi ? 'Tìm kiếm IP, MAC, Tên thiết bị, Vị trí, Port…' : 'Search IP, MAC, Name, Location, Port…'}
                className="form-input text-xs sm:text-sm !pl-10 !pr-9 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition z-10"
                  title="Xóa tìm kiếm"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Selects & Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Zone Filter */}
              <div className="relative min-w-[150px]">
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="form-input text-xs font-medium h-9 pl-3 pr-8 appearance-none bg-[var(--surface-2)]"
                >
                  <option value="all">🏷️ {isVi ? 'Tất cả phân vùng' : 'All Zones'}</option>
                  <option value="infra">🔷 {isVi ? 'Hạ tầng mạng (.1–.19)' : 'Infra (.1–.19)'}</option>
                  <option value="server">🟢 {isVi ? 'Máy chủ / PVE (.20–.49)' : 'Servers (.20–.49)'}</option>
                  <option value="iot">🟠 {isVi ? 'IoT & Thiết bị (.50–.149)' : 'IoT (.50–.149)'}</option>
                  <option value="dhcp">🟣 {isVi ? 'DHCP Cấp động (.150–.254)' : 'DHCP (.150–.254)'}</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-faint)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Status Filter */}
              <div className="relative min-w-[140px]">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="form-input text-xs font-medium h-9 pl-3 pr-8 appearance-none bg-[var(--surface-2)]"
                >
                  <option value="all">⚡ {isVi ? 'Tất cả trạng thái' : 'All Status'}</option>
                  <option value="Online">🟢 Online</option>
                  <option value="Available">⚪ Available</option>
                  <option value="Active Range">🟣 Active Range</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-faint)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Add IP Button */}
              <button
                onClick={handleOpenCreate}
                className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md hover:shadow-lg transition"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                <span>{isVi ? 'Thêm IP Mới' : 'Add IP'}</span>
              </button>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCsv}
                disabled={filteredLog.length === 0}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 font-medium shadow-sm hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
                title={isVi ? 'Xuất danh sách sang file CSV' : 'Export log to CSV'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-emerald-400">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="16" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>{isVi ? 'Xuất CSV' : 'Export'}</span>
              </button>

              {/* Reset Default Button */}
              <button
                onClick={() => setResetModalOpen(true)}
                className="btn btn-soft btn-sm flex items-center gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 transition"
                title={isVi ? 'Khôi phục danh sách gốc ban đầu' : 'Reset to default dataset'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>{isVi ? 'Khôi phục' : 'Reset'}</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={fetchIpam}
                disabled={loading}
                className="btn btn-ghost btn-sm flex items-center gap-1 text-[var(--text-dim)] hover:text-[var(--text)]"
                title={isVi ? 'Làm mới dữ liệu từ server' : 'Reload data'}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`h-4 w-4 ${loading ? 'animate-spin text-[var(--accent)]' : ''}`}
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error Message if fetch failed */}
          {fetchError && (
            <div className="rounded-[var(--radius-md)] border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center justify-between">
              <span>{fetchError}</span>
              <button onClick={fetchIpam} className="underline font-bold hover:opacity-80">
                {isVi ? 'Thử lại' : 'Retry'}
              </button>
            </div>
          )}

          {/* Data Table Wrapper (.sk-dtable-wrapper) */}
          <div className="sk-dtable-wrapper">
            <div className="overflow-x-auto">
              <table className="sk-dtable">
                <thead>
                  <tr>
                    <th>{isVi ? 'Dải Phân Vùng' : 'Zone'}</th>
                    <th>{isVi ? 'Địa chỉ IP' : 'IP Address'}</th>
                    <th className="min-w-[190px]">{isVi ? 'Tên Thiết Bị / Máy Chủ' : 'Device / Server Name'}</th>
                    <th>{isVi ? 'Địa chỉ MAC' : 'MAC Address'}</th>
                    <th>{isVi ? 'Hệ Điều Hành' : 'OS / Platform'}</th>
                    <th>{isVi ? 'Port / Dịch Vụ' : 'Port / Services'}</th>
                    <th>{isVi ? 'Vị Trí Lắp Đặt' : 'Location'}</th>
                    <th className="text-center">{isVi ? 'Trạng Thái' : 'Status'}</th>
                    <th className="min-w-[200px]">{isVi ? 'Ghi Chú Chi Tiết' : 'Notes'}</th>
                    <th className="text-right">{isVi ? 'Thao Tác' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && ipLog.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-xs text-[var(--text-faint)]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="h-6 w-6 animate-spin text-[var(--accent)]" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>{isVi ? 'Đang tải danh sách IP từ server...' : 'Loading IPAM inventory...'}</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedLog.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-xs text-[var(--text-faint)]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-[var(--text-faint)]">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <span>{isVi ? 'Không tìm thấy thiết bị nào khớp với bộ lọc tìm kiếm.' : 'No devices found matching your search filter.'}</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLog.map((row) => (
                      <tr
                        key={row.id}
                        className={row.status === 'Available' ? 'opacity-70' : ''}
                      >
                        {/* Zone Column */}
                        <td>
                          {renderZoneState(row.zoneKey, isVi ? row.zoneVi : row.zoneEn)}
                        </td>

                        {/* IP Address Column with Quick Copy & Direct Link */}
                        <td>
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span className="font-bold text-[var(--text)]">{row.ip}</span>
                            <button
                              onClick={() => copyToClipboard(row.ip, 'IP')}
                              className="text-[var(--text-faint)] hover:text-[var(--accent-bright)] p-0.5 rounded transition"
                              title={isVi ? 'Sao chép IP' : 'Copy IP'}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                            {row.webUrl && (
                              <a
                                href={row.webUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--text-faint)] hover:text-emerald-400 p-0.5 rounded transition"
                                title={isVi ? `Mở Web GUI (${row.webUrl})` : `Open Web GUI (${row.webUrl})`}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Device / Server Name */}
                        <td className="font-semibold text-[var(--text)] whitespace-nowrap">
                          {row.name}
                        </td>

                        {/* MAC Address Column with Copy */}
                        <td>
                          {row.mac === '—' || !row.mac ? (
                            <span className="text-[var(--text-faint)] font-mono text-xs">—</span>
                          ) : (
                            <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-dim)]">
                              <span className="font-semibold text-[var(--text)]">{row.mac}</span>
                              <button
                                onClick={() => copyToClipboard(row.mac, 'MAC')}
                                className="text-[var(--text-faint)] hover:text-emerald-400 p-0.5 rounded transition"
                                title={isVi ? 'Sao chép MAC' : 'Copy MAC'}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* OS / Platform */}
                        <td className="text-xs text-[var(--text-dim)] whitespace-nowrap">
                          {row.os === '—' || !row.os ? (
                            <span className="text-[var(--text-faint)]">—</span>
                          ) : (
                            <span>{row.os}</span>
                          )}
                        </td>

                        {/* Port / Service Column */}
                        <td>
                          {row.port === '—' || !row.port ? (
                            <span className="text-[var(--text-faint)] font-mono text-xs">—</span>
                          ) : (
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)]">
                              {row.port}
                            </span>
                          )}
                        </td>

                        {/* Location */}
                        <td className="text-xs text-[var(--text-dim)] whitespace-nowrap">
                          {row.location === '—' || !row.location ? (
                            <span className="text-[var(--text-faint)]">—</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-[var(--text-faint)]">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              <span>{row.location}</span>
                            </div>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="text-center whitespace-nowrap">
                          {renderStatusPill(row.status)}
                        </td>

                        {/* Notes Column */}
                        <td className="text-[var(--text-faint)] text-xs leading-relaxed">
                          {isVi ? (row.notesVi || row.notesEn || '—') : (row.notesEn || row.notesVi || '—')}
                        </td>

                        {/* Actions Column (Edit / Delete) */}
                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(row)}
                              className="btn btn-ghost btn-sm btn-icon text-[var(--text-dim)] hover:text-[var(--accent-bright)]"
                              title={isVi ? 'Chỉnh sửa' : 'Edit'}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleOpenDelete(row)}
                              className="btn btn-ghost btn-sm btn-icon text-[var(--text-dim)] hover:text-rose-400"
                              title={isVi ? 'Xóa' : 'Delete'}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Pagination (10 items / page) */}
            <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 flex flex-col md:flex-row items-center justify-between text-xs text-[var(--text-dim)] gap-3 font-mono">
              {/* Left: Counter & Page Size */}
              <div className="flex items-center gap-3">
                <div>
                  {isVi ? 'Hiển thị: ' : 'Showing: '}
                  <strong className="text-[var(--text)]">
                    {filteredLog.length === 0 ? 0 : (page - 1) * pageSize + 1} – {Math.min(page * pageSize, filteredLog.length)}
                  </strong> / {filteredLog.length} {isVi ? 'thiết bị' : 'devices'}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--text-faint)]">{isVi ? 'Mỗi trang:' : 'Per page:'}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="form-input text-xs !h-7 !py-0 !px-2 bg-[var(--surface)] border-[var(--border)] w-16"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Middle: Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary btn-sm !h-7 !px-2.5"
                    title={isVi ? 'Trang trước' : 'Previous page'}
                  >
                    &larr; {isVi ? 'Trước' : 'Prev'}
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`btn btn-sm !h-7 !min-w-[28px] !px-1.5 ${
                        page === p ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn-secondary btn-sm !h-7 !px-2.5"
                    title={isVi ? 'Trang sau' : 'Next page'}
                  >
                    {isVi ? 'Sau' : 'Next'} &rarr;
                  </button>
                </div>
              )}

              {/* Right: Quick Stats */}
              <div className="flex items-center gap-3">
                <span className="sk-pill sk-pill--green !py-0.5 !px-2">
                  <span className="sk-pill__dot" />
                  {ipLog.filter((r) => r.status === 'Online').length} Online
                </span>
                <span className="sk-pill !py-0.5 !px-2">
                  <span className="sk-pill__dot" />
                  {ipLog.filter((r) => r.status === 'Available').length} Available
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TỔNG QUAN PHÂN VÙNG                                                */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Visual Subnet Bar Allocation Card */}
          <div className="sk-card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[var(--text)]">
                  {isVi ? 'Biểu Đồ Phân Bổ Subnet 192.168.20.0/24' : 'Subnet 192.168.20.0/24 Visual Allocation'}
                </h2>
                <p className="text-xs text-[var(--text-dim)]">
                  {isVi
                    ? 'Tỷ lệ phân vùng 254 địa chỉ IP khả dụng cho toàn bộ hạ tầng gia đình & phòng lab'
                    : 'Proportional distribution of 254 usable IP addresses across all home & lab infra'}
                </p>
              </div>
              <div className="text-xs font-mono font-semibold text-[var(--text-dim)]">
                {isVi ? 'Tổng số IP khả dụng: ' : 'Total Usable IPs: '}
                <strong className="text-[var(--text)]">254 IP</strong> (.1 – .254)
              </div>
            </div>

            {/* Segmented Color Bar */}
            <div className="mt-4 flex h-7 w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]">
              <div
                style={{ width: '7.5%', background: 'var(--accent)' }}
                className="flex items-center justify-center font-mono text-[11px] font-bold text-white transition hover:opacity-90"
                title="Hạ Tầng Mạng (.1 - .19): 19 IPs (7.5%)"
              >
                .1–.19
              </div>
              <div
                style={{ width: '11.8%', background: 'var(--green)' }}
                className="flex items-center justify-center font-mono text-[11px] font-bold text-slate-900 transition hover:opacity-90"
                title="Máy Chủ & Ảo Hóa (.20 - .49): 30 IPs (11.8%)"
              >
                .20–.49
              </div>
              <div
                style={{ width: '39.4%', background: 'var(--amber)' }}
                className="flex items-center justify-center font-mono text-[11px] font-bold text-slate-900 transition hover:opacity-90"
                title="IoT & Thiết Bị Tĩnh (.50 - .149): 100 IPs (39.4%)"
              >
                .50–.149
              </div>
              <div
                style={{ width: '41.3%', background: 'var(--violet)' }}
                className="flex items-center justify-center font-mono text-[11px] font-bold text-white transition hover:opacity-90"
                title="Thiết Bị Khách & Động (.150 - .254): 105 IPs (41.3%)"
              >
                .150–.254
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3.5 flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[var(--accent)]" />
                <span className="text-[var(--text)]">{isVi ? 'Hạ Tầng Mạng (19 IP)' : 'Network Infra (19 IP)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[var(--green)]" />
                <span className="text-[var(--text)]">{isVi ? 'Máy Chủ & Ảo Hóa (30 IP)' : 'Servers / PVE (30 IP)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[var(--amber)]" />
                <span className="text-[var(--text)]">{isVi ? 'IoT & Thiết Bị Tĩnh (100 IP)' : 'IoT & Static (100 IP)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[var(--violet)]" />
                <span className="text-[var(--text)]">{isVi ? 'Thiết Bị Khách & Động (105 IP)' : 'Guest & Dynamic DHCP (105 IP)'}</span>
              </div>
            </div>
          </div>

          {/* Detailed Zone Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PARTITION_DATA.map((zone) => (
              <div
                key={zone.id}
                className="sk-card flex flex-col justify-between hover:border-[var(--border-strong)] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`sk-state ${
                        zone.id === 'infra'
                          ? 'sk-state--accent'
                          : zone.id === 'server'
                          ? 'sk-state--green'
                          : zone.id === 'iot'
                          ? 'sk-state--amber'
                          : 'sk-state--cyan'
                      }`}
                    >
                      {zone.prefix}
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--text)]">
                      {zone.totalIp} IP
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-[var(--text)]">
                    {isVi ? zone.nameVi : zone.nameEn}
                  </h3>

                  <div className="mt-1 font-mono text-xs font-semibold text-[var(--accent-bright)]">
                    {zone.ipRange}
                  </div>

                  <div className="mt-2 text-xs text-[var(--text-dim)]">
                    <strong className="text-[var(--text-faint)]">{isVi ? 'Hình thức: ' : 'Type: '}</strong>
                    {isVi ? zone.typeVi : zone.typeEn}
                  </div>

                  <div className="mt-2 text-xs text-[var(--text-dim)]">
                    <strong className="text-[var(--text-faint)]">{isVi ? 'Thiết bị: ' : 'Devices: '}</strong>
                    {isVi ? zone.devicesVi : zone.devicesEn}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border-soft)] text-[11px] text-[var(--text-faint)] italic">
                  {isVi ? zone.notesVi : zone.notesEn}
                </div>
              </div>
            ))}
          </div>

          {/* Subnet Strategy & Best Practice Card */}
          <div className="sk-card-subtle">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-3)] text-[var(--accent-bright)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold font-mono text-[var(--text)] uppercase tracking-wider">
                  {isVi ? 'Khuyến nghị Cấu Hình MikroTik RouterOS' : 'MikroTik RouterOS Best Practices'}
                </h4>
                <p className="text-xs text-[var(--text-dim)] leading-relaxed">
                  {isVi
                    ? '1. Với dải Hạ tầng (.1 – .19) & Máy chủ (.20 – .49): Gán IP tĩnh trên thiết bị hoặc thêm Static Lease trên MikroTik (/ip dhcp-server lease).'
                    : '1. For Infrastructure (.1 – .19) & Servers (.20 – .49): Assign static IP or create Static Leases in MikroTik (/ip dhcp-server lease).'}
                  <br />
                  {isVi
                    ? '2. Với dải IoT (.50 – .149): Khuyên dùng DHCP Static Binding theo MAC để dễ thay thế linh kiện mà không sửa IP thủ công.'
                    : '2. For IoT (.50 – .149): Use DHCP Reservations bound by MAC address for hassle-free hardware replacements.'}
                  <br />
                  {isVi
                    ? '3. Với dải Cấp động (.150 – .254): Router tự động cấp qua dhcp_pool. Khi cần mở rộng dải tĩnh, chỉ cần chỉnh dải kết thúc DHCP xuống .200.'
                    : '3. For Dynamic (.150 – .254): Automatically served by dhcp_pool. Future static expansions can simply cap DHCP at .200.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT MODAL (Using Standard Modal Component)                      */}
      {/* ========================================================================= */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalMode === 'create'
            ? (isVi ? 'Thêm Địa Chỉ IP Mới' : 'Add New IP Entry')
            : (isVi ? 'Chỉnh Sửa Địa Chỉ IP' : 'Edit IP Entry')
        }
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              {isVi ? 'Hủy Bỏ' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveForm}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              {saving && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              <span>
                {modalMode === 'create'
                  ? (isVi ? 'Thêm Thiết Bị' : 'Save New Entry')
                  : (isVi ? 'Lưu Thay Đổi' : 'Save Changes')}
              </span>
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveForm} className="space-y-4">
          {formError && (
            <div className="rounded-[var(--radius-sm)] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Zone Key */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Dải phân vùng' : 'Subnet Zone'} <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.zoneKey}
                onChange={(e) => setFormData({ ...formData, zoneKey: e.target.value })}
                className="form-input text-xs"
              >
                {ZONE_OPTIONS.map((z) => (
                  <option key={z.key} value={z.key}>
                    {isVi ? z.vi : z.en}
                  </option>
                ))}
              </select>
            </div>

            {/* IP Address */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Địa chỉ IP' : 'IP Address'} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.ip}
                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                placeholder="VD: 192.168.20.15"
                className="form-input font-mono text-xs"
              />
            </div>

            {/* Device Name */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Tên thiết bị / Máy chủ' : 'Device / Server Name'} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Home Assistant VM"
                className="form-input text-xs"
              />
            </div>

            {/* MAC Address */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Địa chỉ MAC' : 'MAC Address'}
              </label>
              <input
                type="text"
                value={formData.mac}
                onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
                placeholder="VD: 00:1A:2B:3C:4D:5E"
                className="form-input font-mono text-xs"
              />
            </div>

            {/* OS / Platform */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Hệ điều hành / Nền tảng' : 'OS / Platform'}
              </label>
              <input
                type="text"
                value={formData.os}
                onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                placeholder="VD: RouterOS, Linux, ESPHome..."
                className="form-input text-xs"
              />
            </div>

            {/* Port / Services */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Port / Dịch vụ chính' : 'Port / Services'}
              </label>
              <input
                type="text"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                placeholder="VD: 80, 443, 8123"
                className="form-input font-mono text-xs"
              />
            </div>

            {/* Web URL */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Link Web GUI (nếu có)' : 'Web GUI URL'}
              </label>
              <input
                type="url"
                value={formData.webUrl}
                onChange={(e) => setFormData({ ...formData, webUrl: e.target.value })}
                placeholder="VD: http://192.168.20.1"
                className="form-input font-mono text-xs"
              />
            </div>

            {/* Installation Location */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Vị trí lắp đặt' : 'Installation Location'}
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="VD: Tủ Rack P.Khách, PVE VM 100"
                className="form-input text-xs"
              />
            </div>

            {/* Status */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Trạng thái hoạt động' : 'Operational Status'}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="form-input text-xs"
              >
                <option value="Online">Online ({isVi ? 'Đang hoạt động' : 'Active'})</option>
                <option value="Available">Available ({isVi ? 'Dự phòng / Chưa sử dụng' : 'Reserved / Available'})</option>
                <option value="Active Range">Active Range ({isVi ? 'Dải cấp động DHCP' : 'Dynamic Range'})</option>
              </select>
            </div>

            {/* Notes Vi */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Ghi chú (Tiếng Việt)' : 'Notes (Vietnamese)'}
              </label>
              <textarea
                rows={2}
                value={formData.notesVi}
                onChange={(e) => setFormData({ ...formData, notesVi: e.target.value })}
                placeholder="VD: Default Gateway mạng nội bộ"
                className="form-input text-xs !h-auto py-2"
              />
            </div>

            {/* Notes En */}
            <div>
              <label className="block text-xs font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {isVi ? 'Ghi chú (Tiếng Anh)' : 'Notes (English)'}
              </label>
              <textarea
                rows={2}
                value={formData.notesEn}
                onChange={(e) => setFormData({ ...formData, notesEn: e.target.value })}
                placeholder="VD: Default Gateway for internal subnet"
                className="form-input text-xs !h-auto py-2"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      <Modal
        open={deleteModalOpen && !!itemToDelete}
        onClose={() => setDeleteModalOpen(false)}
        title={isVi ? 'Xác Nhận Xóa Thiết Bị' : 'Confirm Delete Device'}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              {isVi ? 'Hủy Bỏ' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmDelete}
              className="btn btn-danger btn-sm flex items-center gap-1.5"
            >
              {saving && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              <span>{isVi ? 'Xác Nhận Xóa' : 'Delete'}</span>
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-dim)]">
            {isVi
              ? 'Hành động này sẽ xóa vĩnh viễn thiết bị khỏi sổ quản lý IPAM.'
              : 'This action will permanently remove this device from the IPAM registry.'}
          </p>

          {itemToDelete && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] p-3 text-xs space-y-1 font-mono">
              <div>
                <strong className="text-[var(--text-faint)] font-sans">{isVi ? 'Tên thiết bị: ' : 'Device: '}</strong>
                <span className="text-[var(--text)] font-sans font-semibold">{itemToDelete.name}</span>
              </div>
              <div>
                <strong className="text-[var(--text-faint)]">IP: </strong>
                <span className="text-[var(--accent-bright)] font-bold">{itemToDelete.ip}</span>
              </div>
              <div>
                <strong className="text-[var(--text-faint)]">MAC: </strong>
                <span className="text-[var(--text-dim)]">{itemToDelete.mac}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* RESET DEFAULT CONFIRMATION MODAL                                          */}
      {/* ========================================================================= */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={isVi ? 'Khôi Phục Danh Sách Gốc' : 'Reset to Default IP Log'}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              {isVi ? 'Hủy Bỏ' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmReset}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              {saving && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              <span>{isVi ? 'Khôi Phục Mặc Định' : 'Reset Default'}</span>
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-dim)] leading-relaxed">
            {isVi
              ? 'Tất cả các thay đổi tùy biến sẽ được thay thế bằng 17 bản ghi quy hoạch IP mặc định từ tệp seed.'
              : 'All custom IP edits will be replaced with the pristine 17 default baseline records.'}
          </p>
        </div>
      </Modal>
    </div>
  );
}
