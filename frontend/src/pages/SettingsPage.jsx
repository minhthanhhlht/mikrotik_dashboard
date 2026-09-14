import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const EMPTY_USER_FORM = {
  username: '',
  password: '',
  fullName: '',
  group: 'write',
  role: 'operator',
};

export default function SettingsPage() {
  const { user, group, role, fullName, isAdmin } = useAuth();
  const toast = useToast();
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Dashboard Accounts Management (Admin only)
  const [dashboardUsers, setDashboardUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [userFormBusy, setUserFormBusy] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [busyUserId, setBusyUserId] = useState(null);

  // Cấu hình Cài đặt hệ thống (Lưu tập trung JSON file trên backend)
  const [systemSettings, setSystemSettings] = useState(null);
  const [voucherSettings, setVoucherSettings] = useState({    
    locationName: 'Nhà Mềnh',
    ssid: 'MT_KHACH_5G',
    loginUrl: 'http://192.168.20.1',
    sampleUser: 'khach',
    samplePassword: 'khongchiase',
    sampleUptime: '',
    sampleBytes: '',
    sampleProfile: '',
    hotline: '0888 561 297',
    footerText: 'Chúc bạn trải nghiệm mạng tốc độ cao vui vẻ!',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState('');
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Load Settings from Backend JSON file on mount
  const loadSystemSettings = useCallback(async () => {
    try {
      const data = await api.getSettings();
      if (data) {
        setSystemSettings(data);
        if (data.voucher) {
          setVoucherSettings((prev) => ({ ...prev, ...data.voucher }));
        }
        if (data.updatedAt) {
          try {
            setLastSavedTime(new Date(data.updatedAt).toLocaleTimeString('vi-VN'));
          } catch {}
        }
      }
    } catch (err) {
      console.error('Không tải được cài đặt từ máy chủ:', err.message);
    } finally {
      setHasLoadedInitial(true);
    }
  }, []);

  // Tự động lưu cấu hình khi người dùng chỉnh sửa
  useEffect(() => {
    if (!hasLoadedInitial) return;
    const timer = setTimeout(async () => {
      setSavingSettings(true);
      try {
        const payload = {
          ...(systemSettings || {}),
          voucher: voucherSettings,
        };
        const res = await api.updateSettings(payload);
        if (res?.settings) setSystemSettings(res.settings);
        try {
          localStorage.setItem('hs_voucher_settings', JSON.stringify(voucherSettings));
        } catch {}
        setLastSavedTime(new Date().toLocaleTimeString('vi-VN'));
      } catch (err) {
        console.error('Lỗi tự động lưu cài đặt:', err.message);
      } finally {
        setSavingSettings(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [voucherSettings, hasLoadedInitial]);

  async function checkHealth(manual = false) {
    setLoadingHealth(true);
    try {
      const res = await api.health();
      setHealthData(res);
      if (manual) {
        if (res.connected) {
          toast.success(`Kết nối MikroTik (${res.mikrotik?.host}) ổn định · ${res.latencyMs}ms`, 'Kết nối thành công');
        } else {
          toast.error(res.error || 'Không thể kết nối router MikroTik', 'Mất kết nối');
        }
      }
    } catch (err) {
      setHealthData({ connected: false, error: err.message });
      if (manual) {
        toast.error(err.message, 'Lỗi kết nối router');
      }
    } finally {
      setLoadingHealth(false);
    }
  }

  const [hotspotUsers, setHotspotUsers] = useState([]);
  const [loadingHotspotUsers, setLoadingHotspotUsers] = useState(false);
  const [selectedHotspotUser, setSelectedHotspotUser] = useState('');

  // Quản lý Sao lưu & Xuất cấu hình RouterOS
  const generateDefaultBackupName = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `mikrotik_backup_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  const [routerBackups, setRouterBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupForm, setBackupForm] = useState({
    type: 'rsc',
    name: generateDefaultBackupName(),
    showSensitive: true,
    compact: true,
    password: '',
    dontEncrypt: true,
  });
  const [backupBusy, setBackupBusy] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState({ filename: '', contents: '' });
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [deletingBackupId, setDeletingBackupId] = useState(null);

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const loadRouterBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const data = await api.getRouterBackups();
      setRouterBackups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Không tải được danh sách backup:', err.message);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  async function handleCreateBackup(e) {
    if (e) e.preventDefault();
    if (!backupForm.name.trim()) {
      toast.warning('Vui lòng nhập tên file sao lưu!', 'Thiếu tên file');
      return;
    }

    setBackupBusy(true);
    try {
      const res = await api.createRouterBackup(backupForm);
      if (res.type === 'rsc') {
        if (res.contents) {
          downloadTextFile(res.filename, res.contents);
          toast.success(
            `Đã xuất cấu hình Router "${res.filename}" và tải về máy tính của bạn!`,
            'Xuất script thành công'
          );
        } else {
          toast.success(`Đã tạo file cấu hình script "${res.filename}" trên Router.`, 'Xuất file thành công');
        }
      } else {
        try {
          await api.downloadRouterBackup(res.filename);
          toast.success(
            `Đã tạo bản sao lưu nhị phân "${res.filename}" (${formatBytes(res.size)}) và tải về máy tính!`,
            'Sao lưu & Tải về thành công'
          );
        } catch (dlErr) {
          toast.success(
            `Đã tạo bản sao lưu "${res.filename}" trên bộ nhớ Router.`,
            'Sao lưu hoàn tất'
          );
        }
      }
      setBackupForm((prev) => ({ ...prev, name: generateDefaultBackupName() }));
      loadRouterBackups();
    } catch (err) {
      toast.error('Lỗi tạo sao lưu: ' + err.message, 'Sao lưu thất bại');
    } finally {
      setBackupBusy(false);
    }
  }

  function handlePreviewFile(file) {
    if (!file.contents) {
      toast.info('File nhị phân (.backup) không thể xem trước dưới dạng văn bản. Vui lòng sử dụng file script (.rsc).', 'Không thể xem trước');
      return;
    }
    setPreviewData({ filename: file.name, contents: file.contents });
    setCopiedPreview(false);
    setPreviewModalOpen(true);
  }

  async function handleDownloadExistingFile(file) {
    try {
      if (file.type === 'rsc' && file.contents) {
        downloadTextFile(file.name, file.contents);
        toast.success(`Đã tải file script "${file.name}" về máy tính!`, 'Tải về hoàn tất');
      } else {
        await api.downloadRouterBackup(file.name);
        toast.success(`Đã tải file sao lưu "${file.name}" về máy tính!`, 'Tải về hoàn tất');
      }
    } catch (err) {
      toast.error(`Lỗi tải file "${file.name}": ${err.message}`, 'Tải về thất bại');
    }
  }

  async function handleDeleteRouterBackup(file) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản sao lưu "${file.name}" khỏi Router?`)) {
      return;
    }
    setDeletingBackupId(file.id);
    try {
      await api.deleteRouterBackup(file.id);
      toast.success(`Đã xóa bản sao lưu "${file.name}" khỏi Router.`, 'Đã xóa');
      loadRouterBackups();
    } catch (err) {
      toast.error('Lỗi xóa file sao lưu: ' + err.message, 'Xóa thất bại');
    } finally {
      setDeletingBackupId(null);
    }
  }

  const loadHotspotUsers = useCallback(async () => {
    setLoadingHotspotUsers(true);
    try {
      const data = await api.users();
      setHotspotUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Không tải được danh sách hotspot users từ router:', err.message);
    } finally {
      setLoadingHotspotUsers(false);
    }
  }, []);

  function handleSelectHotspotUser(e) {
    const val = e.target.value;
    setSelectedHotspotUser(val);
    if (!val) return;
    const target = hotspotUsers.find(
      (u) => u.name === val || u['.id'] === val || String(u.name).toLowerCase() === String(val).toLowerCase()
    );
    if (target) {
      const newUser = target.name || '';
      const newPass = target.password !== undefined && target.password !== null ? String(target.password) : '';
      const uptimeStr = target['limit-uptime'] ? formatDuration(target['limit-uptime']) : 'Không giới hạn';
      const bytesStr = target['limit-bytes-total'] ? formatBytes(target['limit-bytes-total']) : 'Không giới hạn';
      setVoucherSettings((prev) => ({
        ...prev,
        sampleUser: newUser,
        samplePassword: newPass,
        sampleUptime: uptimeStr,
        sampleBytes: bytesStr,
        sampleProfile: target.profile || '',
      }));
      toast.success(
        `Đã chọn "${newUser}" · Pass: ${newPass ? newPass : '(Trống)'}`,
        'Tự động điền theo User'
      );
    }
  }

  const loadDashboardUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const data = await api.adminUsers();
      setDashboardUsers(data || []);
    } catch (err) {
      toast.error(`Không tải được danh sách tài khoản: ${err.message}`, 'Lỗi tải dữ liệu');
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    checkHealth(false);
    loadSystemSettings();
    loadHotspotUsers();
    loadRouterBackups();
    if (isAdmin) {
      loadDashboardUsers();
    }
  }, [isAdmin, loadDashboardUsers, loadHotspotUsers, loadRouterBackups, loadSystemSettings]);

  async function handleSaveVoucherSettings(e) {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = {
        ...(systemSettings || {}),
        voucher: voucherSettings,
      };
      const res = await api.updateSettings(payload);
      if (res?.settings) setSystemSettings(res.settings);
      try {
        localStorage.setItem('hs_voucher_settings', JSON.stringify(voucherSettings));
      } catch {}
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setLastSavedTime(timeStr);
      toast.success(`Đã lưu mẫu in thẻ WiFi vào máy chủ!`, 'Lưu cài đặt');
    } catch (err) {
      toast.error('Lỗi lưu cấu hình: ' + err.message, 'Lỗi lưu');
    } finally {
      setSavingSettings(false);
    }
  }

  async function printSampleCard() {
    const v = voucherSettings;
    const active = hotspotUsers.find((u) => u.name === v.sampleUser);
    const uptimeText = active?.['limit-uptime']
      ? formatDuration(active['limit-uptime'])
      : (v.sampleUptime || 'Không giới hạn');
    const bytesText = active?.['limit-bytes-total']
      ? formatBytes(active['limit-bytes-total'])
      : (v.sampleBytes || 'Không giới hạn');
    const profileText = active?.profile || v.sampleProfile || '';

    try {
      await api.updateSettings({
        ...(systemSettings || {}),
        voucher: v,
      });
      setLastSavedTime(new Date().toLocaleTimeString('vi-VN'));
    } catch {}

    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>In thử thẻ WiFi - ${escapeHtml(v.locationName || 'MikroTik')}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; background: #fff; color: #0f172a; }
        h2 { text-align: center; margin-bottom: 20px; font-size: 18px; font-weight: bold; color: #0f172a; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-width: 720px; margin: 0 auto; }
        .card { border: 1.5px dashed #6d7cff; border-radius: 10px; padding: 16px 18px; background: #f8fafc; page-break-inside: avoid; }
        .location { font-size: 14px; font-weight: 800; color: #4954cc; text-transform: uppercase; letter-spacing: 0.5px; }
        .ssid { font-size: 13px; color: #1e293b; margin: 4px 0 8px 0; font-weight: 600; }
        .divider { height: 1px; background: #cbd5e1; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
        .row span { color: #64748b; }
        .highlight { font-family: monospace; font-size: 14px; font-weight: 700; color: #0f172a; background: #eef1f7; padding: 1px 6px; border-radius: 4px; }
        .hotline { font-size: 12px; color: #4954cc; margin-top: 6px; font-weight: 600; }
        .login-url { font-size: 12px; color: #6d7cff; margin-top: 4px; font-weight: 600; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
        @media print {
          body { padding: 0; }
          .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .card { background: #fff; border-color: #94a3b8; }
        }
      </style></head><body>
      <h2>Mẫu In Thử Thẻ Truy Cập WiFi — ${escapeHtml(v.locationName || 'Hotspot')}</h2>
      <div class="grid">
        <div class="card">
          ${v.locationName ? `<div class="location">🏢 ${escapeHtml(v.locationName)}</div>` : ''}
          <div class="ssid">📶 WiFi (SSID): <b>${escapeHtml(v.ssid || 'WIFI_HOTSPOT')}</b></div>
          ${v.loginUrl ? `<div class="login-url">🌐 Đăng nhập tại: <b>${escapeHtml(v.loginUrl)}</b></div>` : ''}
          <div class="divider"></div>
          <div class="row"><span>👤 Tài khoản:</span><b class="highlight">${escapeHtml(v.sampleUser || 'khach')}</b></div>
          <div class="row"><span>🔑 Mật khẩu:</span><b class="highlight">${escapeHtml(v.samplePassword || 'khongchiase')}</b></div>
          <div class="row"><span>⏱️ Thời hạn:</span><b>${escapeHtml(uptimeText)}</b></div>
          <div class="row"><span>📊 Dung lượng:</span><b>${escapeHtml(bytesText)}</b></div>
          ${profileText ? `<div class="row"><span>📦 Gói hồ sơ:</span><b>${escapeHtml(profileText)}</b></div>` : ''}
          ${v.hotline ? `<div class="row hotline"><span>📞 Hotline:</span><b>${escapeHtml(v.hotline)}</b></div>` : ''}
          ${v.footerText ? `<div class="footer">${escapeHtml(v.footerText)}</div>` : ''}
        </div>
      </div>
      <script>window.print();<${'/script'}>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
    }
    toast.info('Đang mở cửa sổ in thử mẫu thẻ WiFi voucher', 'In thử thẻ mẫu');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function openCreateUserModal() {
    setEditingUser(null);
    setUserForm(EMPTY_USER_FORM);
    setUserFormError('');
    setUserModalOpen(true);
  }

  function openEditUserModal(u) {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      password: '',
      fullName: u.fullName || '',
      group: u.group || (u.role === 'admin' ? 'full' : u.role === 'viewer' ? 'read' : 'write'),
      role: u.role || 'operator',
    });
    setUserFormError('');
    setUserModalOpen(true);
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    if (!userForm.username.trim()) {
      setUserFormError('Vui lòng nhập tên tài khoản.');
      return;
    }
    if (!editingUser && !userForm.password) {
      setUserFormError('Vui lòng nhập mật khẩu cho tài khoản mới.');
      return;
    }

    setUserFormBusy(true);
    setUserFormError('');
    try {
      if (editingUser) {
        const payload = {
          group: userForm.group,
          fullName: userForm.fullName.trim(),
        };
        if (userForm.password) payload.password = userForm.password;
        await api.updateAdminUser(editingUser.id, payload);
        toast.success(`Đã cập nhật tài khoản "${editingUser.username}" trên MikroTik.`, 'Cập nhật thành công');
      } else {
        await api.createAdminUser({
          username: userForm.username.trim(),
          password: userForm.password,
          group: userForm.group,
          fullName: userForm.fullName.trim(),
        });
        toast.success(`Đã tạo tài khoản "${userForm.username}" trên MikroTik RouterOS.`, 'Tạo thành công');
      }
      setUserModalOpen(false);
      loadDashboardUsers();
    } catch (err) {
      setUserFormError(err.message);
      toast.error(err.message, 'Lỗi thao tác tài khoản');
    } finally {
      setUserFormBusy(false);
    }
  }

  async function handleDeleteUser(u) {
    if (u.group === 'full' || u.role === 'admin') {
      toast.warning('Tài khoản thuộc nhóm quyền cao nhất (full) được bảo vệ và không thể xóa!', 'Không thể xóa');
      return;
    }
    if (u.username === user) {
      toast.warning('Không thể tự xóa tài khoản của chính bạn!', 'Thao tác bị chặn');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${u.username}" (${u.fullName})?`)) {
      return;
    }
    setBusyUserId(u.id);
    try {
      await api.deleteAdminUser(u.id);
      toast.success(`Đã xóa tài khoản "${u.username}" khỏi MikroTik.`, 'Xóa thành công');
      loadDashboardUsers();
    } catch (err) {
      toast.error('Lỗi xóa tài khoản: ' + err.message, 'Xóa thất bại');
    } finally {
      setBusyUserId(null);
    }
  }

  const routerCliScript = `# Cấu hình dịch vụ REST API trên MikroTik RouterOS 7
/ip/service set www disabled=no port=80
/ip/service set www-ssl disabled=no port=443

# Tạo user quản trị riêng cho Dashboard
/user add name=user_api group=full password="<MAT_KHAU_MANH>" comment="Hotspot Dashboard API"`;

  function copyCliScript() {
    navigator.clipboard.writeText(routerCliScript);
    setCopiedScript(true);
    toast.info('Đã sao chép lệnh CLI WinBox vào bộ nhớ tạm!', 'Đã sao chép');
    setTimeout(() => setCopiedScript(false), 3000);
  }

  const activeUser = hotspotUsers.find(
    (u) => u.name === voucherSettings.sampleUser || (selectedHotspotUser && u.name === selectedHotspotUser)
  );
  const userUptimeDisplay = activeUser?.['limit-uptime']
    ? formatDuration(activeUser['limit-uptime'])
    : (voucherSettings.sampleUptime || 'Không giới hạn');
  const userBytesDisplay = activeUser?.['limit-bytes-total']
    ? formatBytes(activeUser['limit-bytes-total'])
    : (voucherSettings.sampleBytes || 'Không giới hạn');
  const userProfileDisplay = activeUser?.profile || voucherSettings.sampleProfile || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sk-topbar flex-wrap">
        <div>
          <h1 className="sk-title">Cài đặt hệ thống</h1>
          <p className="sk-subtitle font-mono">
            Cấu hình kết nối Router, mẫu in thẻ WiFi voucher & Quản lý phân quyền tài khoản
          </p>
        </div>
        <button
          onClick={() => checkHealth(true)}
          disabled={loadingHealth}
          className="btn btn-secondary btn-sm"
        >
          {loadingHealth ? <Spinner size="xs" /> : '⚡'} Kiểm tra kết nối router
        </button>
      </div>

      {/* 1. Quản lý tài khoản MikroTik System Users (/user) */}
      {isAdmin && (
        <section className="sk-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">Tài khoản Hệ thống MikroTik (/user)</h2>
              <p className="font-mono text-xs text-[var(--text-faint)]">
                Đồng bộ RouterOS 7 · Nhóm quyền: <b>full</b> (Admin), <b>write</b> (Operator), <b>read</b> (Viewer)
              </p>
            </div>
            <button
              onClick={openCreateUserModal}
              className="btn btn-primary btn-sm"
            >
              + Thêm tài khoản
            </button>
          </div>

          {loadingUsers ? (
            <Spinner label="Đang tải danh sách tài khoản từ MikroTik…" />
          ) : (
            <div className="overflow-x-auto">
              <table className="sk-dtable">
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Ghi chú / Họ tên</th>
                    <th>Nhóm MikroTik</th>
                    <th>Quyền Console</th>
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardUsers.map((u) => (
                    <tr key={u.id || u.username}>
                      <td className="font-mono font-bold">
                        {u.username}
                        {u.username === user && (
                          <span className="sk-state sk-state--accent ml-2 text-[9px]">BẠN</span>
                        )}
                      </td>
                      <td className="text-[var(--text-dim)]">{u.fullName || '—'}</td>
                      <td className="font-mono">
                        <span className="sk-state sk-state--cyan text-[10px]">
                          {u.group || (u.role === 'admin' ? 'full' : u.role === 'viewer' ? 'read' : 'write')}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`sk-pill text-[10px] py-0 px-2 ${
                            u.group === 'full' || u.role === 'admin'
                              ? 'sk-pill--accent'
                              : u.group === 'write' || u.role === 'operator'
                              ? 'sk-pill--amber'
                              : 'sk-pill--cyan'
                          }`}
                        >
                          <span className="sk-pill__dot" />
                          {u.group === 'full' || u.role === 'admin'
                            ? 'ADMIN (FULL)'
                            : u.group === 'write' || u.role === 'operator'
                            ? 'OPERATOR (WRITE)'
                            : 'VIEWER (READ)'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                          <button
                            onClick={() => openEditUserModal(u)}
                            className="btn btn-secondary btn-sm h-7 px-2 text-[11px]"
                          >
                            Sửa
                          </button>
                          {u.username !== user && u.group !== 'full' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={busyUserId === u.id}
                              className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)]"
                            >
                              {busyUserId === u.id ? '…' : 'Xóa'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 2. Cấu hình Thẻ WiFi Voucher */}
      <section className="sk-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">Mẫu in thẻ WiFi Voucher & Tài khoản</h2>
            <p className="font-mono text-xs text-[var(--text-faint)]">
              Tùy biến mẫu in phiếu truy cập cho khách hàng
            </p>
          </div>
          <button
            type="button"
            onClick={printSampleCard}
            className="btn btn-secondary btn-sm"
          >
            🖨️ In thử thẻ mẫu
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Form cấu hình */}
          <form onSubmit={handleSaveVoucherSettings} className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-3 py-2 text-xs font-mono">
              <span className="text-[var(--text-dim)]">📁 Trạng thái lưu:</span>
              {savingSettings ? (
                <span className="text-[var(--amber)] font-semibold">Đang lưu vào settings.json…</span>
              ) : lastSavedTime ? (
                <span className="text-[var(--green)] font-semibold">Đã lưu máy chủ ({lastSavedTime})</span>
              ) : (
                <span className="text-[var(--text-faint)]">Sẵn sàng</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label">Tên địa điểm / Cơ sở</label>
                <input
                  id="voucher-location-name"
                  name="locationName"
                  className="form-input text-xs"
                  value={voucherSettings.locationName || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, locationName: e.target.value })
                  }
                  placeholder="VD: Quán Cafe / Khách Sạn ABC"
                />
              </div>

              <div>
                <label className="form-label">Tên sóng WiFi (SSID)</label>
                <input
                  id="voucher-ssid"
                  name="ssid"
                  className="form-input text-xs"
                  value={voucherSettings.ssid || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, ssid: e.target.value })
                  }
                  placeholder="VD: WIFI_HOTSPOT"
                />
              </div>
            </div>

            {/* Chọn user hotspot router */}
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="form-label mb-0 text-[10px] text-[var(--accent-bright)]">
                  ⚡ Chọn tài khoản Hotspot từ Router (Tự động điền)
                </span>
                <button
                  type="button"
                  onClick={loadHotspotUsers}
                  disabled={loadingHotspotUsers}
                  className="btn btn-ghost btn-sm h-6 px-1.5 text-[10px]"
                >
                  {loadingHotspotUsers ? <Spinner size="xs" /> : '⟳'} Tải lại
                </button>
              </div>

              <CustomSelect
                id="select-hotspot-user"
                aria-label="Chọn tài khoản Hotspot từ Router"
                className="w-full"
                buttonClassName="font-mono text-xs h-8"
                placeholder={
                  loadingHotspotUsers
                    ? 'Đang tải danh sách tài khoản…'
                    : hotspotUsers.length === 0
                    ? '-- Không có tài khoản nào trên Router --'
                    : `-- Chọn tài khoản từ danh sách Router (${hotspotUsers.length}) --`
                }
                searchable={hotspotUsers.length > 4}
                value={
                  selectedHotspotUser ||
                  (hotspotUsers.find((u) => u.name === voucherSettings.sampleUser)?.name || '')
                }
                onChange={handleSelectHotspotUser}
                options={hotspotUsers.map((u) => ({
                  value: u.name,
                  label: `${u.name} (Pass: ${u.password ? u.password : 'trống'})`,
                  badge: u.profile || 'default',
                }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label">Cổng đăng nhập (Login URL)</label>
                <input
                  id="voucher-login-url"
                  name="loginUrl"
                  className="form-input text-xs"
                  value={voucherSettings.loginUrl || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, loginUrl: e.target.value })
                  }
                  placeholder="VD: http://192.168.88.1"
                />
              </div>

              <div>
                <label className="form-label">Số Hotline hỗ trợ</label>
                <input
                  id="voucher-hotline"
                  name="hotline"
                  className="form-input text-xs"
                  value={voucherSettings.hotline || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, hotline: e.target.value })
                  }
                  placeholder="VD: 0888 123 456"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Dòng chữ chân trang (Footer)</label>
              <input
                id="voucher-footer"
                name="footerText"
                className="form-input text-xs"
                value={voucherSettings.footerText || ''}
                onChange={(e) =>
                  setVoucherSettings({ ...voucherSettings, footerText: e.target.value })
                }
                placeholder="VD: Chúc quý khách truy cập mạng vui vẻ!"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="btn btn-primary btn-sm"
              >
                {savingSettings ? 'Đang lưu…' : 'Lưu cấu hình ngay'}
              </button>
              <button
                type="button"
                onClick={printSampleCard}
                className="btn btn-secondary btn-sm"
              >
                In thử 1 thẻ
              </button>
            </div>
          </form>

          {/* Live Preview Card */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-5">
            <div className="text-[11px] font-mono text-[var(--text-faint)] uppercase tracking-wider mb-3">
              Xem trước mẫu in (Preview)
            </div>

            <div className="w-full max-w-[280px] rounded-[var(--radius-sm)] border border-dashed border-[var(--accent)] bg-[var(--surface)] p-4 shadow-sm font-sans space-y-2 text-xs">
              {voucherSettings.locationName && (
                <div className="font-mono font-bold uppercase tracking-wider text-[var(--accent-bright)] text-xs">
                  🏢 {voucherSettings.locationName}
                </div>
              )}
              <div className="font-semibold text-[var(--text)]">
                📶 WiFi: <b>{voucherSettings.ssid || 'WIFI_HOTSPOT'}</b>
              </div>
              {voucherSettings.loginUrl && (
                <div className="font-mono text-[10px] text-[var(--cyan)]">
                  🌐 {voucherSettings.loginUrl}
                </div>
              )}
              <div className="border-t border-[var(--border-soft)] my-1.5" />
              <div className="flex justify-between font-mono">
                <span className="text-[var(--text-faint)]">👤 Tài khoản:</span>
                <span className="font-bold text-[var(--text)] bg-[var(--surface-2)] px-1 rounded">
                  {voucherSettings.sampleUser || 'khach'}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[var(--text-faint)]">🔑 Mật khẩu:</span>
                <span className="font-bold text-[var(--text)] bg-[var(--surface-2)] px-1 rounded">
                  {voucherSettings.samplePassword || 'khongchiase'}
                </span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[var(--text-faint)]">⏱️ Thời hạn:</span>
                <span>{userUptimeDisplay}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[var(--text-faint)]">📊 Dung lượng:</span>
                <span>{userBytesDisplay}</span>
              </div>
              {userProfileDisplay && (
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-[var(--text-faint)]">📦 Gói hồ sơ:</span>
                  <span>{userProfileDisplay}</span>
                </div>
              )}
              {voucherSettings.hotline && (
                <div className="font-mono text-[10px] text-[var(--accent-bright)] mt-1">
                  📞 Hotline: {voucherSettings.hotline}
                </div>
              )}
              {voucherSettings.footerText && (
                <div className="border-t border-dashed border-[var(--border-soft)] pt-1.5 text-center text-[10px] text-[var(--text-faint)]">
                  {voucherSettings.footerText}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Quản lý Sao lưu & Xuất cấu hình RouterOS (.rsc & .backup) */}
      <section className="sk-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">Sao lưu & Xuất cấu hình RouterOS (.backup / .rsc)</h2>
            <p className="font-mono text-xs text-[var(--text-faint)]">
              Tạo và tải về file cấu hình script RouterOS dạng văn bản (.rsc) hoặc file nhị phân (.backup)
            </p>
          </div>
          <button
            onClick={loadRouterBackups}
            disabled={loadingBackups}
            className="btn btn-secondary btn-sm"
          >
            {loadingBackups ? <Spinner size="xs" /> : '⟳'} Làm mới danh sách
          </button>
        </div>

        {/* Form tạo sao lưu */}
        <form onSubmit={handleCreateBackup} className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-4 space-y-3 mb-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="form-label">Tên file sao lưu</label>
              <input
                value={backupForm.name}
                onChange={(e) => setBackupForm({ ...backupForm, name: e.target.value })}
                className="form-input text-xs"
                placeholder="vd: mikrotik_backup_2026"
              />
            </div>

            <div className="w-48">
              <label className="form-label">Định dạng xuất</label>
              <div className="sk-seg w-full">
                <button
                  type="button"
                  onClick={() => setBackupForm({ ...backupForm, type: 'rsc' })}
                  className={`sk-seg__btn flex-1 justify-center ${backupForm.type === 'rsc' ? 'is-on' : ''}`}
                >
                  Script (.rsc)
                </button>
                <button
                  type="button"
                  onClick={() => setBackupForm({ ...backupForm, type: 'backup' })}
                  className={`sk-seg__btn flex-1 justify-center ${backupForm.type === 'backup' ? 'is-on' : ''}`}
                >
                  Binary (.backup)
                </button>
              </div>
            </div>

            <div className="self-end">
              <button
                type="submit"
                disabled={backupBusy}
                className="btn btn-primary btn-sm h-9"
              >
                {backupBusy ? 'Đang xuất…' : backupForm.type === 'rsc' ? '⬇ Xuất file .rsc' : '⬇ Tạo file .backup'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-dim)] pt-1 font-mono">
            {backupForm.type === 'rsc' ? (
              <>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupForm.showSensitive}
                    onChange={(e) => setBackupForm({ ...backupForm, showSensitive: e.target.checked })}
                  />
                  <span>Bao gồm mật khẩu / thông tin nhạy cảm (show-sensitive)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupForm.compact}
                    onChange={(e) => setBackupForm({ ...backupForm, compact: e.target.checked })}
                  />
                  <span>Nén gọn chỉ cấu hình tùy chỉnh (compact)</span>
                </label>
              </>
            ) : (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupForm.dontEncrypt}
                  onChange={(e) => setBackupForm({ ...backupForm, dontEncrypt: e.target.checked })}
                />
                <span>Không mã hóa file nhị phân (dont-encrypt)</span>
              </label>
            )}
          </div>
        </form>

        {/* Bảng danh sách file sao lưu */}
        <div className="overflow-x-auto">
          <table className="sk-dtable">
            <thead>
              <tr>
                <th>Tên file trên Router</th>
                <th>Loại file</th>
                <th>Dung lượng</th>
                <th>Thời gian tạo</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {routerBackups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-mono text-xs text-[var(--text-faint)]">
                    Chưa có file sao lưu nào trên Router. Hãy nhấn nút xuất file ở trên.
                  </td>
                </tr>
              ) : (
                routerBackups.map((file) => (
                  <tr key={file.id || file.name}>
                    <td className="font-mono font-semibold">{file.name}</td>
                    <td>
                      <span className={`sk-state text-[10px] ${file.type === 'rsc' ? 'sk-state--accent' : 'sk-state--cyan'}`}>
                        {file.type ? file.type.toUpperCase() : 'FILE'}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-[var(--text-dim)]">{formatBytes(file.size)}</td>
                    <td className="font-mono text-xs text-[var(--text-faint)]">{file.creationTime || '—'}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                        {file.type === 'rsc' && file.contents && (
                          <button
                            type="button"
                            onClick={() => handlePreviewFile(file)}
                            className="btn btn-secondary btn-sm h-7 px-2 text-[11px]"
                          >
                            👁 Xem script
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadExistingFile(file)}
                          className="btn btn-primary btn-sm h-7 px-2 text-[11px]"
                        >
                          ⬇ Tải về
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRouterBackup(file)}
                          disabled={deletingBackupId === file.id}
                          className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)]"
                        >
                          {deletingBackupId === file.id ? '…' : 'Xóa'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Lệnh CLI WinBox */}
      <section className="sk-card">
        <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text)]">Lệnh Cấu hình RouterOS REST API (Terminal CLI)</h2>
            <p className="font-mono text-xs text-[var(--text-faint)]">
              Chạy các lệnh sau trong WinBox New Terminal nếu router chưa bật REST
            </p>
          </div>
          <button
            onClick={copyCliScript}
            className="btn btn-secondary btn-sm font-mono text-xs"
          >
            {copiedScript ? '✓ Đã sao chép' : '📋 Sao chép lệnh CLI'}
          </button>
        </div>

        <pre className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--bg-code)] p-3.5 font-mono text-xs text-[var(--text-code)] leading-relaxed">
          {routerCliScript}
        </pre>
      </section>

      {/* Modal Quản lý User */}
      <Modal
        open={userModalOpen}
        title={editingUser ? `Sửa tài khoản "${editingUser.username}"` : 'Tạo tài khoản MikroTik mới'}
        onClose={() => setUserModalOpen(false)}
        footer={
          <>
            <button onClick={() => setUserModalOpen(false)} className="btn btn-secondary btn-sm">
              Hủy
            </button>
            <button onClick={handleSaveUser} disabled={userFormBusy} className="btn btn-primary btn-sm">
              {userFormBusy ? 'Đang lưu…' : editingUser ? 'Cập nhật' : 'Tạo tài khoản'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          {userFormError && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--red-bg)] border border-[rgba(251,111,111,0.3)] p-2.5 text-xs font-medium text-[var(--red)]">
              {userFormError}
            </div>
          )}

          <div>
            <label className="form-label">Tên tài khoản *</label>
            <input
              className="form-input"
              value={userForm.username}
              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
              placeholder="vd: operator1"
              autoFocus
              disabled={!!editingUser}
            />
          </div>

          <div>
            <label className="form-label">
              Mật khẩu {editingUser ? '(để trống nếu không muốn đổi)' : '*'}
            </label>
            <input
              type="password"
              className="form-input"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="form-label">Họ và tên / Ghi chú</label>
            <input
              className="form-input"
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
              placeholder="vd: Nguyễn Văn A (Nhân viên lễ tân)"
            />
          </div>

          <div>
            <label className="form-label">Nhóm quyền RouterOS (Group)</label>
            <CustomSelect
              className="w-full"
              value={userForm.group}
              onChange={(e) => setUserForm({ ...userForm, group: e.target.value })}
              options={[
                { value: 'write', label: 'write — Nhân viên vận hành (Cấp phát, gia hạn voucher)' },
                { value: 'full', label: 'full — Quản trị viên cao cấp (Toàn quyền hệ thống)' },
                { value: 'read', label: 'read — Giám sát viên (Chỉ xem thống kê)' },
              ]}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Xem trước Script .rsc */}
      <Modal
        open={previewModalOpen}
        title={`Xem cấu hình Script: ${previewData.filename}`}
        maxWidth="max-w-3xl"
        onClose={() => setPreviewModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => {
                navigator.clipboard.writeText(previewData.contents);
                setCopiedPreview(true);
                toast.info('Đã sao chép toàn bộ script vào bộ nhớ tạm!', 'Đã sao chép');
                setTimeout(() => setCopiedPreview(false), 3000);
              }}
              className="btn btn-secondary btn-sm"
            >
              {copiedPreview ? '✓ Đã sao chép' : '📋 Sao chép Script'}
            </button>
            <button
              onClick={() => downloadTextFile(previewData.filename, previewData.contents)}
              className="btn btn-primary btn-sm"
            >
              ⬇ Tải file về
            </button>
          </>
        }
      >
        <pre className="max-h-[60vh] overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--bg-code)] p-4 font-mono text-xs text-[var(--text-code)] leading-relaxed">
          {previewData.contents}
        </pre>
      </Modal>
    </div>
  );
}
