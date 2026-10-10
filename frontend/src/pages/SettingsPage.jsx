import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
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
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
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
  const systemSettingsRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');

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
        systemSettingsRef.current = data;
        if (data.voucher) {
          setVoucherSettings((prev) => {
            const next = { ...prev, ...data.voucher };
            lastSavedSnapshotRef.current = JSON.stringify(next);
            return next;
          });
        } else {
          lastSavedSnapshotRef.current = JSON.stringify(voucherSettings);
        }
        if (data.updatedAt) {
          try {
            setLastSavedTime(new Date(data.updatedAt).toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN'));
          } catch {}
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err.message);
    } finally {
      setHasLoadedInitial(true);
    }
  }, [language]);

  // Tự động lưu cấu hình khi người dùng chỉnh sửa (debounce 700ms, chỉ lưu khi có thay đổi thực sự)
  useEffect(() => {
    if (!hasLoadedInitial) return;
    const currentStr = JSON.stringify(voucherSettings);
    // Nếu dữ liệu chưa thay đổi so với snapshot đã lưu -> không lưu lại và không nháy trạng thái
    if (currentStr === lastSavedSnapshotRef.current) return;

    const timer = setTimeout(async () => {
      setSavingSettings(true);
      try {
        const payload = {
          ...(systemSettingsRef.current || {}),
          voucher: voucherSettings,
        };
        const res = await api.updateSettings(payload);
        if (res?.settings) {
          setSystemSettings(res.settings);
          systemSettingsRef.current = res.settings;
        }
        lastSavedSnapshotRef.current = currentStr;
        try {
          localStorage.setItem('hs_voucher_settings', currentStr);
        } catch {}
        setLastSavedTime(new Date().toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN'));
      } catch (err) {
        console.error('Auto-save error:', err.message);
      } finally {
        setSavingSettings(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [voucherSettings, hasLoadedInitial, language]);

  async function checkHealth(manual = false) {
    setLoadingHealth(true);
    try {
      const res = await api.health();
      setHealthData(res);
      if (manual) {
        if (res.connected) {
          toast.success(`MikroTik (${res.mikrotik?.host}) · ${res.latencyMs}ms`, t('common.success'));
        } else {
          toast.error(res.error || t('conn.cannotConnectRest'), t('conn.disconnected'));
        }
      }
    } catch (err) {
      setHealthData({ connected: false, error: err.message });
      if (manual) {
        toast.error(err.message, t('common.error'));
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
      console.error('Failed to load backup list:', err.message);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  async function handleCreateBackup(e) {
    if (e) e.preventDefault();
    if (!backupForm.name.trim()) {
      toast.warning(t('settings.backupFilenamePlaceholder'), t('common.warning'));
      return;
    }

    setBackupBusy(true);
    try {
      const res = await api.createRouterBackup(backupForm);
      if (res.type === 'rsc') {
        if (res.contents) {
          downloadTextFile(res.filename, res.contents);
          toast.success(
            `${res.filename}`,
            t('common.success')
          );
        } else {
          toast.success(`${res.filename}`, t('common.success'));
        }
      } else {
        try {
          await api.downloadRouterBackup(res.filename);
          toast.success(
            `${res.filename} (${formatBytes(res.size)})`,
            t('common.success')
          );
        } catch (dlErr) {
          toast.success(
            `${res.filename}`,
            t('common.success')
          );
        }
      }
      setBackupForm((prev) => ({ ...prev, name: generateDefaultBackupName() }));
      loadRouterBackups();
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setBackupBusy(false);
    }
  }

  function handlePreviewFile(file) {
    if (!file.contents) {
      toast.info('Binary (.backup) files cannot be previewed in plain text. Please view .rsc files.', t('common.info'));
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
        toast.success(`${file.name}`, t('common.download'));
      } else {
        await api.downloadRouterBackup(file.name);
        toast.success(`${file.name}`, t('common.download'));
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, t('common.error'));
    }
  }

  async function handleDeleteRouterBackup(file) {
    if (!window.confirm(t('settings.deleteBackupConfirm', { name: file.name }))) {
      return;
    }
    setDeletingBackupId(file.id);
    try {
      await api.deleteRouterBackup(file.id);
      toast.success(file.name, t('common.delete'));
      loadRouterBackups();
    } catch (err) {
      toast.error(err.message, t('common.error'));
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
      console.error('Failed to load hotspot users:', err.message);
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
      const uptimeStr = target['limit-uptime'] ? formatDuration(target['limit-uptime'], language) : t('common.unlimited');
      const bytesStr = target['limit-bytes-total'] ? formatBytes(target['limit-bytes-total']) : t('common.unlimited');
      setVoucherSettings((prev) => ({
        ...prev,
        sampleUser: newUser,
        samplePassword: newPass,
        sampleUptime: uptimeStr,
        sampleBytes: bytesStr,
        sampleProfile: target.profile || '',
      }));
      toast.success(
        t('settings.autoFilledSuccess', { name: newUser }),
        t('common.info')
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
      toast.error(err.message, t('common.error'));
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin, toast, t]);

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
        ...(systemSettingsRef.current || systemSettings || {}),
        voucher: voucherSettings,
      };
      const res = await api.updateSettings(payload);
      if (res?.settings) {
        setSystemSettings(res.settings);
        systemSettingsRef.current = res.settings;
      }
      const currentStr = JSON.stringify(voucherSettings);
      lastSavedSnapshotRef.current = currentStr;
      try {
        localStorage.setItem('hs_voucher_settings', currentStr);
      } catch {}
      const timeStr = new Date().toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN');
      setLastSavedTime(timeStr);
      toast.success(t('settings.savedToServer', { time: timeStr }), t('common.save'));
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setSavingSettings(false);
    }
  }

  async function printSampleCard() {
    const v = voucherSettings;
    const active = hotspotUsers.find((u) => u.name === v.sampleUser);
    const uptimeText = active?.['limit-uptime']
      ? formatDuration(active['limit-uptime'], language)
      : (v.sampleUptime || t('common.unlimited'));
    const bytesText = active?.['limit-bytes-total']
      ? formatBytes(active['limit-bytes-total'])
      : (v.sampleBytes || t('common.unlimited'));
    const profileText = active?.profile || v.sampleProfile || '';

    try {
      await api.updateSettings({
        ...(systemSettings || {}),
        voucher: v,
      });
      setLastSavedTime(new Date().toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN'));
    } catch {}

    const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${t('settings.printHeaderTitle', { name: escapeHtml(v.locationName || 'MikroTik') })}</title>
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
      <h2>${t('settings.printHeaderTitle', { name: escapeHtml(v.locationName || 'Hotspot') })}</h2>
      <div class="grid">
        <div class="card">
          ${v.locationName ? `<div class="location">🏢 ${escapeHtml(v.locationName)}</div>` : ''}
          <div class="ssid">📶 ${t('settings.wifiSsidLabel')} <b>${escapeHtml(v.ssid || 'WIFI_HOTSPOT')}</b></div>
          ${v.loginUrl ? `<div class="login-url">🌐 ${t('settings.loginAtLabel')} <b>${escapeHtml(v.loginUrl)}</b></div>` : ''}
          <div class="divider"></div>
          <div class="row"><span>👤 ${t('settings.userLabel')}</span><b class="highlight">${escapeHtml(v.sampleUser || 'khach')}</b></div>
          <div class="row"><span>🔑 ${t('settings.passLabel')}</span><b class="highlight">${escapeHtml(v.samplePassword || 'khongchiase')}</b></div>
          <div class="row"><span>⏱️ ${t('settings.uptimeLabel')}</span><b>${escapeHtml(uptimeText)}</b></div>
          <div class="row"><span>📊 ${t('settings.bytesLabel')}</span><b>${escapeHtml(bytesText)}</b></div>
          ${profileText ? `<div class="row"><span>📦 ${t('settings.profileLabel')}</span><b>${escapeHtml(profileText)}</b></div>` : ''}
          ${v.hotline ? `<div class="row hotline"><span>📞 ${t('settings.hotlineLabel')}</span><b>${escapeHtml(v.hotline)}</b></div>` : ''}
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
    toast.info(t('settings.printSampleBtn'), t('common.info'));
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
      setUserFormError(t('settings.fieldAccountName'));
      return;
    }
    if (!editingUser && !userForm.password) {
      setUserFormError(t('settings.fieldAccountPass'));
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
        toast.success(`"${editingUser.username}"`, t('common.update'));
      } else {
        await api.createAdminUser({
          username: userForm.username.trim(),
          password: userForm.password,
          group: userForm.group,
          fullName: userForm.fullName.trim(),
        });
        toast.success(`"${userForm.username}"`, t('common.create'));
      }
      setUserModalOpen(false);
      loadDashboardUsers();
    } catch (err) {
      setUserFormError(err.message);
      toast.error(err.message, t('common.error'));
    } finally {
      setUserFormBusy(false);
    }
  }

  async function handleDeleteUser(u) {
    if (u.group === 'full' || u.role === 'admin') {
      toast.warning('Admin full group account is protected!', t('common.warning'));
      return;
    }
    if (u.username === user) {
      toast.warning('Cannot delete your own current account!', t('common.warning'));
      return;
    }
    if (!window.confirm(t('settings.deleteAccountConfirm', { name: u.username }))) {
      return;
    }
    setBusyUserId(u.id);
    try {
      await api.deleteAdminUser(u.id);
      toast.success(u.username, t('common.delete'));
      loadDashboardUsers();
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setBusyUserId(null);
    }
  }

  const routerCliScript = `# MikroTik RouterOS 7 REST API Setup
/ip/service set www disabled=no port=80
/ip/service set www-ssl disabled=no port=443

# Create dedicated admin account for Dashboard
/user add name=user_api group=full password="<STRONG_PASSWORD>" comment="Hotspot Dashboard API"`;

  function copyCliScript() {
    navigator.clipboard.writeText(routerCliScript);
    setCopiedScript(true);
    toast.info(t('settings.copiedCliBtn'), t('common.copied'));
    setTimeout(() => setCopiedScript(false), 3000);
  }

  const activeUser = hotspotUsers.find(
    (u) => u.name === voucherSettings.sampleUser || (selectedHotspotUser && u.name === selectedHotspotUser)
  );
  const userUptimeDisplay = activeUser?.['limit-uptime']
    ? formatDuration(activeUser['limit-uptime'], language)
    : (voucherSettings.sampleUptime || t('common.unlimited'));
  const userBytesDisplay = activeUser?.['limit-bytes-total']
    ? formatBytes(activeUser['limit-bytes-total'])
    : (voucherSettings.sampleBytes || t('common.unlimited'));
  const userProfileDisplay = activeUser?.profile || voucherSettings.sampleProfile || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sk-topbar flex-wrap">
        <div>
          <h1 className="sk-title">{t('settings.title')}</h1>
          <p className="sk-subtitle font-mono">
            {t('settings.subtitle')}
          </p>
        </div>
        <button
          onClick={() => checkHealth(true)}
          disabled={loadingHealth}
          className="btn btn-secondary btn-sm"
        >
          {loadingHealth ? <Spinner size="xs" /> : '⚡'} {t('common.refresh')}
        </button>
      </div>

      {/* 0. Cấu hình Ngôn ngữ & Giao diện (Language & Appearance) */}
      <section className="sk-card">
        <div className="mb-4 border-b border-[var(--border-soft)] pb-3">
          <h2 className="text-base font-bold text-[var(--text)]">{t('settings.langAndThemeTitle')}</h2>
          <p className="font-mono text-xs text-[var(--text-faint)] mt-0.5">
            {t('settings.langAndThemeDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ngôn ngữ hiển thị */}
          <div className="space-y-2">
            <label className="form-label">{t('settings.selectLanguage')}</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`flex items-center justify-between p-3 rounded-[var(--radius-sm)] border transition-all ${
                  language === 'vi'
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] shadow-[0_0_12px_var(--accent-glow)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🇻🇳</span>
                  <div className="text-left">
                    <div className={`text-xs font-semibold ${language === 'vi' ? 'text-[var(--accent-bright)]' : 'text-[var(--text)]'}`}>
                      Tiếng Việt
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">{t('settings.langViDesc')}</div>
                  </div>
                </div>
                {language === 'vi' && <span className="text-[var(--accent-bright)] text-xs font-bold">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex items-center justify-between p-3 rounded-[var(--radius-sm)] border transition-all ${
                  language === 'en'
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] shadow-[0_0_12px_var(--accent-glow)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🇬🇧</span>
                  <div className="text-left">
                    <div className={`text-xs font-semibold ${language === 'en' ? 'text-[var(--accent-bright)]' : 'text-[var(--text)]'}`}>
                      English
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">{t('settings.langEnDesc')}</div>
                  </div>
                </div>
                {language === 'en' && <span className="text-[var(--accent-bright)] text-xs font-bold">✓</span>}
              </button>
            </div>
          </div>

          {/* Chủ đề giao diện */}
          <div className="space-y-2">
            <label className="form-label">{t('settings.selectTheme')}</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-between p-3 rounded-[var(--radius-sm)] border transition-all ${
                  theme === 'dark'
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] shadow-[0_0_12px_var(--accent-glow)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🌙</span>
                  <div className="text-left">
                    <div className={`text-xs font-semibold ${theme === 'dark' ? 'text-[var(--accent-bright)]' : 'text-[var(--text)]'}`}>
                      Dark Theme
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">{t('settings.themeDarkDesc')}</div>
                  </div>
                </div>
                {theme === 'dark' && <span className="text-[var(--accent-bright)] text-xs font-bold">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center justify-between p-3 rounded-[var(--radius-sm)] border transition-all ${
                  theme === 'light'
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] shadow-[0_0_12px_var(--accent-glow)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">☀️</span>
                  <div className="text-left">
                    <div className={`text-xs font-semibold ${theme === 'light' ? 'text-[var(--accent-bright)]' : 'text-[var(--text)]'}`}>
                      Light Theme
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">{t('settings.themeLightDesc')}</div>
                  </div>
                </div>
                {theme === 'light' && <span className="text-[var(--accent-bright)] text-xs font-bold">✓</span>}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 1. Quản lý tài khoản MikroTik System Users (/user) */}
      {isAdmin && (
        <section className="sk-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">{t('settings.systemAccountsTitle')}</h2>
              <p className="font-mono text-xs text-[var(--text-faint)]">
                {t('settings.systemAccountsDesc')}
              </p>
            </div>
            <button
              onClick={openCreateUserModal}
              className="btn btn-primary btn-sm"
            >
              {t('settings.addAccountBtn')}
            </button>
          </div>

          {loadingUsers ? (
            <Spinner label={t('common.loading')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="sk-dtable">
                <thead>
                  <tr>
                    <th>{t('settings.colAccount')}</th>
                    <th>{t('settings.colFullname')}</th>
                    <th>{t('settings.colMtikGroup')}</th>
                    <th>{t('settings.colConsoleRole')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardUsers.map((u) => (
                    <tr key={u.id || u.username}>
                      <td className="font-mono font-bold">
                        {u.username}
                        {u.username === user && (
                          <span className="sk-state sk-state--accent ml-2 text-[9px]">{t('common.you')}</span>
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
                            ? t('auth.roleAdmin')
                            : u.group === 'write' || u.role === 'operator'
                            ? t('auth.roleOperator')
                            : t('auth.roleViewer')}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                          <button
                            onClick={() => openEditUserModal(u)}
                            className="btn btn-secondary btn-sm h-7 px-2 text-[11px]"
                          >
                            {t('common.edit')}
                          </button>
                          {u.username !== user && u.group !== 'full' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={busyUserId === u.id}
                              className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)]"
                            >
                              {busyUserId === u.id ? '…' : t('common.delete')}
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
            <h2 className="text-base font-bold text-[var(--text)]">{t('settings.voucherTitle')}</h2>
            <p className="font-mono text-xs text-[var(--text-faint)]">
              {t('settings.voucherDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={printSampleCard}
            className="btn btn-secondary btn-sm"
          >
            {t('settings.printSampleBtn')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Form cấu hình */}
          <form onSubmit={handleSaveVoucherSettings} className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-3 py-2 text-xs font-mono">
              <span className="text-[var(--text-dim)]">📁 {t('settings.saveStatus')}</span>
              {savingSettings ? (
                <span className="text-[var(--amber)] font-semibold">{t('settings.savingToJson')}</span>
              ) : lastSavedTime ? (
                <span className="text-[var(--green)] font-semibold">{t('settings.savedToServer', { time: lastSavedTime })}</span>
              ) : (
                <span className="text-[var(--text-faint)]">{t('settings.readyStatus')}</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label">{t('settings.locationName')}</label>
                <input
                  id="voucher-location-name"
                  name="locationName"
                  className="form-input text-xs"
                  value={voucherSettings.locationName || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, locationName: e.target.value })
                  }
                  placeholder={t('settings.locationPlaceholder')}
                />
              </div>

              <div>
                <label className="form-label">{t('settings.ssid')}</label>
                <input
                  id="voucher-ssid"
                  name="ssid"
                  className="form-input text-xs"
                  value={voucherSettings.ssid || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, ssid: e.target.value })
                  }
                  placeholder={t('settings.ssidPlaceholder')}
                />
              </div>
            </div>

            {/* Chọn user hotspot router */}
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="form-label mb-0 text-[10px] text-[var(--accent-bright)]">
                  {t('settings.selectUserFromRouter')}
                </span>
                <button
                  type="button"
                  onClick={loadHotspotUsers}
                  disabled={loadingHotspotUsers}
                  className="btn btn-ghost btn-sm h-6 px-1.5 text-[10px]"
                >
                  {loadingHotspotUsers ? <Spinner size="xs" /> : '⟳'} {t('settings.reloadBtn')}
                </button>
              </div>

              <CustomSelect
                id="select-hotspot-user"
                aria-label={t('settings.selectUserFromRouter')}
                className="w-full"
                buttonClassName="font-mono text-xs h-8"
                placeholder={
                  loadingHotspotUsers
                    ? t('settings.loadingUserList')
                    : hotspotUsers.length === 0
                    ? t('settings.noUsersOnRouter')
                    : t('settings.selectUserCount', { count: hotspotUsers.length })
                }
                searchable={hotspotUsers.length > 4}
                value={
                  selectedHotspotUser ||
                  (hotspotUsers.find((u) => u.name === voucherSettings.sampleUser)?.name || '')
                }
                onChange={handleSelectHotspotUser}
                options={hotspotUsers.map((u) => ({
                  value: u.name,
                  label: `${u.name} (Pass: ${u.password ? u.password : t('common.empty')})`,
                  badge: u.profile || 'default',
                }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label">{t('settings.loginUrl')}</label>
                <input
                  id="voucher-login-url"
                  name="loginUrl"
                  className="form-input text-xs"
                  value={voucherSettings.loginUrl || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, loginUrl: e.target.value })
                  }
                  placeholder={t('settings.loginUrlPlaceholder')}
                />
              </div>

              <div>
                <label className="form-label">{t('settings.hotline')}</label>
                <input
                  id="voucher-hotline"
                  name="hotline"
                  className="form-input text-xs"
                  value={voucherSettings.hotline || ''}
                  onChange={(e) =>
                    setVoucherSettings({ ...voucherSettings, hotline: e.target.value })
                  }
                  placeholder={t('settings.hotlinePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="form-label">{t('settings.footerText')}</label>
              <input
                id="voucher-footer"
                name="footerText"
                className="form-input text-xs"
                value={voucherSettings.footerText || ''}
                onChange={(e) =>
                  setVoucherSettings({ ...voucherSettings, footerText: e.target.value })
                }
                placeholder={t('settings.footerPlaceholder')}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="btn btn-primary btn-sm"
              >
                {savingSettings ? t('common.saving') : t('settings.saveConfigNow')}
              </button>
              <button
                type="button"
                onClick={printSampleCard}
                className="btn btn-secondary btn-sm"
              >
                {t('settings.printOneCard')}
              </button>
            </div>
          </form>

          {/* Live Preview Card */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-5">
            <div className="text-[11px] font-mono text-[var(--text-faint)] uppercase tracking-wider mb-3">
              {t('settings.previewCard')}
            </div>

            <div className="w-full max-w-[280px] rounded-[var(--radius-sm)] border border-dashed border-[var(--accent)] bg-[var(--surface)] p-4 shadow-sm font-sans space-y-2 text-xs">
              {voucherSettings.locationName && (
                <div className="font-mono font-bold uppercase tracking-wider text-[var(--accent-bright)] text-xs">
                  🏢 {voucherSettings.locationName}
                </div>
              )}
              <div className="font-semibold text-[var(--text)]">
                📶 {t('settings.wifiSsidLabel')} <b>{voucherSettings.ssid || 'WIFI_HOTSPOT'}</b>
              </div>
              {voucherSettings.loginUrl && (
                <div className="font-mono text-[10px] text-[var(--cyan)]">
                  🌐 {voucherSettings.loginUrl}
                </div>
              )}
              <div className="border-t border-[var(--border-soft)] my-1.5" />
              <div className="flex justify-between font-mono">
                <span className="text-[var(--text-faint)]">👤 {t('settings.userLabel')}</span>
                <span className="font-bold text-[var(--text)] bg-[var(--surface-2)] px-1 rounded">
                  {voucherSettings.sampleUser || 'khach'}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[var(--text-faint)]">🔑 {t('settings.passLabel')}</span>
                <span className="font-bold text-[var(--text)] bg-[var(--surface-2)] px-1 rounded">
                  {voucherSettings.samplePassword || 'khongchiase'}
                </span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[var(--text-faint)]">⏱️ {t('settings.uptimeLabel')}</span>
                <span>{userUptimeDisplay}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[var(--text-faint)]">📊 {t('settings.bytesLabel')}</span>
                <span>{userBytesDisplay}</span>
              </div>
              {userProfileDisplay && (
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-[var(--text-faint)]">📦 {t('settings.profileLabel')}</span>
                  <span>{userProfileDisplay}</span>
                </div>
              )}
              {voucherSettings.hotline && (
                <div className="font-mono text-[10px] text-[var(--accent-bright)] mt-1">
                  📞 {t('settings.hotlineLabel')} {voucherSettings.hotline}
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
            <h2 className="text-base font-bold text-[var(--text)]">{t('settings.backupTitle')}</h2>
            <p className="font-mono text-xs text-[var(--text-faint)]">
              {t('settings.backupDesc')}
            </p>
          </div>
          <button
            onClick={loadRouterBackups}
            disabled={loadingBackups}
            className="btn btn-secondary btn-sm"
          >
            {loadingBackups ? <Spinner size="xs" /> : '⟳'} {t('settings.refreshBackupList')}
          </button>
        </div>

        {/* Form tạo sao lưu */}
        <form onSubmit={handleCreateBackup} className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)] p-4 space-y-3 mb-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="form-label">{t('settings.backupFilename')}</label>
              <input
                value={backupForm.name}
                onChange={(e) => setBackupForm({ ...backupForm, name: e.target.value })}
                className="form-input text-xs"
                placeholder={t('settings.backupFilenamePlaceholder')}
              />
            </div>

            <div className="w-48">
              <label className="form-label">{t('settings.exportFormat')}</label>
              <div className="sk-seg w-full">
                <button
                  type="button"
                  onClick={() => setBackupForm({ ...backupForm, type: 'rsc' })}
                  className={`sk-seg__btn flex-1 justify-center ${backupForm.type === 'rsc' ? 'is-on' : ''}`}
                >
                  {t('settings.backupTypeRsc')}
                </button>
                <button
                  type="button"
                  onClick={() => setBackupForm({ ...backupForm, type: 'backup' })}
                  className={`sk-seg__btn flex-1 justify-center ${backupForm.type === 'backup' ? 'is-on' : ''}`}
                >
                  {t('settings.backupTypeBin')}
                </button>
              </div>
            </div>

            <div className="self-end">
              <button
                type="submit"
                disabled={backupBusy}
                className="btn btn-primary btn-sm h-9"
              >
                {backupBusy ? t('settings.exportingBtn') : backupForm.type === 'rsc' ? t('settings.exportRscBtn') : t('settings.createBackupFileBtn')}
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
                  <span>{t('settings.showSensitiveOption')}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupForm.compact}
                    onChange={(e) => setBackupForm({ ...backupForm, compact: e.target.checked })}
                  />
                  <span>{t('settings.compactOption')}</span>
                </label>
              </>
            ) : (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupForm.dontEncrypt}
                  onChange={(e) => setBackupForm({ ...backupForm, dontEncrypt: e.target.checked })}
                />
                <span>{t('settings.dontEncryptOption')}</span>
              </label>
            )}
          </div>
        </form>

        {/* Bảng danh sách file sao lưu */}
        <div className="overflow-x-auto">
          <table className="sk-dtable">
            <thead>
              <tr>
                <th>{t('settings.colBackupName')}</th>
                <th>{t('settings.colBackupType')}</th>
                <th>{t('settings.colBackupSize')}</th>
                <th>{t('settings.colBackupDate')}</th>
                <th className="text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {routerBackups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-mono text-xs text-[var(--text-faint)]">
                    {t('settings.noBackups')}
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
                            {t('settings.previewScriptBtn')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadExistingFile(file)}
                          className="btn btn-primary btn-sm h-7 px-2 text-[11px]"
                        >
                          {t('settings.downloadBtn')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRouterBackup(file)}
                          disabled={deletingBackupId === file.id}
                          className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)]"
                        >
                          {deletingBackupId === file.id ? '…' : t('common.delete')}
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
            <h2 className="text-sm font-bold text-[var(--text)]">{t('settings.cliTitle')}</h2>
            <p className="font-mono text-xs text-[var(--text-faint)]">
              {t('settings.cliSubtitle')}
            </p>
          </div>
          <button
            onClick={copyCliScript}
            className="btn btn-secondary btn-sm font-mono text-xs"
          >
            {copiedScript ? t('settings.copiedCliBtn') : t('settings.copyCliBtn')}
          </button>
        </div>

        <pre className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--bg-code)] p-3.5 font-mono text-xs text-[var(--text-code)] leading-relaxed">
          {routerCliScript}
        </pre>
      </section>

      {/* Modal Quản lý User */}
      <Modal
        open={userModalOpen}
        title={editingUser ? t('settings.modalEditAccount', { name: editingUser.username }) : t('settings.modalCreateAccount')}
        onClose={() => setUserModalOpen(false)}
        footer={
          <>
            <button onClick={() => setUserModalOpen(false)} className="btn btn-secondary btn-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleSaveUser} disabled={userFormBusy} className="btn btn-primary btn-sm">
              {userFormBusy ? t('common.saving') : editingUser ? t('common.update') : t('common.create')}
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
            <label className="form-label">{t('settings.fieldAccountName')}</label>
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
              {t('settings.fieldAccountPass')} {editingUser ? t('settings.fieldAccountPassHint') : '*'}
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
            <label className="form-label">{t('settings.colFullname')}</label>
            <input
              className="form-input"
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
              placeholder="vd: Operator / Reception"
            />
          </div>

          <div>
            <label className="form-label">{t('settings.fieldAccountGroup')}</label>
            <CustomSelect
              className="w-full"
              value={userForm.group}
              onChange={(e) => setUserForm({ ...userForm, group: e.target.value })}
              options={[
                { value: 'write', label: t('settings.groupWriteOption') },
                { value: 'full', label: t('settings.groupFullOption') },
                { value: 'read', label: t('settings.groupReadOption') },
              ]}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Xem trước Script .rsc */}
      <Modal
        open={previewModalOpen}
        title={t('settings.modalPreviewTitle', { name: previewData.filename })}
        maxWidth="max-w-3xl"
        onClose={() => setPreviewModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => {
                navigator.clipboard.writeText(previewData.contents);
                setCopiedPreview(true);
                toast.info(t('settings.copiedScript'), t('common.copied'));
                setTimeout(() => setCopiedPreview(false), 3000);
              }}
              className="btn btn-secondary btn-sm"
            >
              {copiedPreview ? t('settings.copiedScript') : t('settings.copyScript')}
            </button>
            <button
              onClick={() => downloadTextFile(previewData.filename, previewData.contents)}
              className="btn btn-primary btn-sm"
            >
              {t('settings.downloadScriptFile')}
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
