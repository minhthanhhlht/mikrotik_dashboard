import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';
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

  // Tự động lưu cấu hình khi người dùng chỉnh sửa (Auto-save with debounce 700ms)
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

  // Check health on mount
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

  // Danh sách tài khoản Hotspot từ MikroTik Router (/ip/hotspot/user) để chọn vào mẫu in thẻ
  const [hotspotUsers, setHotspotUsers] = useState([]);
  const [loadingHotspotUsers, setLoadingHotspotUsers] = useState(false);
  const [selectedHotspotUser, setSelectedHotspotUser] = useState('');

  // ----------------------------------------------------------------------------
  // Quản lý Sao lưu & Xuất cấu hình RouterOS (.backup & .rsc)
  // ----------------------------------------------------------------------------
  const generateDefaultBackupName = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `mikrotik_backup_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  const [routerBackups, setRouterBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupForm, setBackupForm] = useState({
    type: 'rsc', // 'rsc' | 'backup'
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

  // Tải trực tiếp file văn bản về máy tính của người dùng
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
            `Đã xuất cấu hình Router "${res.filename}" và tự động tải về máy tính của bạn!`,
            'Xuất script thành công'
          );
        } else {
          toast.success(`Đã tạo file cấu hình script "${res.filename}" trên Router.`, 'Xuất file thành công');
        }
      } else {
        toast.success(
          `Đã tạo bản sao lưu nhị phân toàn diện "${res.filename}" (${formatBytes(res.size)}) trên Router!`,
          'Sao lưu hệ thống thành công'
        );
      }
      // Gợi ý tên mới cho lần tiếp theo
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

  function handleDownloadExistingFile(file) {
    if (file.contents) {
      downloadTextFile(file.name, file.contents);
      toast.success(`Đã tải file "${file.name}" về máy tính của bạn!`, 'Tải về hoàn tất');
    } else {
      toast.info(
        `Bản sao lưu "${file.name}" đang lưu trên bộ nhớ Router. Bạn có thể khôi phục qua lệnh WinBox / WebFig.`,
        'Bản sao lưu nhị phân'
      );
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
        `Đã chọn "${newUser}" · Pass: ${newPass ? newPass : '(Trống)'} · Hạn: ${uptimeStr} · Data: ${bytesStr}`,
        'Tự động điền theo User'
      );
    }
  }

  // Load Dashboard Users (Admin only)
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
      toast.success(`Đã lưu mẫu in thẻ WiFi vào máy chủ (settings.json) lúc ${timeStr}!`, 'Lưu cài đặt');
    } catch (err) {
      toast.error('Lỗi lưu cấu hình: ' + err.message, 'Lỗi lưu');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleResetVoucherSettings() {
    const defaults = {
      locationName: 'Nhà Mềnh',
      ssid: 'MT_KHACH_5G',
      loginUrl: 'http://192.168.20.1',
      sampleUser: 'khach',
      samplePassword: 'khongchiase',
      hotline: '0888 561 297',
      footerText: 'Chúc bạn trải nghiệm mạng tốc độ cao vui vẻ!',
    };
    setVoucherSettings(defaults);
    try {
      const payload = {
        ...(systemSettings || {}),
        voucher: defaults,
      };
      const res = await api.updateSettings(payload);
      if (res?.settings) setSystemSettings(res.settings);
      try {
        localStorage.setItem('hs_voucher_settings', JSON.stringify(defaults));
      } catch {}
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setLastSavedTime(timeStr);
      toast.info('Đã khôi phục cấu hình mẫu in thẻ về mặc định (settings.json).', 'Khôi phục mặc định');
    } catch (err) {
      toast.error('Lỗi khôi phục cấu hình: ' + err.message, 'Lỗi khôi phục');
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

    // Đồng bộ lưu ngay trước khi in
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
        .card { border: 2px dashed #0084ff; border-radius: 12px; padding: 16px 18px; background: #f8fafc; page-break-inside: avoid; }
        .location { font-size: 14px; font-weight: 800; color: #0084ff; text-transform: uppercase; letter-spacing: 0.5px; }
        .ssid { font-size: 13px; color: #1e293b; margin: 4px 0 8px 0; font-weight: 600; }
        .divider { height: 1px; background: #cbd5e1; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
        .row span { color: #64748b; }
        .highlight { font-family: monospace; font-size: 14px; font-weight: 700; color: #0f172a; background: #e0f2fe; padding: 1px 6px; border-radius: 4px; }
        .hotline { font-size: 12px; color: #0284c7; margin-top: 6px; font-weight: 600; }
        .login-url { font-size: 12px; color: #7c3aed; margin-top: 4px; font-weight: 600; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
        @media print {
          body { padding: 0; }
          .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .card { background: #fff; border-color: #0284c7; }
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

# Tạo user quản trị riêng cho Dashboard (thay <MAT_KHAU_MANH> bằng mật khẩu của bạn)
/user add name=user_api group=full password="<MAT_KHAU_MANH>" comment="Hotspot Dashboard API"`;

  function copyCliScript() {
    navigator.clipboard.writeText(routerCliScript);
    setCopiedScript(true);
    toast.info('Đã sao chép lệnh CLI WinBox vào bộ nhớ tạm!', 'Đã sao chép');
    setTimeout(() => setCopiedScript(false), 3000);
  }

  // Lấy thông số Thời hạn & Dung lượng tự động theo User đang chọn
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Cài đặt hệ thống<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Cấu hình kết nối Router, mẫu in thẻ WiFi voucher và quản lý phân quyền người dùng
          </p>
        </div>
        <button
          onClick={() => checkHealth(true)}
          disabled={loadingHealth}
          className="btn-ghost self-start px-3.5 py-2 text-xs font-semibold sm:self-auto"
        >
          {loadingHealth ? <Spinner size="sm" /> : '⚡'} Kiểm tra kết nối router
        </button>
      </div>

      {/* Quản lý tài khoản MikroTik System Users (/user) */}
      {isAdmin && (
        <section className="glass rounded-2xl p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/40 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#00a2ff] text-white shadow-[0_0_16px_rgba(0,132,255,0.4)]">
                👥
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Quản lý Tài khoản Hệ thống MikroTik (/user)</h2>
                <p className="text-xs text-ink-faint">
                  Đồng bộ trực tiếp RouterOS 7 · Nhóm quyền chuẩn: <b>full</b> (Quản trị), <b>write</b> (Vận hành), <b>read</b> (Giám sát)
                </p>
              </div>
            </div>
            <button
              onClick={openCreateUserModal}
              className="btn-primary px-3.5 py-1.5 text-xs font-semibold"
            >
              + Thêm tài khoản MikroTik
            </button>
          </div>

          {loadingUsers ? (
            <Spinner label="Đang tải danh sách tài khoản từ MikroTik…" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/50 bg-white/30">
              <table className="glass-table w-full text-left text-sm">
                <thead>
                  <tr className="label-caps">
                    <th className="px-4 py-3 font-semibold">Tài khoản</th>
                    <th className="px-4 py-3 font-semibold">Ghi chú / Họ tên</th>
                    <th className="px-4 py-3 font-semibold">Nhóm MikroTik (Group)</th>
                    <th className="px-4 py-3 font-semibold">Quyền Dashboard</th>
                    <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5 text-xs">
                  {dashboardUsers.map((u) => (
                    <tr key={u.id || u.username}>
                      <td className="px-4 py-3 font-mono font-bold text-ink">
                        {u.username}
                        {u.username === user && (
                          <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            (Bạn)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{u.fullName || '—'}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-primary-deep">
                        <span className="rounded bg-primary-soft/80 px-2 py-0.5 text-[11px]">
                          {u.group || (u.role === 'admin' ? 'full' : u.role === 'viewer' ? 'read' : 'write')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.group === 'full' || u.role === 'admin'
                              ? 'bg-primary-soft text-primary-deep'
                              : u.group === 'write' || u.role === 'operator'
                              ? 'bg-warning-soft text-warning'
                              : 'bg-tertiary-soft text-tertiary'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.group === 'full' || u.role === 'admin'
                                ? 'bg-primary shadow-[0_0_6px_rgba(0,132,255,0.8)]'
                                : u.group === 'write' || u.role === 'operator'
                                ? 'bg-warning shadow-[0_0_6px_rgba(217,119,6,0.8)]'
                                : 'bg-tertiary shadow-[0_0_6px_rgba(124,58,237,0.8)]'
                            }`}
                          />
                          {u.group === 'full' || u.role === 'admin'
                            ? 'Quản trị viên (Toàn quyền)'
                            : u.group === 'write' || u.role === 'operator'
                            ? 'Nhân viên (Cấp voucher/Kick)'
                            : 'Giám sát (Chỉ xem)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditUserModal(u)}
                            className="btn-ghost px-2.5 py-1 text-xs"
                          >
                            Sửa / Đổi mật khẩu
                          </button>
                          {u.username !== user && u.group !== 'full' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={busyUserId === u.id}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-danger transition hover:bg-danger-soft disabled:opacity-50"
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

      {/* 2. Cấu hình Thẻ WiFi (Voucher Printing) */}
      <section className="glass rounded-2xl p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/40 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-primary text-white shadow-[0_0_16px_rgba(0,132,255,0.3)]">
              🎫
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Mẫu in thẻ WiFi Voucher & Tài khoản / Mật khẩu</h2>
              <p className="text-xs text-ink-faint">Tùy biến mẫu in phiếu truy cập cho khách hàng, bao gồm tài khoản, mật khẩu và cổng đăng nhập</p>
            </div>
          </div>
          <button
            type="button"
            onClick={printSampleCard}
            className="btn-secondary px-3.5 py-1.5 text-xs font-semibold"
            title="In thử một thẻ mẫu với cấu hình hiện tại"
          >
            🖨️ In thử 1 thẻ mẫu
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cột trái: Form cấu hình (7 cột) */}
          <form onSubmit={handleSaveVoucherSettings} className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between rounded-xl bg-white/40 px-3.5 py-2 text-xs text-ink-soft">
              <span className="font-semibold text-ink">📁 Trạng thái lưu:</span>
              {savingSettings ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-warning">
                  <span className="h-2 w-2 animate-ping rounded-full bg-warning" />
                  Đang lưu vào settings.json…
                </span>
              ) : lastSavedTime ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  Đã lưu vào máy chủ ({lastSavedTime})
                </span>
              ) : (
                <span className="text-ink-faint">Sẵn sàng lưu</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label-caps mb-1 block text-xs">🏢 Tên địa điểm / Cơ sở</span>
                <input
                  id="voucher-location-name"
                  name="locationName"
                  className="input-ghost w-full px-3 py-2 text-sm"
                  value={voucherSettings.locationName || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, locationName: e.target.value })
                  }
                  placeholder="VD: Quán Cafe / Khách Sạn ABC"
                />
              </label>

              <label className="block">
                <span className="label-caps mb-1 block text-xs">📶 Tên sóng WiFi (SSID)</span>
                <input
                  id="voucher-ssid"
                  name="ssid"
                  className="input-ghost w-full px-3 py-2 text-sm"
                  value={voucherSettings.ssid || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, ssid: e.target.value })
                  }
                  placeholder="VD: WIFI_HOTSPOT_FREE"
                />
              </label>
            </div>

            {/* Chọn tài khoản từ Router MikroTik */}
            <div className="rounded-xl border border-primary/30 bg-primary-soft/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-caps text-xs font-bold text-primary flex items-center gap-1.5">
                  <span>⚡</span> Chọn tài khoản Hotspot từ Router (Tự động điền mật khẩu)
                </span>
                <button
                  type="button"
                  onClick={loadHotspotUsers}
                  disabled={loadingHotspotUsers}
                  className="btn-ghost px-2 py-0.5 text-[11px] font-semibold text-primary"
                  title="Tải lại danh sách người dùng từ MikroTik Router"
                >
                  {loadingHotspotUsers ? <Spinner size="sm" /> : '⟳'} Làm mới danh sách
                </button>
              </div>

              <select
                id="select-hotspot-user"
                aria-label="Chọn tài khoản Hotspot từ Router"
                className="input-ghost w-full font-mono text-xs font-semibold"
                value={
                  selectedHotspotUser ||
                  (hotspotUsers.find((u) => u.name === voucherSettings.sampleUser)?.name || '')
                }
                onChange={handleSelectHotspotUser}
              >
                <option value="">
                  {loadingHotspotUsers
                    ? 'Đang tải danh sách tài khoản từ Router MikroTik…'
                    : hotspotUsers.length === 0
                    ? '-- Không có tài khoản nào trên Router --'
                    : `-- Chọn tài khoản từ danh sách Router (${hotspotUsers.length} tài khoản) --`}
                </option>
                {hotspotUsers.map((u) => (
                  <option key={u['.id'] || u.name} value={u.name}>
                    👤 {u.name} {u.password ? `| Pass: ${u.password}` : '| (Không mật khẩu)'} {u.profile ? `[Gói: ${u.profile}]` : ''} {u.comment ? `(${u.comment})` : ''}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                <label className="block">
                  <span className="label-caps mb-1 block text-xs text-primary font-bold">👤 Tên tài khoản</span>
                  <input
                    id="voucher-sample-user"
                    name="sampleUser"
                    className="input-ghost w-full font-mono px-3 py-2 text-sm font-bold text-ink"
                    value={voucherSettings.sampleUser || ''}
                    onChange={(e) =>
                      setVoucherSettings({ ...voucherSettings, sampleUser: e.target.value })
                    }
                    placeholder="VD: khach_vip88"
                  />
                </label>

                <label className="block">
                  <span className="label-caps mb-1 block text-xs text-primary font-bold">🔑 Mật khẩu (Tự động điền)</span>
                  <input
                    id="voucher-sample-password"
                    name="samplePassword"
                    className="input-ghost w-full font-mono px-3 py-2 text-sm font-bold text-ink"
                    value={voucherSettings.samplePassword || ''}
                    onChange={(e) =>
                      setVoucherSettings({ ...voucherSettings, samplePassword: e.target.value })
                    }
                    placeholder="VD: 88889999"
                  />
                </label>
              </div>

              {/* Thông số tự động lấy theo User */}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-primary/20 bg-white/70 p-2.5 text-xs shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-ink-soft">⏱️ Thời hạn sử dụng:</span>
                  <span className="font-bold text-ink">{userUptimeDisplay}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-ink-soft">📊 Dung lượng giới hạn:</span>
                  <span className="font-bold text-ink">{userBytesDisplay}</span>
                </div>
                {userProfileDisplay && (
                  <div className="col-span-2 flex items-center justify-between border-t border-ink/10 pt-1.5 text-[11px]">
                    <span className="text-ink-soft">📦 Gói hồ sơ (Profile):</span>
                    <span className="rounded bg-primary-soft px-2 py-0.5 font-bold text-primary-deep">{userProfileDisplay}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label-caps mb-1 block text-xs">🌐 Địa chỉ trang đăng nhập (Portal)</span>
                <input
                  id="voucher-login-url"
                  name="loginUrl"
                  className="input-ghost w-full px-3 py-2 text-sm font-mono text-xs"
                  value={voucherSettings.loginUrl || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, loginUrl: e.target.value })
                  }
                  placeholder="VD: http://192.168.20.1"
                />
              </label>

              <label className="block">
                <span className="label-caps mb-1 block text-xs">📞 Hotline hỗ trợ kỹ thuật</span>
                <input
                  id="voucher-hotline"
                  name="hotline"
                  className="input-ghost w-full px-3 py-2 text-sm"
                  value={voucherSettings.hotline || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, hotline: e.target.value })
                  }
                  placeholder="VD: 0901 234 567"
                />
              </label>
            </div>

            <label className="block">
              <span className="label-caps mb-1 block text-xs">💬 Lời chào chân trang</span>
              <input
                id="voucher-footer-text"
                name="footerText"
                className="input-ghost w-full px-3 py-2 text-sm"
                value={voucherSettings.footerText || ''}
                onChange={(e) =>
                  setVoucherSettings({ ...voucherSettings, footerText: e.target.value })
                }
                placeholder="VD: Chúc quý khách trải nghiệm mạng tốc độ cao vui vẻ!"
              />
            </label>

            <div className="flex items-center justify-between gap-3 border-t border-white/50 pt-4">
              <button
                type="button"
                onClick={handleResetVoucherSettings}
                className="btn-ghost px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink"
                title="Khôi phục cài đặt mẫu in về mặc định"
              >
                <span>↺</span> Khôi phục mặc định
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="btn-primary px-5 py-2 text-xs font-semibold"
              >
                {savingSettings ? <Spinner size="sm" /> : '💾'} Lưu mẫu in thẻ (JSON)
              </button>
            </div>
          </form>

          {/* Cột phải: Khung Xem trước thẻ in trực quan (Live Preview) (5 cột) */}
          <div className="flex flex-col justify-between rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-white/40 to-secondary/5 p-4 shadow-sm lg:col-span-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="label-caps text-[11px] font-bold text-primary">
                  👁️ Xem trước thẻ in thực tế
                </span>
                <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Live Preview
                </span>
              </div>

              {/* Thẻ mô phỏng */}
              <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-primary/60 bg-white/90 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between border-b border-ink/10 pb-2">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-primary">
                    🏢 {voucherSettings.locationName || 'Quán Cafe / Khách Sạn'}
                  </div>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary-deep">
                    VOUCHER
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-ink-soft">📶 Sóng WiFi:</span>
                    <span className="font-bold text-ink">{voucherSettings.ssid || 'WIFI_HOTSPOT'}</span>
                  </div>

                  {voucherSettings.loginUrl && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-ink-soft">🌐 Trang đăng nhập:</span>
                      <span className="font-mono font-semibold text-tertiary">{voucherSettings.loginUrl}</span>
                    </div>
                  )}

                  <div className="my-2 border-t border-dashed border-ink/15" />

                  <div className="flex items-center justify-between rounded-lg bg-primary-soft/60 px-2.5 py-1.5">
                    <span className="text-xs font-bold text-ink-soft">👤 Tài khoản:</span>
                    <span className="font-mono text-sm font-extrabold text-primary-deep">
                      {voucherSettings.sampleUser || 'khach'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-primary-soft/60 px-2.5 py-1.5">
                    <span className="text-xs font-bold text-ink-soft">🔑 Mật khẩu:</span>
                    <span className="font-mono text-sm font-extrabold text-primary-deep">
                      {voucherSettings.samplePassword || 'khongchiase'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-ink-soft">
                    <span>⏱️ Thời hạn:</span>
                    <span className="font-semibold text-ink">{userUptimeDisplay}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-ink-soft">
                    <span>📊 Dung lượng:</span>
                    <span className="font-semibold text-ink">{userBytesDisplay}</span>
                  </div>

                  {userProfileDisplay && (
                    <div className="flex items-center justify-between text-[11px] text-ink-soft">
                      <span>📦 Gói hồ sơ:</span>
                      <span className="font-bold text-primary">{userProfileDisplay}</span>
                    </div>
                  )}

                  {voucherSettings.hotline && (
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-ink-soft">📞 Hotline:</span>
                      <span className="font-bold text-secondary">{voucherSettings.hotline}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-dashed border-ink/10 pt-2 text-center text-[10px] italic text-ink-faint">
                  {voucherSettings.footerText || 'Chúc quý khách trải nghiệm mạng tốc độ cao vui vẻ!'}
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] text-ink-soft">
              💡 Định dạng trên sẽ áp dụng tự động khi bạn bấm <b>In thẻ WiFi</b> tại trang Người dùng.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Sao lưu & Xuất cấu hình Router (RouterOS Backup & Export) */}
      <section className="glass rounded-2xl p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/40 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)]">
              💾
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Sao lưu & Xuất Cấu hình Router (Backup & Export)</h2>
              <p className="text-xs text-ink-faint">
                Tạo bản sao lưu toàn diện hoặc xuất tập lệnh cấu hình script (.rsc) để lưu trữ an toàn trên máy tính của bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadRouterBackups}
            disabled={loadingBackups}
            className="btn-ghost px-3.5 py-1.5 text-xs font-semibold"
            title="Làm mới danh sách file sao lưu từ Router"
          >
            {loadingBackups ? <Spinner size="sm" /> : '⟳'} Làm mới danh sách
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cột trái: Form cấu hình & Tạo bản sao lưu (5 cột) */}
          <form onSubmit={handleCreateBackup} className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-primary/20 bg-white/40 p-4 space-y-3.5">
              <span className="label-caps text-xs font-bold text-primary block">
                ⚙️ Chọn Phương thức Sao lưu:
              </span>

              {/* Lựa chọn Type 1: RSC Script */}
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                backupForm.type === 'rsc'
                  ? 'border-emerald-500/60 bg-emerald-500/10 shadow-sm'
                  : 'border-white/50 bg-white/30 hover:bg-white/50'
              }`}>
                <input
                  type="radio"
                  name="backupType"
                  value="rsc"
                  checked={backupForm.type === 'rsc'}
                  onChange={() => setBackupForm({ ...backupForm, type: 'rsc' })}
                  className="mt-1"
                />
                <div>
                  <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <span>📄 Xuất Tập lệnh Cấu hình (.rsc)</span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600">Khuyên dùng</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    Tập lệnh CLI dạng văn bản. Tự động tải về máy tính cá nhân, có thể xem trước và khôi phục trên mọi dòng router MikroTik.
                  </p>
                </div>
              </label>

              {/* Lựa chọn Type 2: Binary Backup */}
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                backupForm.type === 'backup'
                  ? 'border-primary/60 bg-primary/10 shadow-sm'
                  : 'border-white/50 bg-white/30 hover:bg-white/50'
              }`}>
                <input
                  type="radio"
                  name="backupType"
                  value="backup"
                  checked={backupForm.type === 'backup'}
                  onChange={() => setBackupForm({ ...backupForm, type: 'backup' })}
                  className="mt-1"
                />
                <div>
                  <div className="text-xs font-bold text-ink">
                    📦 Bản sao lưu Nhị phân Hệ thống (.backup)
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    Bản sao lưu nhị phân đầy đủ RouterOS (gồm cấu hình, chứng chỉ, mật khẩu). Lưu trên bộ nhớ Router để khôi phục nhanh.
                  </p>
                </div>
              </label>

              {/* Tên file sao lưu */}
              <label className="block pt-1">
                <span className="label-caps mb-1 block text-xs">📝 Tên file sao lưu</span>
                <input
                  id="backup-file-name"
                  name="backupFileName"
                  className="input-ghost w-full font-mono px-3 py-2 text-xs font-bold text-ink"
                  value={backupForm.name}
                  onChange={(e) => setBackupForm({ ...backupForm, name: e.target.value })}
                  placeholder="vd: mikrotik_backup_2026"
                />
              </label>

              {/* Tùy chọn chi tiết theo loại */}
              {backupForm.type === 'rsc' ? (
                <div className="space-y-2 pt-1 border-t border-ink/10 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backupForm.showSensitive}
                      onChange={(e) => setBackupForm({ ...backupForm, showSensitive: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-ink-soft font-medium">Bao gồm mật khẩu nhạy cảm (show-sensitive)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backupForm.compact}
                      onChange={(e) => setBackupForm({ ...backupForm, compact: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-ink-soft font-medium">Chỉ xuất cấu hình tùy biến (compact)</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-2 pt-1 border-t border-ink/10 text-xs">
                  <label className="block">
                    <span className="label-caps mb-1 block text-[11px]">Mật khẩu mã hóa bảo vệ (Tùy chọn)</span>
                    <input
                      type="password"
                      className="input-ghost w-full px-3 py-1.5 text-xs font-mono"
                      value={backupForm.password}
                      onChange={(e) => setBackupForm({ ...backupForm, password: e.target.value })}
                      placeholder="Để trống nếu không đặt mật khẩu"
                    />
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={backupBusy}
                className="btn-primary w-full py-2.5 text-xs font-bold shadow-md"
              >
                {backupBusy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" /> Đang xử lý sao lưu RouterOS…
                  </span>
                ) : backupForm.type === 'rsc' ? (
                  '💾 Xuất & Tải về Máy tính (.rsc)'
                ) : (
                  '💾 Tạo Bản sao lưu trên Router (.backup)'
                )}
              </button>
            </div>
          </form>

          {/* Cột phải: Danh sách các bản sao lưu đang lưu trên Router (7 cột) */}
          <div className="flex flex-col justify-between rounded-xl border border-white/50 bg-white/30 p-4 lg:col-span-7">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="label-caps text-xs font-bold text-ink">
                  📁 Danh sách File Sao lưu trên Router ({routerBackups.length})
                </span>
                <span className="text-[11px] text-ink-faint">Đồng bộ từ /file</span>
              </div>

              {loadingBackups ? (
                <div className="py-8 text-center">
                  <Spinner label="Đang tải danh sách file sao lưu từ Router…" />
                </div>
              ) : routerBackups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink/20 py-8 text-center text-xs text-ink-faint">
                  Chưa có bản sao lưu nào trên Router. Bạn có thể bấm nút tạo bên cạnh để xuất cấu hình ngay.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {routerBackups.map((f) => (
                    <div
                      key={f.id || f.name}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/60 bg-white/60 p-3 shadow-xs transition hover:bg-white"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
                          f.type === 'rsc' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/15 text-primary'
                        }`}>
                          {f.type === 'rsc' ? '📄' : '📦'}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs font-bold text-ink" title={f.name}>
                            {f.name}
                          </div>
                          <div className="text-[10px] text-ink-faint">
                            {formatBytes(f.size)} · {f.lastModified || '—'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {f.type === 'rsc' && f.contents && (
                          <button
                            type="button"
                            onClick={() => handlePreviewFile(f)}
                            className="btn-ghost px-2 py-1 text-[11px] font-semibold text-primary"
                            title="Xem trước nội dung script"
                          >
                            👁️ Xem
                          </button>
                        )}
                        {f.type === 'rsc' && f.contents && (
                          <button
                            type="button"
                            onClick={() => handleDownloadExistingFile(f)}
                            className="btn-ghost px-2 py-1 text-[11px] font-semibold text-emerald-600"
                            title="Tải file về máy tính của bạn"
                          >
                            ⬇️ Tải về
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRouterBackup(f)}
                            disabled={deletingBackupId === f.id}
                            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-50 transition"
                            title="Xóa file khỏi Router"
                          >
                            {deletingBackupId === f.id ? '…' : '🗑️'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 rounded-lg bg-primary-soft/40 p-2.5 text-[11px] text-ink-soft">
              💡 <b>Lưu ý:</b> File <code>.rsc</code> có thể mở trực tiếp bằng Notepad/VSCode hoặc nạp lại vào MikroTik qua lệnh <code>/import file={'{ten_file}'}.rsc</code>.
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Trạng thái & Kết nối MikroTik Router */}
        <section className="glass rounded-2xl p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-white/40 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                🖥️
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Kết nối MikroTik Router</h2>
                <p className="text-xs text-ink-faint">RouterOS 7 REST API Endpoint</p>
              </div>
            </div>
            {healthData?.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <span className="neon-dot h-2 w-2" />
                Đang kết nối ({healthData.latencyMs}ms)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger">
                <span className="h-2 w-2 rounded-full bg-danger" />
                Mất kết nối
              </span>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-white/40 px-3.5 py-2.5">
              <span className="text-xs font-medium text-ink-soft">Địa chỉ Host Router:</span>
              <span className="font-mono text-xs font-semibold text-ink">
                {healthData?.mikrotik?.host || '192.168.20.1'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/40 px-3.5 py-2.5">
              <span className="text-xs font-medium text-ink-soft">REST Base URL:</span>
              <span className="font-mono text-xs font-semibold text-ink">
                {healthData?.mikrotik?.restBase || 'http://192.168.20.1:80/rest'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/40 px-3.5 py-2.5">
              <span className="text-xs font-medium text-ink-soft">Tài khoản REST API:</span>
              <span className="font-mono text-xs font-semibold text-ink">
                {healthData?.mikrotik?.user || 'user_api'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/40 px-3.5 py-2.5">
              <span className="text-xs font-medium text-ink-soft">Xác thực Dashboard:</span>
              <span className="text-xs font-semibold text-primary">
                Trực tiếp MikroTik RouterOS (/user)
              </span>
            </div>
          </div>

          {/* Lệnh bật REST API */}
          <div className="mt-5 rounded-xl border border-white/60 bg-ink/5 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="label-caps text-[11px] text-ink-soft">
                Lệnh cấu hình MikroTik WinBox CLI:
              </span>
              <button
                onClick={copyCliScript}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {copiedScript ? '✓ Đã chép' : 'Sao chép'}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-ink/80 p-2.5 font-mono text-[11px] leading-relaxed text-cyan-300">
              {routerCliScript}
            </pre>
          </div>
        </section>

        {/* 3. Tài khoản Quản trị & Bảo mật */}
        <section className="glass rounded-2xl p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5 border-b border-white/40 pb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tertiary/15 text-tertiary">
              🔒
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Bảo mật & Tài khoản hiện tại</h2>
              <p className="text-xs text-ink-faint">Thông tin phiên đăng nhập đang hoạt động</p>
            </div>
          </div>

          <div className="space-y-3.5 text-sm">
            <div className="rounded-xl bg-white/40 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-ink">{fullName || user || 'admin'}</div>
                  <div className="font-mono text-xs text-ink-soft">Tên đăng nhập: {user}</div>
                </div>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    role === 'admin'
                      ? 'bg-primary/15 text-primary'
                      : role === 'operator'
                      ? 'bg-warning/15 text-warning'
                      : 'bg-tertiary/15 text-tertiary'
                  }`}
                >
                  {role === 'admin'
                    ? 'Quản trị viên'
                    : role === 'operator'
                    ? 'Nhân viên'
                    : 'Giám sát'}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary-soft/20 p-3.5 text-xs text-ink-soft">
              <span className="font-bold text-primary">💡 Quyền hạn của bạn:</span>{' '}
              {role === 'admin'
                ? 'Bạn có toàn quyền quản trị router, thay đổi cấu hình, cấp voucher và quản lý danh sách tài khoản.'
                : role === 'operator'
                ? 'Bạn có quyền tạo người dùng hotspot, gia hạn thời gian, in thẻ WiFi voucher và ngắt phiên kết nối.'
                : 'Bạn đang ở chế độ Giám sát (Chỉ xem) dữ liệu, không thể thực hiện các thao tác thêm, sửa, xóa.'}
            </div>
          </div>
        </section>

        {/* 4. Thông tin Phiên bản & Hệ thống */}
        <section className="glass col-span-1 lg:col-span-2 rounded-2xl p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5 border-b border-white/40 pb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              ℹ️
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Thông tin Hệ thống</h2>
              <p className="text-xs text-ink-faint">Phiên bản & Công nghệ phát triển</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-xl bg-white/40 p-3">
              <div className="text-ink-faint">Giao diện (Frontend)</div>
              <div className="mt-1 font-bold text-ink">React 19 · Vite 8</div>
            </div>
            <div className="rounded-xl bg-white/40 p-3">
              <div className="text-ink-faint">Thiết kế (Design)</div>
              <div className="mt-1 font-bold text-primary">Neon Glass Light</div>
            </div>
            <div className="rounded-xl bg-white/40 p-3">
              <div className="text-ink-faint">Máy chủ Proxy & RBAC</div>
              <div className="mt-1 font-bold text-ink">Express 5 · 3 Cấp Quyền</div>
            </div>
            <div className="rounded-xl bg-white/40 p-3">
              <div className="text-ink-faint">Giao thức Realtime</div>
              <div className="mt-1 font-bold text-ink">Server-Sent Events (SSE)</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/40 px-3.5 py-2.5 text-xs text-ink-soft">
            <span>Tương thích MikroTik:</span>
            <span className="font-semibold text-primary">RouterOS 7.x (REST API)</span>
          </div>
        </section>
      </div>

      {/* Modal Thêm / Sửa tài khoản MikroTik RouterOS */}
      <Modal
        open={userModalOpen}
        title={editingUser ? `Sửa tài khoản MikroTik "${editingUser.username}"` : 'Thêm tài khoản MikroTik RouterOS mới'}
        onClose={() => setUserModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Hủy
            </button>
            <button
              onClick={handleSaveUser}
              disabled={userFormBusy}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {userFormBusy ? 'Đang lưu…' : editingUser ? 'Cập nhật' : 'Tạo tài khoản'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          {userFormError && (
            <div className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger">
              {userFormError}
            </div>
          )}

          <label className="block">
            <span className="label-caps mb-1.5 block text-xs">Tên đăng nhập *</span>
            <input
              id="admin-user-username"
              name="adminUsername"
              className="input-underline w-full px-3 py-2 text-sm"
              value={userForm.username}
              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
              placeholder="vd: le_tan_01"
              disabled={!!editingUser}
              autoFocus={!editingUser}
            />
          </label>

          <label className="block">
            <span className="label-caps mb-1.5 block text-xs">
              {editingUser ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu *'}
            </span>
            <input
              id="admin-user-password"
              name="adminPassword"
              type="password"
              className="input-underline w-full px-3 py-2 text-sm"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              placeholder={editingUser ? '••••••••' : 'Nhập mật khẩu'}
            />
          </label>

          <label className="block">
            <span className="label-caps mb-1.5 block text-xs">Ghi chú / Tên hiển thị</span>
            <input
              id="admin-user-fullname"
              name="adminFullName"
              className="input-underline w-full px-3 py-2 text-sm"
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
              placeholder="vd: Nguyễn Văn A (Lễ tân)"
            />
          </label>

          <label className="block">
            <span className="label-caps mb-1.5 block text-xs">Nhóm quyền MikroTik (Group) *</span>
            <select
              id="admin-user-group"
              name="adminGroup"
              className="input-ghost w-full px-3 py-2.5 text-sm font-medium"
              value={userForm.group}
              onChange={(e) => setUserForm({ ...userForm, group: e.target.value })}
            >
              <option value="full">👑 full — Quản trị viên (Toàn quyền quản trị Router & Dashboard)</option>
              <option value="write">✍️ write — Nhân viên vận hành (Cấp voucher, gia hạn, ngắt kết nối)</option>
              <option value="read">👁️ read — Giám sát viên (Chỉ xem số liệu, không chỉnh sửa)</option>
            </select>
          </label>
        </form>
      </Modal>

      {/* Modal Xem trước nội dung Tập lệnh Script (.rsc) */}
      <Modal
        open={previewModalOpen}
        title={`📄 Nội dung Tập lệnh Cấu hình: ${previewData.filename}`}
        onClose={() => setPreviewModalOpen(false)}
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(previewData.contents);
                setCopiedPreview(true);
                toast.info('Đã sao chép toàn bộ mã script vào bộ nhớ tạm!', 'Đã sao chép');
                setTimeout(() => setCopiedPreview(false), 2500);
              }}
              className="btn-ghost px-3.5 py-2 text-xs font-semibold text-primary"
            >
              {copiedPreview ? '✓ Đã sao chép' : '📋 Sao chép mã'}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="btn-ghost px-4 py-2 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadTextFile(previewData.filename, previewData.contents);
                  toast.success(`Đã tải file "${previewData.filename}" về máy tính!`, 'Tải về thành công');
                }}
                className="btn-primary px-4 py-2 text-xs font-semibold"
              >
                ⬇️ Tải về máy tính (.rsc)
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-xs text-ink-soft">
            Dưới đây là toàn bộ mã lệnh cấu hình RouterOS dạng văn bản có thể nhập trực tiếp vào terminal WinBox:
          </p>
          <pre className="max-h-96 overflow-auto rounded-xl bg-ink/90 p-3.5 font-mono text-xs leading-relaxed text-cyan-300 select-all border border-white/20">
            {previewData.contents || '# Không có nội dung.'}
          </pre>
        </div>
      </Modal>
    </div>
  );
}
