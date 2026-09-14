import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
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
    toast.success(`Đã sao chép mật khẩu của "${userName}"`, 'Đã sao chép');
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
      setProfileFormError('Vui lòng nhập tên hồ sơ.');
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
        toast.success(`Đã cập nhật hồ sơ "${profileEditing.name}"`, 'Cập nhật thành công');
      } else {
        await api.createProfile(body);
        toast.success(`Đã tạo hồ sơ hotspot "${body.name}"`, 'Tạo thành công');
        if (createProfileForUserForm) {
          set('profile', body.name);
        }
      }
      setProfileFormOpen(false);
      reloadProfiles();
    } catch (err) {
      setProfileFormError(err.message);
      toast.error(err.message, 'Lỗi thao tác');
    } finally {
      setProfileFormBusy(false);
    }
  }

  async function handleDeleteProfileConfirm() {
    if (!deletingProfile) return;
    setProfileBusyId(deletingProfile['.id']);
    try {
      await api.deleteProfile(deletingProfile['.id']);
      toast.success(`Đã xóa hồ sơ "${deletingProfile.name}"`, 'Xóa thành công');
      setDeletingProfile(null);
      reloadProfiles();
    } catch (err) {
      toast.error(`Lỗi xóa hồ sơ: ${err.message}`, 'Xóa thất bại');
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
      toast.success(`Đã gia hạn tài khoản "${extending.name}" thêm ${extendTime.trim()}`, 'Gia hạn thành công');
      setExtending(null);
      reload();
    } catch (err) {
      toast.error(`Lỗi gia hạn: ${err.message}`, 'Gia hạn thất bại');
    } finally {
      setExtendBusy(false);
    }
  }

  async function handleReset(u) {
    if (!window.confirm(`Reset bộ đếm dung lượng đã dùng của "${u.name}"?`)) return;
    setBusyId(u['.id']);
    try {
      await api.resetUser(u['.id']);
      toast.success(`Đã reset bộ đếm dung lượng cho "${u.name}"`, 'Reset thành công');
      reload();
    } catch (err) {
      toast.error(`Lỗi reset: ${err.message}`, 'Reset thất bại');
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
    toast.info(`Đã xuất ${users.length} tài khoản ra file CSV`, 'Xuất dữ liệu');
  }

  async function printCards(customUsers = null) {
    const listToPrint = customUsers || users.filter((u) => selectedIds.has(u['.id']));
    if (!listToPrint || listToPrint.length === 0) {
      toast.warning('Vui lòng tích chọn ít nhất 1 người dùng trong bảng trước khi in thẻ!', 'Chưa chọn người dùng');
      return;
    }

    let voucher = {
      locationName: 'MikroTik Hotspot',
      ssid: 'WIFI_HOTSPOT',
      hotline: '',
      footerText: 'Chúc quý khách truy cập mạng vui vẻ!',
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
            <div class="ssid">📶 WiFi (SSID): <b>${escapeHtml(voucher.ssid || 'WIFI_HOTSPOT')}</b></div>
            ${voucher.loginUrl ? `<div class="login-url">🌐 Đăng nhập tại: <b>${escapeHtml(voucher.loginUrl)}</b></div>` : ''}
            <div class="divider"></div>
            <div class="row"><span>👤 Tài khoản:</span><b class="highlight">${escapeHtml(u.name || '')}</b></div>
            <div class="row"><span>🔑 Mật khẩu:</span><b class="highlight">${escapeHtml(u.password || '(Trống)')}</b></div>
            ${u['limit-uptime'] ? `<div class="row"><span>⏱️ Thời gian:</span><b>${escapeHtml(formatDuration(u['limit-uptime']))}</b></div>` : ''}
            ${u['limit-bytes-total'] ? `<div class="row"><span>📊 Dung lượng:</span><b>${escapeHtml(formatBytes(u['limit-bytes-total']))}</b></div>` : ''}
            ${voucher.hotline ? `<div class="row hotline"><span>📞 Hotline:</span><b>${escapeHtml(voucher.hotline)}</b></div>` : ''}
            ${voucher.footerText ? `<div class="footer">${escapeHtml(voucher.footerText)}</div>` : ''}
          </div>`
      )
      .join('');
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Thẻ WiFi Hotspot - ${escapeHtml(voucher.locationName || 'MikroTik')}</title>
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
      <h2>Thẻ Truy Cập WiFi — ${escapeHtml(voucher.locationName || 'Hotspot')} (${listToPrint.length} thẻ)</h2>
      <div class="grid">${cards}</div>
      <script>window.print();<${'/script'}>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
    }
    toast.info(`Đang mở cửa sổ in ${listToPrint.length} thẻ WiFi voucher`, 'In thẻ WiFi');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Vui lòng nhập tên người dùng.');
      return;
    }
    setFormBusy(true);
    setFormError('');
    try {
      const body = { ...form, name: form.name.trim() };
      if (editing) {
        if (!body.password) delete body.password;
        await api.updateUser(editing['.id'], body);
        toast.success(`Đã cập nhật thông tin người dùng "${body.name}"`, 'Cập nhật thành công');
      } else {
        await api.createUser(body);
        toast.success(`Đã tạo người dùng hotspot "${body.name}"`, 'Tạo thành công');
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
      toast.error(err.message, 'Lỗi thao tác');
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteUser(deleting['.id']);
      toast.success(`Đã xóa người dùng "${deleting.name}"`, 'Xóa thành công');
    } catch (err) {
      toast.error(`Lỗi khi xóa "${deleting.name}": ${err.message}`, 'Xóa thất bại');
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
            {activeTab === 'users' ? 'Người dùng Hotspot' : 'Hồ sơ gói cước (Profiles)'}
          </h1>
          <p className="sk-subtitle font-mono">
            {activeTab === 'users'
              ? 'Quản lý tài khoản trong /ip/hotspot/user'
              : 'Quản lý băng thông và hạn ngạch trong /ip/hotspot/user/profile'}
          </p>
        </div>

        {activeTab === 'users' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={exportCsv} className="btn btn-secondary btn-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M10 3a1 1 0 011 1v8.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L9 12.586V4a1 1 0 011-1z" />
                <path d="M4 15a1 1 0 011 1v1h10v-1a1 1 0 112 0v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a1 1 0 011-1z" />
              </svg>
              Xuất CSV
            </button>
            <button
              onClick={() => printCards()}
              className={`btn btn-sm ${selectedIds.size > 0 ? 'btn-primary' : 'btn-secondary'}`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v2h1a2 2 0 012 2v5a2 2 0 01-2 2h-1v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2H4a2 2 0 01-2-2V8a2 2 0 012-2h1V4zm9 4H6v8h8V8z" />
              </svg>
              In thẻ WiFi {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
            {canManageUsers && (
              <button onClick={openCreate} className="btn btn-primary btn-sm">
                + Thêm người dùng
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
              {loadingProfiles ? <Spinner size="xs" /> : '⟳'} Làm mới
            </button>
            {canManageProfiles && (
              <button onClick={() => openCreateProfile(false)} className="btn btn-primary btn-sm">
                + Thêm hồ sơ mới
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
          <span>👥 Người dùng</span>
          <span className="sk-seg__count">{users.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          className={`sk-seg__btn ${activeTab === 'profiles' ? 'is-on' : ''}`}
        >
          <span>⚡ Hồ sơ (Profiles)</span>
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
                  placeholder="Tìm theo tên / ghi chú…"
                  className="form-input text-xs h-8"
                />
              </div>

              <CustomSelect
                id="users-profile-filter"
                name="usersProfileFilter"
                value={profileFilter}
                onChange={(e) => setProfileFilter(e.target.value)}
                placeholder="Tất cả profile"
                className="w-44"
                buttonClassName="h-8 text-xs"
                options={[
                  { value: '', label: 'Tất cả profile', badge: `${users.length}` },
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
                Hiển thị {filtered.length}/{users.length}
              </span>
            </div>
          </div>

          {error ? (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs">
              <p className="font-semibold text-[var(--red)]">Không lấy được danh sách người dùng.</p>
              <p className="mt-1 text-[var(--text-dim)]">{error}</p>
              <button onClick={reload} className="btn btn-danger btn-sm mt-3">
                ⟳ Thử lại
              </button>
            </div>
          ) : loading ? (
            <Spinner label="Đang tải người dùng hotspot…" />
          ) : (
            <div className="sk-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="sk-dtable">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả người dùng"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Người dùng</th>
                      <th>
                        <div className="flex items-center gap-1.5">
                          <span>Mật khẩu</span>
                          <button
                            type="button"
                            onClick={() => setShowAllPasswords((v) => !v)}
                            className="text-[10px] font-mono text-[var(--accent)] hover:underline opacity-80 hover:opacity-100"
                            title={showAllPasswords ? 'Ẩn tất cả mật khẩu' : 'Hiện tất cả mật khẩu'}
                          >
                            {showAllPasswords ? 'Ẩn' : 'Hiện'}
                          </button>
                        </div>
                      </th>
                      <th>Profile</th>
                      <th>Giới hạn thời gian</th>
                      <th>Giới hạn dung lượng</th>
                      <th>Trạng thái</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center font-mono text-xs text-[var(--text-faint)]">
                          Không có người dùng nào.
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
                            aria-label={`Chọn ${u.name}`}
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
                                title={revealedPasswords.has(u['.id']) || showAllPasswords ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                              >
                                {revealedPasswords.has(u['.id']) || showAllPasswords ? '👁️' : '👁️‍🗨️'}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyPassword(u.password, u.name)}
                                className="text-[11px] text-[var(--text-faint)] hover:text-[var(--accent)] transition-colors p-0.5"
                                title="Sao chép mật khẩu"
                              >
                                📋
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-[var(--text-faint)] italic">
                              (Trống)
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
                          {u['limit-uptime'] ? formatDuration(u['limit-uptime']) : '—'}
                        </td>
                        <td className="font-mono text-xs text-[var(--text-dim)]">
                          {u['limit-bytes-total'] ? formatBytes(u['limit-bytes-total']) : '—'}
                        </td>
                        <td>
                          <span
                            className={`sk-pill ${u.disabled === 'true' ? 'sk-pill--red' : 'sk-pill--green'} text-[10px] py-0 px-2`}
                          >
                            <span className="sk-pill__dot" />
                            {u.disabled === 'true' ? 'DISABLED' : 'ACTIVE'}
                          </span>
                        </td>
                        <td className="text-right">
                          {isViewer ? (
                            <span className="font-mono text-xs text-[var(--text-faint)]">
                              READ ONLY
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1 font-mono text-xs">
                              <button
                                onClick={() => printCards([u])}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px]"
                                title="In riêng thẻ WiFi cho người dùng này"
                              >
                                🖨️ In
                              </button>
                              <button
                                onClick={() => setExtending(u)}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--accent-bright)]"
                              >
                                + Gia hạn
                              </button>
                              <button
                                onClick={() => handleReset(u)}
                                disabled={busyId === u['.id']}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--violet)]"
                              >
                                {busyId === u['.id'] ? '…' : '↺ Reset'}
                              </button>
                              <button onClick={() => openEdit(u)} className="btn btn-secondary btn-sm h-7 px-2 text-[11px]">
                                Sửa
                              </button>
                              <button
                                onClick={() => setDeleting(u)}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)]"
                              >
                                Xóa
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
                Đã chọn <b className="text-[var(--accent-bright)]">{selectedIds.size}</b> mục
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printCards()}
                  className="btn btn-primary btn-sm"
                >
                  🖨️ In {selectedIds.size} thẻ WiFi
                </button>
                <button
                  onClick={clearSelection}
                  className="btn btn-secondary btn-sm"
                >
                  Bỏ chọn
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
                placeholder="Tìm theo tên hồ sơ…"
                className="form-input text-xs h-8"
              />
            </div>
            <span className="font-mono text-xs text-[var(--text-faint)]">
              {filteredProfiles.length}/{profiles.length} hồ sơ (/ip/hotspot/user/profile)
            </span>
          </div>

          {errorProfiles ? (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs">
              <p className="font-semibold text-[var(--red)]">Không lấy được danh sách hồ sơ từ MikroTik.</p>
              <p className="mt-1 text-[var(--text-dim)]">{errorProfiles}</p>
              <button onClick={reloadProfiles} className="btn btn-danger btn-sm mt-3">
                ⟳ Thử lại
              </button>
            </div>
          ) : loadingProfiles ? (
            <Spinner label="Đang tải danh sách hồ sơ từ MikroTik Router…" />
          ) : (
            <div className="sk-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="sk-dtable">
                  <thead>
                    <tr>
                      <th>Tên hồ sơ</th>
                      <th>Băng thông (rate-limit)</th>
                      <th>Dùng chung (Shared)</th>
                      <th>Idle Timeout</th>
                      <th>MAC Cookie</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center font-mono text-xs text-[var(--text-faint)]">
                          Không có hồ sơ nào.
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
                            <span className="text-[var(--text-faint)]">Không giới hạn</span>
                          )}
                        </td>
                        <td className="font-mono text-xs text-[var(--text-dim)]">{p['shared-users'] || '1'}</td>
                        <td className="font-mono text-xs text-[var(--text-dim)]">{p['idle-timeout'] || '—'}</td>
                        <td>
                          {p['add-mac-cookie'] === 'true' ? (
                            <span className="sk-pill sk-pill--green text-[10px] py-0 px-1.5">
                              <span className="sk-pill__dot" /> {p['mac-cookie-timeout'] || 'Bật'}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-[var(--text-faint)]">Tắt</span>
                          )}
                        </td>
                        <td className="text-right">
                          {canManageProfiles ? (
                            <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                              <button onClick={() => openEditProfile(p)} className="btn btn-secondary btn-sm h-7 px-2 text-[11px]">
                                Sửa
                              </button>
                              <button
                                onClick={() => setDeletingProfile(p)}
                                disabled={profileBusyId === p['.id'] || p.default === 'true'}
                                className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)] disabled:opacity-30"
                              >
                                {profileBusyId === p['.id'] ? '…' : 'Xóa'}
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-[var(--text-faint)]">
                              READ ONLY
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
        title={editing ? `Sửa người dùng "${editing.name}"` : 'Thêm người dùng mới'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn btn-secondary btn-sm">
              Hủy
            </button>
            <button onClick={handleSubmit} disabled={formBusy} className="btn btn-primary btn-sm">
              {formBusy ? 'Đang lưu…' : editing ? 'Cập nhật' : 'Tạo người dùng'}
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

          <Field label="Tên người dùng *">
            <input
              id="user-name"
              name="name"
              className="form-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="vd: khach-01"
              autoFocus
              disabled={!!editing}
            />
          </Field>

          <Field
            label="Mật khẩu"
            hint={editing ? 'Để trống nếu không muốn đổi mật khẩu' : 'Mật khẩu đăng nhập'}
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

          <Field label="Hồ sơ (Profile)">
            <CustomSelect
              id="user-profile"
              name="profile"
              value={form.profile}
              onChange={(e) => set('profile', e.target.value)}
              placeholder="Chọn profile…"
              className="w-full"
              options={profileNames.map((p) => ({ value: p, label: p }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Giới hạn thời gian" hint="vd: 1h, 30m, 1d">
              <input
                id="user-uptime"
                name="limit-uptime"
                className="form-input"
                value={form['limit-uptime']}
                onChange={(e) => set('limit-uptime', e.target.value)}
                placeholder="vd: 2h"
              />
            </Field>

            <Field label="Giới hạn dung lượng" hint="vd: 500M, 2G">
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

          <Field label="Ghi chú">
            <input
              id="user-comment"
              name="comment"
              className="form-input"
              value={form.comment}
              onChange={(e) => set('comment', e.target.value)}
              placeholder="vd: Khách phòng 101"
            />
          </Field>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={form.disabled === 'true'}
              onChange={(e) => set('disabled', e.target.checked ? 'true' : 'false')}
            />
            <span className="text-xs text-[var(--text-dim)]">Tạm khóa tài khoản này (disabled)</span>
          </label>
        </form>
      </Modal>

      {/* Modal Tạo/Sửa Profile */}
      <Modal
        open={profileFormOpen}
        title={profileEditing ? `Sửa hồ sơ "${profileEditing.name}"` : 'Thêm hồ sơ gói cước mới'}
        onClose={() => setProfileFormOpen(false)}
        footer={
          <>
            <button onClick={() => setProfileFormOpen(false)} className="btn btn-secondary btn-sm">
              Hủy
            </button>
            <button onClick={handleSubmitProfile} disabled={profileFormBusy} className="btn btn-primary btn-sm">
              {profileFormBusy ? 'Đang lưu…' : profileEditing ? 'Cập nhật' : 'Tạo hồ sơ'}
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

          <Field label="Tên hồ sơ *">
            <input
              id="profile-name"
              name="name"
              className="form-input"
              value={profileForm.name}
              onChange={(e) => setProfileField('name', e.target.value)}
              placeholder="vd: goi-vip-10m"
              autoFocus
              disabled={!!profileEditing}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tốc độ (rate-limit)" hint="vd: 10M/10M, 5M/2M">
              <input
                id="profile-rate"
                name="rate-limit"
                className="form-input"
                value={profileForm['rate-limit']}
                onChange={(e) => setProfileField('rate-limit', e.target.value)}
                placeholder="vd: 10M/10M"
              />
            </Field>

            <Field label="Số user dùng chung" hint="vd: 1, 5, unlimited">
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
            <Field label="Idle Timeout">
              <input
                id="profile-idle"
                name="idle-timeout"
                className="form-input"
                value={profileForm['idle-timeout']}
                onChange={(e) => setProfileField('idle-timeout', e.target.value)}
                placeholder="vd: 5m, none"
              />
            </Field>

            <Field label="MAC Cookie Timeout">
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
        title="Xác nhận xóa người dùng"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button onClick={() => setDeleting(null)} className="btn btn-secondary btn-sm">
              Hủy
            </button>
            <button onClick={handleDelete} className="btn btn-danger btn-sm">
              Xác nhận xóa
            </button>
          </>
        }
      >
        <p className="text-xs text-[var(--text)]">
          Bạn có chắc chắn muốn xóa tài khoản <b className="font-mono text-[var(--accent-bright)]">{deleting?.name}</b> khỏi Router MikroTik?
        </p>
      </Modal>

      {/* Modal Xóa Profile */}
      <Modal
        open={!!deletingProfile}
        title="Xác nhận xóa hồ sơ"
        onClose={() => setDeletingProfile(null)}
        footer={
          <>
            <button onClick={() => setDeletingProfile(null)} className="btn btn-secondary btn-sm">
              Hủy
            </button>
            <button onClick={handleDeleteProfileConfirm} className="btn btn-danger btn-sm">
              Xác nhận xóa
            </button>
          </>
        }
      >
        <p className="text-xs text-[var(--text)]">
          Bạn có chắc chắn muốn xóa hồ sơ <b className="font-mono text-[var(--accent-bright)]">{deletingProfile?.name}</b>?
          Người dùng đang gán hồ sơ này có thể bị ngắt kết nối.
        </p>
      </Modal>

      {/* Modal Gia Hạn Thời Gian */}
      <Modal
        open={!!extending}
        title={`Gia hạn thời gian cho "${extending?.name}"`}
        onClose={() => setExtending(null)}
        footer={
          <>
            <button onClick={() => setExtending(null)} className="btn btn-secondary btn-sm">
              Hủy
            </button>
            <button onClick={handleExtend} disabled={extendBusy} className="btn btn-primary btn-sm">
              {extendBusy ? 'Đang xử lý…' : 'Xác nhận gia hạn'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Thời gian cộng thêm" hint="vd: 1h, 30m, 1d">
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