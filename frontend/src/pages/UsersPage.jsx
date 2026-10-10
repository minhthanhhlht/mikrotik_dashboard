import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const EMPTY = {
  name: '',
  password: '',
  profile: '',
  'limit-uptime': '',
  'limit-bytes-total': '',
  comment: '',
  disabled: 'false',
};

const EMPTY_PROFILE = {
  name: '',
  'shared-users': '1',
  'rate-limit': '',
  'address-list': '',
  'idle-timeout': '',
  'keepalive-timeout': '',
  'mac-cookie-timeout': '',
  'add-mac-cookie': 'true',
};

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-mono text-[var(--text-faint)]">{hint}</span>}
    </div>
  );
}

export default function UsersPage() {
  const { canManageUsers, canManageProfiles, isViewer } = useAuth();
  const { language, t } = useLanguage();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('users');

  // --- State Người dùng (Users) ---
  const [search, setSearch] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const { data: users = [], loading, error, reload } = useApi(api.users);
  const {
    data: profiles = [],
    loading: loadingProfiles,
    error: errorProfiles,
    reload: reloadProfiles,
  } = useApi(api.profiles);

  const profileNames = useMemo(() => profiles.map((p) => p.name), [profiles]);
  const profileOf = (u) => u.profile || 'default';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (profileFilter && profileOf(u) !== profileFilter) return false;
      if (!q) return true;
      const hay = `${u.name || ''} ${u.password || ''} ${u.comment || ''} ${u.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, search, profileFilter]);

  function toggleRevealPassword(id) {
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyPassword(pass, userName) {
    if (!pass) return;
    navigator.clipboard.writeText(pass);
    toast.success(t('users.copiedPass', { name: userName }), t('common.copied'));
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, profile: profileNames[0] || 'default' });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({
      name: u.name || '',
      password: u.password || '',
      profile: profileOf(u),
      'limit-uptime': u['limit-uptime'] || '',
      'limit-bytes-total': u['limit-bytes-total'] || '',
      comment: u.comment || '',
      disabled: u.disabled === 'true' ? 'true' : 'false',
    });
    setFormError('');
    setFormOpen(true);
  }

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // --- State & CRUD Quản lý Hồ sơ (Profiles) ---
  const [profileSearch, setProfileSearch] = useState('');
  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(null);
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [profileFormBusy, setProfileFormBusy] = useState(false);
  const [profileFormError, setProfileFormError] = useState('');
  const [profileBusyId, setProfileBusyId] = useState(null);
  const [deletingProfile, setDeletingProfile] = useState(null);
  const [createProfileForUserForm, setCreateProfileForUserForm] = useState(false);

  const filteredProfiles = useMemo(() => {
    const q = profileSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => `${p.name || ''}`.toLowerCase().includes(q));
  }, [profiles, profileSearch]);

  function openCreateProfile(forUserModal = false) {
    setCreateProfileForUserForm(forUserModal);
    setProfileEditing(null);
    setProfileForm({ ...EMPTY_PROFILE });
    setProfileFormError('');
    setProfileFormOpen(true);
  }

  function openEditProfile(p) {
    setCreateProfileForUserForm(false);
    setProfileEditing(p);
    setProfileForm({
      name: p.name || '',
      'shared-users': p['shared-users'] || '1',
      'rate-limit': p['rate-limit'] || '',
      'address-list': p['address-list'] || '',
      'idle-timeout': p['idle-timeout'] || '',
      'keepalive-timeout': p['keepalive-timeout'] || '',
      'mac-cookie-timeout': p['mac-cookie-timeout'] || '',
      'add-mac-cookie': p['add-mac-cookie'] ?? 'true',
    });
    setProfileFormError('');
    setProfileFormOpen(true);
  }

  const setProfileField = (field, value) => setProfileForm((f) => ({ ...f, [field]: value }));

  async function handleSubmitProfile(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!profileForm.name.trim()) {
      setProfileFormError(t('profiles.fieldName'));
      return;
    }
    setProfileFormBusy(true);
    setProfileFormError('');
    try {
      const body = {
        ...profileForm,
        name: profileForm.name.trim(),
        'add-mac-cookie': profileForm['add-mac-cookie'] === 'true' ? 'true' : 'false',
      };
      Object.keys(body).forEach((k) => {
        if (body[k] === undefined || body[k] === null || body[k] === '') delete body[k];
      });
      if (profileEditing) {
        delete body.name;
        await api.updateProfile(profileEditing['.id'], body);
        toast.success(profileEditing.name, t('common.update'));
      } else {
        await api.createProfile(body);
        toast.success(body.name, t('common.create'));
        if (createProfileForUserForm) {
          set('profile', body.name);
        }
      }
      setProfileFormOpen(false);
      reloadProfiles();
    } catch (err) {
      setProfileFormError(err.message);
      toast.error(err.message, t('common.error'));
    } finally {
      setProfileFormBusy(false);
    }
  }

  async function handleDeleteProfileConfirm() {
    if (!deletingProfile) return;
    setProfileBusyId(deletingProfile['.id']);
    try {
      await api.deleteProfile(deletingProfile['.id']);
      toast.success(deletingProfile.name, t('common.delete'));
      setDeletingProfile(null);
      reloadProfiles();
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setProfileBusyId(null);
    }
  }

  // --- Chọn nhiều user & Thao tác hàng loạt ---
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [extending, setExtending] = useState(null);
  const [extendTime, setExtendTime] = useState('1h');
  const [extendBusy, setExtendBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isAllSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u['.id']));

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((u) => next.delete(u['.id']));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((u) => next.add(u['.id']));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleExtend() {
    if (!extending) return;
    setExtendBusy(true);
    try {
      await api.extendUser(extending['.id'], extendTime.trim());
      toast.success(`${extending.name} (+${extendTime.trim()})`, t('common.success'));
      setExtending(null);
      reload();
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setExtendBusy(false);
    }
  }

  async function handleReset(u) {
    if (!window.confirm(t('users.resetConfirm', { name: u.name }))) return;
    setBusyId(u['.id']);
    try {
      await api.resetUser(u['.id']);
      toast.success(u.name, t('common.success'));
      reload();
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const headers = ['name', 'password', 'profile', 'limit-uptime', 'limit-bytes-total', 'comment', 'disabled'];
    const rows = [headers.join(',')];
    for (const u of users) {
      rows.push(headers.map((h) => JSON.stringify(u[h] ?? '')).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hotspot-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.info(`${users.length} users exported to CSV`, t('users.exportCsv'));
  }

  async function printCards(customUsers = null) {
    const listToPrint = customUsers || users.filter((u) => selectedIds.has(u['.id']));
    if (!listToPrint || listToPrint.length === 0) {
      toast.warning('Please select at least 1 user to print cards!', t('common.warning'));
      return;
    }

    let voucher = {
      locationName: 'MikroTik Hotspot',
      ssid: 'WIFI_HOTSPOT',
      hotline: '',
      footerText: 'Enjoy high speed internet!',
    };
    try {
      const serverSettings = await api.getSettings();
      if (serverSettings?.voucher) {
        voucher = { ...voucher, ...serverSettings.voucher };
      } else {
        const saved = localStorage.getItem('hs_voucher_settings');
        if (saved) voucher = { ...voucher, ...JSON.parse(saved) };
      }
    } catch {
      try {
        const saved = localStorage.getItem('hs_voucher_settings');
        if (saved) voucher = { ...voucher, ...JSON.parse(saved) };
      } catch {}
    }

    const cards = listToPrint
      .map(
        (u) => `
          <div class="card">
            ${voucher.locationName ? `<div class="location">🏢 ${escapeHtml(voucher.locationName)}</div>` : ''}
            <div class="ssid">📶 ${t('settings.wifiSsidLabel')} <b>${escapeHtml(voucher.ssid || 'WIFI_HOTSPOT')}</b></div>
            ${voucher.loginUrl ? `<div class="login-url">🌐 ${t('settings.loginAtLabel')} <b>${escapeHtml(voucher.loginUrl)}</b></div>` : ''}
            <div class="divider"></div>
            <div class="row"><span>👤 ${t('settings.userLabel')}</span><b class="highlight">${escapeHtml(u.name || '')}</b></div>
            <div class="row"><span>🔑 ${t('settings.passLabel')}</span><b class="highlight">${escapeHtml(u.password || t('common.empty'))}</b></div>
            ${u['limit-uptime'] ? `<div class="row"><span>⏱️ ${t('settings.uptimeLabel')}</span><b>${escapeHtml(formatDuration(u['limit-uptime'], language))}</b></div>` : ''}
            ${u['limit-bytes-total'] ? `<div class="row"><span>📊 ${t('settings.bytesLabel')}</span><b>${escapeHtml(formatBytes(u['limit-bytes-total']))}</b></div>` : ''}
            ${voucher.hotline ? `<div class="row hotline"><span>📞 ${t('settings.hotlineLabel')}</span><b>${escapeHtml(voucher.hotline)}</b></div>` : ''}
            ${voucher.footerText ? `<div class="footer">${escapeHtml(voucher.footerText)}</div>` : ''}
          </div>`
      )
      .join('');
    const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>WiFi Cards - ${escapeHtml(voucher.locationName || 'MikroTik')}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background: #fff; color: #0f172a; }
        h2 { text-align: center; margin-bottom: 20px; font-size: 18px; font-weight: bold; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .card { border: 1.5px dashed #6d7cff; border-radius: 10px; padding: 14px 16px; break-inside: avoid; background: #f8fafc; }
        .location { font-size: 13px; font-weight: 700; color: #4954cc; text-transform: uppercase; letter-spacing: 0.5px; }
        .ssid { font-size: 13px; color: #1e293b; margin: 4px 0 6px 0; font-weight: 600; }
        .login-url { font-size: 11px; color: #6d7cff; margin-bottom: 6px; font-weight: 600; }
        .divider { height: 1px; background: #cbd5e1; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; font-size: 12px; padding: 2.5px 0; }
        .row span { color: #64748b; }
        .highlight { font-family: monospace; font-size: 13px; font-weight: 700; color: #0f172a; background: #eef1f7; padding: 1px 6px; border-radius: 4px; }
        .hotline { font-size: 11px; color: #4954cc; margin-top: 4px; font-weight: 600; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
        @media print {
          body { padding: 0; }
          .grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .card { background: #fff; border-color: #94a3b8; }
        }
      </style></head><body>
      <h2>${t('settings.printHeaderTitle', { name: escapeHtml(voucher.locationName || 'Hotspot') })} (${listToPrint.length} cards)</h2>
      <div class="grid">${cards}</div>
      <script>window.print();<${'/script'}>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
    }
    toast.info(`${listToPrint.length} cards`, t('users.printCards'));
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError(t('users.fieldName'));
      return;
    }
    setFormBusy(true);
    setFormError('');
    try {
      const body = { ...form, name: form.name.trim() };
      if (editing) {
        if (!body.password) delete body.password;
        await api.updateUser(editing['.id'], body);
        toast.success(body.name, t('common.update'));
      } else {
        await api.createUser(body);
        toast.success(body.name, t('common.create'));
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
      toast.error(err.message, t('common.error'));
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteUser(deleting['.id']);
      toast.success(deleting.name, t('common.delete'));
    } catch (err) {
      toast.error(err.message, t('common.error'));
    }
    setDeleting(null);
    reload();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sk-topbar flex-wrap">
        <div>
          <h1 className="sk-title">
            {activeTab === 'users' ? t('users.titleUsers') : t('users.titleProfiles')}
          </h1>
          <p className="sk-subtitle font-mono">
            {activeTab === 'users'
              ? t('users.subtitleUsers')
              : t('users.subtitleProfiles')}
          </p>
        </div>

        {activeTab === 'users' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={exportCsv} className="btn btn-secondary btn-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M10 3a1 1 0 011 1v8.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L9 12.586V4a1 1 0 011-1z" />
                <path d="M4 15a1 1 0 011 1v1h10v-1a1 1 0 112 0v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a1 1 0 011-1z" />
              </svg>
              {t('users.exportCsv')}
            </button>
            <button
              onClick={() => printCards()}
              className={`btn btn-sm ${selectedIds.size > 0 ? 'btn-primary' : 'btn-secondary'}`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v2h1a2 2 0 012 2v5a2 2 0 01-2 2h-1v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2H4a2 2 0 01-2-2V8a2 2 0 012-2h1V4zm9 4H6v8h8V8z" />
              </svg>
              {selectedIds.size > 0
                ? t('users.printSelected', { count: selectedIds.size })
                : t('users.printCards')}
            </button>
            {canManageUsers && (
              <button onClick={openCreate} className="btn btn-primary btn-sm">
                {t('users.addUser')}
              </button>
            )}
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={reloadProfiles}
              disabled={loadingProfiles}
              className="btn btn-secondary btn-sm"
            >
              {loadingProfiles ? <Spinner size="xs" /> : '⟳'} {t('common.refresh')}
            </button>
            {canManageProfiles && (
              <button onClick={() => openCreateProfile(false)} className="btn btn-primary btn-sm">
                {t('users.createProfile')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Segmented Tab Switcher */}
      <div className="sk-seg">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`sk-seg__btn ${activeTab === 'users' ? 'is-on' : ''}`}
        >
          <span>👥 {t('users.tabUsers')}</span>
          <span className="sk-seg__count">{users.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          className={`sk-seg__btn ${activeTab === 'profiles' ? 'is-on' : ''}`}
        >
          <span>⚡ {t('users.tabProfiles')}</span>
          <span className="sk-seg__count">{profiles.length}</span>
        </button>
      </div>

      {/* ================= TAB 1: USERS ================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-64">
                <input
                  id="users-search"
                  name="usersSearch"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('users.searchPlaceholder')}
                  className="form-input text-xs h-8"
                />
              </div>

              <CustomSelect
                id="users-profile-filter"
                name="usersProfileFilter"
                value={profileFilter}
                onChange={(e) => setProfileFilter(e.target.value)}
                placeholder={t('users.allProfiles')}
                className="w-44"
                buttonClassName="h-8 text-xs"
                options={[
                  { value: '', label: t('users.allProfiles'), badge: `${users.length}` },
                  ...profileNames.map((p) => {
                    const count = users.filter((u) => profileOf(u) === p).length;
                    return {
                      value: p,
                      label: p,
                      badge: `${count}`,
                    };
                  }),
                ]}
              />

              <span className="font-mono text-xs text-[var(--text-faint)]">
                {t('users.showingCount', { filtered: filtered.length, total: users.length })}
              </span>
            </div>
          </div>

          {error ? (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs">
              <p className="font-semibold text-[var(--red)]">{error}</p>
              <button onClick={reload} className="btn btn-danger btn-sm mt-3">
                ⟳ {t('common.retry')}
              </button>
            </div>
          ) : loading ? (
            <Spinner label={t('common.loading')} />
          ) : (
            <div className="sk-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="sk-dtable">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>{t('users.colUser')}</th>
                      <th>
                        <div className="flex items-center gap-1.5">
                          <span>{t('users.colPassword')}</span>
                          <button
                            type="button"
                            onClick={() => setShowAllPasswords((v) => !v)}
                            className="text-[10px] font-mono text-[var(--accent)] hover:underline opacity-80 hover:opacity-100"
                            title={showAllPasswords ? t('users.hidePass') : t('users.revealPass')}
                          >
                            {showAllPasswords ? t('common.hide') : t('common.show')}
                          </button>
                        </div>
                      </th>
                      <th>{t('users.colProfile')}</th>
                      <th>{t('users.colUptimeLimit')}</th>
                      <th>{t('users.colBytesLimit')}</th>
                      <th>{t('users.colStatus')}</th>
                      <th className="text-right min-w-[280px]">{t('users.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center font-mono text-xs text-[var(--text-faint)]">
                          {t('users.noUsers')}
                        </td>
                      </tr>
                    )}
                    {filtered.map((u) => (
                      <tr
                        key={u['.id']}
                        className={selectedIds.has(u['.id']) ? 'is-selected' : ''}
                      >
                        <td className="w-10 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select ${u.name}`}
                            checked={selectedIds.has(u['.id'])}
                            onChange={() => toggleSelect(u['.id'])}
                          />
                        </td>
                        <td>
                          <div className="font-mono font-semibold text-[var(--text)]">{u.name}</div>
                          {u.comment && (
                            <div className="font-mono text-[11px] text-[var(--text-faint)]">{u.comment}</div>
                          )}
                        </td>
                        <td>
                          {u.password ? (
                            <div className="inline-flex items-center gap-1.5 group">
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-soft)] text-[var(--cyan)] select-all tracking-wider">
                                {showAllPasswords || revealedPasswords.has(u['.id']) ? u.password : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPassword(u['.id'])}
                                className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text)] transition-colors p-0.5"
                                title={revealedPasswords.has(u['.id']) || showAllPasswords ? t('users.hidePass') : t('users.revealPass')}
                              >
                                {revealedPasswords.has(u['.id']) || showAllPasswords ? '👁️' : '👁️‍🗨️'}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyPassword(u.password, u.name)}
                                className="text-[11px] text-[var(--text-faint)] hover:text-[var(--accent)] transition-colors p-0.5"
                                title={t('users.copyPass')}
                              >
                                📋
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-[var(--text-faint)] italic">
                              {t('common.empty')}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileSearch(profileOf(u));
                              setActiveTab('profiles');
                            }}
                            className="sk-state sk-state--accent"
                          >
                            {profileOf(u)}
                          </button>
                        </td>
                        <td className="font-mono text-xs text-[var(--text-dim)]">
                          {u['limit-uptime'] ? formatDuration(u['limit-uptime'], language) : '—'}
                        </td>
                        <td className="font-mono text-xs text-[var(--text-dim)]">
                          {u['limit-bytes-total'] ? formatBytes(u['limit-bytes-total']) : '—'}
                        </td>
                        <td>
                          <span
                            className={`sk-pill ${u.disabled === 'true' ? 'sk-pill--red' : 'sk-pill--green'} text-[10px] py-0 px-2`}
                          >
                            <span className="sk-pill__dot" />
                            {u.disabled === 'true' ? t('common.disabled') : t('common.active')}
                          </span>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {isViewer ? (
                            <span className="font-mono text-xs text-[var(--text-faint)]">
                              {t('common.readOnly')}
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1 font-mono text-xs">
                              <button
                                onClick={() => printCards([u])}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px]"
                                title={t('users.printSingle')}
                              >
                                🖨️ {t('users.printSingle')}
                              </button>
                              <button
                                onClick={() => setExtending(u)}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--accent-bright)]"
                              >
                                {t('users.extend')}
                              </button>
                              <button
                                onClick={() => handleReset(u)}
                                disabled={busyId === u['.id']}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--violet)]"
                              >
                                {busyId === u['.id'] ? '…' : t('users.resetCounter')}
                              </button>
                              <button onClick={() => openEdit(u)} className="btn btn-secondary btn-sm h-7 px-2 text-[11px]">
                                {t('common.edit')}
                              </button>
                              <button
                                onClick={() => setDeleting(u)}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)]"
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Floating BulkBar */}
          {selectedIds.size > 0 && (
            <div className="sk-bulkbar">
              <span className="font-mono text-xs font-semibold text-[var(--text)]">
                {t('users.bulkSelected', { count: selectedIds.size })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printCards()}
                  className="btn btn-primary btn-sm"
                >
                  🖨️ {t('users.bulkPrint')} ({selectedIds.size})
                </button>
                <button
                  onClick={clearSelection}
                  className="btn btn-secondary btn-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: PROFILES ================= */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="w-64">
              <input
                id="profiles-search"
                name="profilesSearch"
                value={profileSearch}
                onChange={(e) => setProfileSearch(e.target.value)}
                placeholder={t('profiles.searchPlaceholder')}
                className="form-input text-xs h-8"
              />
            </div>
            <span className="font-mono text-xs text-[var(--text-faint)]">
              {t('profiles.showingCount', { filtered: filteredProfiles.length, total: profiles.length })}
            </span>
          </div>

          {errorProfiles ? (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs">
              <p className="font-semibold text-[var(--red)]">{errorProfiles}</p>
              <button onClick={reloadProfiles} className="btn btn-danger btn-sm mt-3">
                ⟳ {t('common.retry')}
              </button>
            </div>
          ) : loadingProfiles ? (
            <Spinner label={t('common.loading')} />
          ) : (
            <div className="sk-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="sk-dtable">
                  <thead>
                    <tr>
                      <th>{t('profiles.colName')}</th>
                      <th>{t('profiles.colRateLimit')}</th>
                      <th>{t('profiles.colSharedUsers')}</th>
                      <th>{t('profiles.colIdleTimeout')}</th>
                      <th>{t('profiles.colMacCookie')}</th>
                      <th className="text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center font-mono text-xs text-[var(--text-faint)]">
                          {t('profiles.noProfiles')}
                        </td>
                      </tr>
                    )}
                    {filteredProfiles.map((p) => (
                      <tr key={p['.id']}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-[var(--text)]">{p.name}</span>
                            {p.default === 'true' && (
                              <span className="sk-state sk-state--accent text-[9px]">DEFAULT</span>
                            )}
                          </div>
                        </td>
                        <td className="font-mono text-xs">
                          {p['rate-limit'] ? (
                            <span className="sk-state sk-state--cyan text-[10px]">{p['rate-limit']}</span>
                          ) : (
                            <span className="text-[var(--text-faint)]">{t('common.unlimited')}</span>
                          )}
                        </td>
                        <td className="font-mono text-xs text-[var(--text-dim)]">{p['shared-users'] || '1'}</td>
                        <td className="font-mono text-xs text-[var(--text-dim)]">{p['idle-timeout'] || '—'}</td>
                        <td>
                          {p['add-mac-cookie'] === 'true' ? (
                            <span className="sk-pill sk-pill--green text-[10px] py-0 px-1.5">
                              <span className="sk-pill__dot" /> {p['mac-cookie-timeout'] || 'ON'}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-[var(--text-faint)]">OFF</span>
                          )}
                        </td>
                        <td className="text-right">
                          {canManageProfiles ? (
                            <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                              <button onClick={() => openEditProfile(p)} className="btn btn-secondary btn-sm h-7 px-2 text-[11px]">
                                {t('common.edit')}
                              </button>
                              <button
                                onClick={() => setDeletingProfile(p)}
                                disabled={profileBusyId === p['.id'] || p.default === 'true'}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)] disabled:opacity-30"
                              >
                                {profileBusyId === p['.id'] ? '…' : t('common.delete')}
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-[var(--text-faint)]">
                              {t('common.readOnly')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal tạo / sửa User */}
      <Modal
        open={formOpen}
        title={editing ? t('users.modalEditTitle', { name: editing.name }) : t('users.modalCreateTitle')}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn btn-secondary btn-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={formBusy} className="btn btn-primary btn-sm">
              {formBusy ? t('common.saving') : editing ? t('common.update') : t('common.create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--red-bg)] border border-[rgba(251,111,111,0.3)] p-2.5 text-xs font-medium text-[var(--red)]">
              {formError}
            </div>
          )}

          <Field label={t('users.fieldName')}>
            <input
              id="user-name"
              name="name"
              className="form-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="vd: guest-01"
              autoFocus
              disabled={!!editing}
            />
          </Field>

          <Field
            label={t('users.fieldPassword')}
            hint={editing ? t('users.fieldPasswordHint') : ''}
          >
            <input
              id="user-password"
              name="password"
              type="text"
              className="form-input"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="vd: 123456"
            />
          </Field>

          <Field label={t('users.fieldProfile')}>
            <CustomSelect
              id="user-profile"
              name="profile"
              value={form.profile}
              onChange={(e) => set('profile', e.target.value)}
              placeholder={t('users.allProfiles')}
              className="w-full"
              options={profileNames.map((p) => ({ value: p, label: p }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('users.fieldUptimeLimit')} hint={t('users.fieldUptimeLimitHint')}>
              <input
                id="user-uptime"
                name="limit-uptime"
                className="form-input"
                value={form['limit-uptime']}
                onChange={(e) => set('limit-uptime', e.target.value)}
                placeholder="vd: 2h"
              />
            </Field>

            <Field label={t('users.fieldBytesLimit')} hint={t('users.fieldBytesLimitHint')}>
              <input
                id="user-bytes"
                name="limit-bytes-total"
                className="form-input"
                value={form['limit-bytes-total']}
                onChange={(e) => set('limit-bytes-total', e.target.value)}
                placeholder="vd: 1G"
              />
            </Field>
          </div>

          <Field label={t('users.fieldComment')}>
            <input
              id="user-comment"
              name="comment"
              className="form-input"
              value={form.comment}
              onChange={(e) => set('comment', e.target.value)}
              placeholder={t('users.fieldCommentHint')}
            />
          </Field>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={form.disabled === 'true'}
              onChange={(e) => set('disabled', e.target.checked ? 'true' : 'false')}
            />
            <span className="text-xs text-[var(--text-dim)]">{t('users.fieldDisabled')}</span>
          </label>
        </form>
      </Modal>

      {/* Modal Tạo/Sửa Profile */}
      <Modal
        open={profileFormOpen}
        title={profileEditing ? t('profiles.modalEditTitle', { name: profileEditing.name }) : t('profiles.modalCreateTitle')}
        onClose={() => setProfileFormOpen(false)}
        footer={
          <>
            <button onClick={() => setProfileFormOpen(false)} className="btn btn-secondary btn-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleSubmitProfile} disabled={profileFormBusy} className="btn btn-primary btn-sm">
              {profileFormBusy ? t('common.saving') : profileEditing ? t('common.update') : t('common.create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitProfile} className="space-y-4">
          {profileFormError && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--red-bg)] border border-[rgba(251,111,111,0.3)] p-2.5 text-xs font-medium text-[var(--red)]">
              {profileFormError}
            </div>
          )}

          <Field label={t('profiles.fieldName')}>
            <input
              id="profile-name"
              name="name"
              className="form-input"
              value={profileForm.name}
              onChange={(e) => setProfileField('name', e.target.value)}
              placeholder="vd: profile-vip"
              autoFocus
              disabled={!!profileEditing}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('profiles.fieldRateLimit')} hint={t('profiles.fieldRateLimitHint')}>
              <input
                id="profile-rate"
                name="rate-limit"
                className="form-input"
                value={profileForm['rate-limit']}
                onChange={(e) => setProfileField('rate-limit', e.target.value)}
                placeholder="vd: 10M/10M"
              />
            </Field>

            <Field label={t('profiles.fieldSharedUsers')} hint="vd: 1, 5">
              <input
                id="profile-shared"
                name="shared-users"
                className="form-input"
                value={profileForm['shared-users']}
                onChange={(e) => setProfileField('shared-users', e.target.value)}
                placeholder="vd: 1"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('profiles.fieldIdleTimeout')}>
              <input
                id="profile-idle"
                name="idle-timeout"
                className="form-input"
                value={profileForm['idle-timeout']}
                onChange={(e) => setProfileField('idle-timeout', e.target.value)}
                placeholder="vd: 5m, none"
              />
            </Field>

            <Field label={t('profiles.fieldMacCookieTimeout')}>
              <input
                id="profile-maccookie"
                name="mac-cookie-timeout"
                className="form-input"
                value={profileForm['mac-cookie-timeout']}
                onChange={(e) => setProfileField('mac-cookie-timeout', e.target.value)}
                placeholder="vd: 3d"
              />
            </Field>
          </div>
        </form>
      </Modal>

      {/* Modal Xóa User */}
      <Modal
        open={!!deleting}
        title={t('common.delete')}
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button onClick={() => setDeleting(null)} className="btn btn-secondary btn-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleDelete} className="btn btn-danger btn-sm">
              {t('common.confirm')} {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-xs text-[var(--text)]">
          {t('users.deleteConfirm', { name: deleting?.name })}
        </p>
      </Modal>

      {/* Modal Xóa Profile */}
      <Modal
        open={!!deletingProfile}
        title={t('common.delete')}
        onClose={() => setDeletingProfile(null)}
        footer={
          <>
            <button onClick={() => setDeletingProfile(null)} className="btn btn-secondary btn-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleDeleteProfileConfirm} className="btn btn-danger btn-sm">
              {t('common.confirm')} {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-xs text-[var(--text)]">
          {t('profiles.deleteConfirm', { name: deletingProfile?.name })}
        </p>
      </Modal>

      {/* Modal Gia Hạn Thời Gian */}
      <Modal
        open={!!extending}
        title={t('users.modalExtendTitle', { name: extending?.name })}
        onClose={() => setExtending(null)}
        footer={
          <>
            <button onClick={() => setExtending(null)} className="btn btn-secondary btn-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleExtend} disabled={extendBusy} className="btn btn-primary btn-sm">
              {extendBusy ? t('common.saving') : t('users.saveExtend')}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('users.extendTimeLabel')} hint="vd: 1h, 30m, 1d">
            <input
              value={extendTime}
              onChange={(e) => setExtendTime(e.target.value)}
              className="form-input"
              placeholder="vd: 1h"
              autoFocus
            />
          </Field>
          <div className="flex gap-2">
            {['30m', '1h', '2h', '1d'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setExtendTime(preset)}
                className={`sk-seg__btn ${extendTime === preset ? 'is-on' : ''}`}
              >
                +{preset}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}