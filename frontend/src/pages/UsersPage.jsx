import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

// Form mặc định (key trùng tên property trong MikroTik REST API)
const EMPTY = {
  name: '',
  password: '',
  profile: '',
  'limit-uptime': '',
  'limit-bytes-total': '',
  comment: '',
  disabled: 'false',
};

// Input cho form modal (kiểu gạch chân lan rộng từ giữa khi focus)
const inputField = 'input-underline';
const selectField =
  'input-ghost appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23475569%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[right_0.75rem_center] bg-no-repeat pr-9';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label-caps mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export default function UsersPage() {
  const { canManageUsers, isViewer } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = đang tạo mới
  const [form, setForm] = useState(EMPTY);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const { data: users = [], loading, error, reload } = useApi(api.users);
  const { data: profiles = [] } = useApi(api.profiles);

  const profileNames = useMemo(() => profiles.map((p) => p.name), [profiles]);
  const profileOf = (u) => u.profile || 'default';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (profileFilter && profileOf(u) !== profileFilter) return false;
      if (!q) return true;
      const hay = `${u.name || ''} ${u.comment || ''} ${u.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, search, profileFilter]);

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
      password: '',
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

  // ----- Tính năng: Chọn nhiều user, Gia hạn / Reset / CSV / In thẻ -----
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [extending, setExtending] = useState(null);
  const [extendTime, setExtendTime] = useState('1h');
  const [extendBusy, setExtendBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [cardsOpen, setCardsOpen] = useState(false);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isAllSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u['.id']));
  const isSomeSelected = filtered.some((u) => selectedIds.has(u['.id']));

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
        .card { border: 1.5px dashed #0084ff; border-radius: 12px; padding: 14px 16px; break-inside: avoid; background: #f8fafc; }
        .location { font-size: 13px; font-weight: 700; color: #0084ff; text-transform: uppercase; letter-spacing: 0.5px; }
        .ssid { font-size: 13px; color: #1e293b; margin: 4px 0 6px 0; font-weight: 600; }
        .login-url { font-size: 11px; color: #7c3aed; margin-bottom: 6px; font-weight: 600; }
        .divider { height: 1px; background: #cbd5e1; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; font-size: 12px; padding: 2.5px 0; }
        .row span { color: #64748b; }
        .highlight { font-family: monospace; font-size: 13px; font-weight: 700; color: #0f172a; background: #e0f2fe; padding: 1px 6px; border-radius: 4px; }
        .hotline { font-size: 11px; color: #0284c7; margin-top: 4px; font-weight: 600; }
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
        if (!body.password) delete body.password; // không đổi mật khẩu nếu để trống
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
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Người dùng hotspot
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Quản lý tài khoản trong /ip/hotspot/user
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={exportCsv} className="btn-ghost px-4 py-2 text-sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 3a1 1 0 011 1v8.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L9 12.586V4a1 1 0 011-1z" />
              <path d="M4 15a1 1 0 011 1v1h10v-1a1 1 0 112 0v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a1 1 0 011-1z" />
            </svg>
            Xuất CSV
          </button>
          <button
            onClick={() => printCards()}
            className={
              selectedIds.size > 0
                ? 'btn-primary px-4 py-2 text-sm shadow-[0_0_18px_rgba(0,132,255,0.45)]'
                : 'btn-ghost px-4 py-2 text-sm'
            }
            title={selectedIds.size > 0 ? `In ${selectedIds.size} thẻ đã chọn` : 'Tích chọn user trong bảng để in thẻ'}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v2h1a2 2 0 012 2v5a2 2 0 01-2 2h-1v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2H4a2 2 0 01-2-2V8a2 2 0 012-2h1V4zm9 4H6v8h8V8z" />
            </svg>
            In thẻ WiFi {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
          {canManageUsers && (
            <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Thêm người dùng
            </button>
          )}
        </div>
      </header>

      {/* Thanh tìm kiếm / lọc & Trạng thái chọn thẻ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
            </svg>
            <input
              id="users-search"
              name="usersSearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên / ghi chú…"
              className="input-ghost pl-9"
            />
          </div>
          <select
            id="users-profile-filter"
            name="usersProfileFilter"
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className={`${selectField} w-48`}
          >
            <option value="">Tất cả profile</option>
            {profileNames.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className="text-xs font-medium text-ink-faint">
            Hiển thị {filtered.length}/{users.length}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary-soft/40 px-3.5 py-1.5 text-xs font-medium text-primary-deep shadow-[0_0_12px_rgba(0,132,255,0.15)] animate-in fade-in">
            <span>
              Đã chọn <b>{selectedIds.size}</b> người dùng
            </span>
            <button
              onClick={() => printCards()}
              className="btn-primary ml-1 px-2.5 py-1 text-xs font-semibold"
            >
              🖨️ In {selectedIds.size} thẻ
            </button>
            <button
              onClick={clearSelection}
              className="btn-ghost px-2 py-1 text-xs"
            >
              Bỏ chọn
            </button>
          </div>
        )}
      </div>

      {error ? (
        <div className="glass rounded-2xl border-danger/40 p-5 shadow-[0_0_24px_rgba(225,29,72,0.15)]">
          <p className="font-semibold text-danger">Không lấy được danh sách người dùng.</p>
          <p className="mt-1 text-sm text-ink-soft">{error}</p>
          <button onClick={reload} className="btn-danger mt-3 px-4 py-2 text-xs">
            ⟳ Thử lại
          </button>
        </div>
      ) : loading ? (
        <Spinner label="Đang tải người dùng…" />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="glass-table w-full text-left text-sm">
              <thead>
                <tr className="label-caps">
                  <th className="w-10 px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả người dùng"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-line text-primary focus:ring-primary accent-primary"
                    />
                  </th>
                  <th className="px-4 py-3.5 font-semibold">Người dùng</th>
                  <th className="px-4 py-3.5 font-semibold">Profile</th>
                  <th className="px-4 py-3.5 font-semibold">Giới hạn thời gian</th>
                  <th className="px-4 py-3.5 font-semibold">Giới hạn dung lượng</th>
                  <th className="px-4 py-3.5 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-ink-faint">
                      Không có người dùng nào.
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr
                    key={u['.id']}
                    className={selectedIds.has(u['.id']) ? 'bg-primary-soft/30' : ''}
                  >
                    <td className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${u.name}`}
                        checked={selectedIds.has(u['.id'])}
                        onChange={() => toggleSelect(u['.id'])}
                        className="h-4 w-4 rounded border-line text-primary focus:ring-primary accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`neon-dot ${u.disabled === 'true' ? 'neon-dot-danger' : ''}`} />
                        <div>
                          <div className="font-semibold text-ink">{u.name}</div>
                          {u.comment && (
                            <div className="text-xs text-ink-faint">{u.comment}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-lg bg-tertiary-soft/70 px-2.5 py-1 text-xs font-semibold text-tertiary">
                        {profileOf(u)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">
                      {u['limit-uptime'] ? formatDuration(u['limit-uptime']) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">
                      {u['limit-bytes-total'] ? formatBytes(u['limit-bytes-total']) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          u.disabled === 'true'
                            ? 'bg-danger-soft text-danger'
                            : 'bg-primary-soft text-primary-deep'
                        }`}
                      >
                        <span className={`neon-dot ${u.disabled === 'true' ? 'neon-dot-danger' : ''}`} />
                        {u.disabled === 'true' ? 'Tạm khóa' : 'Hoạt động'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {isViewer ? (
                        <span className="rounded-md bg-ink/5 px-2.5 py-1 text-xs italic text-ink-faint">
                          Chỉ xem
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => printCards([u])}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary-soft"
                            title="In riêng thẻ WiFi cho người dùng này"
                          >
                            🖨️ In thẻ
                          </button>
                          <button
                            onClick={() => setExtending(u)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary-soft hover:shadow-[0_0_12px_rgba(0,132,255,0.25)]"
                            title="Gia hạn thời gian"
                          >
                            + Gia hạn
                          </button>
                          <button
                            onClick={() => handleReset(u)}
                            disabled={busyId === u['.id']}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-tertiary transition hover:bg-tertiary-soft disabled:opacity-50"
                            title="Reset bộ đếm dung lượng"
                          >
                            {busyId === u['.id'] ? '…' : '↺ Reset'}
                          </button>
                          <button onClick={() => openEdit(u)} className="btn-ghost px-3 py-1.5 text-xs">
                            Sửa
                          </button>
                          <button
                            onClick={() => setDeleting(u)}
                            className="ml-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-soft hover:shadow-[0_0_14px_rgba(225,29,72,0.25)]"
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
      <Modal
        open={formOpen}
        title={editing ? `Sửa "${editing.name}"` : 'Thêm người dùng mới'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button
              onClick={() => setFormOpen(false)}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={formBusy}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {formBusy ? 'Đang lưu…' : editing ? 'Cập nhật' : 'Tạo người dùng'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger">
              {formError}
            </div>
          )}

          <Field label="Tên đăng nhập *">
            <input
              id="user-name"
              name="name"
              className={inputField}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="vd: khach001"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={editing ? 'Mật khẩu mới (để trống = giữ nguyên)' : 'Mật khẩu'}>
              <input
                id="user-password"
                name="password"
                className={inputField}
                type="text"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="vd: 123456"
              />
            </Field>
            <Field label="Hồ sơ (Profile)">
              <select
                id="user-profile"
                name="profile"
                className={selectField}
                value={form.profile}
                onChange={(e) => set('profile', e.target.value)}
              >
                {profileNames.length === 0 && <option value="">Không có profile</option>}
                {profileNames.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Giới hạn thời gian (limit-uptime)">
              <input
                id="user-limit-uptime"
                name="limit-uptime"
                className={inputField}
                value={form['limit-uptime']}
                onChange={(e) => set('limit-uptime', e.target.value)}
                placeholder="vd: 1d / 00:30:00 / 2w"
              />
            </Field>
            <Field label="Giới hạn dung lượng (limit-bytes-total)">
              <input
                id="user-limit-bytes"
                name="limit-bytes-total"
                className={inputField}
                value={form['limit-bytes-total']}
                onChange={(e) => set('limit-bytes-total', e.target.value)}
                placeholder="vd: 1073741824 (byte)"
              />
            </Field>
          </div>

          <Field label="Ghi chú (comment)">
            <input
              id="user-comment"
              name="comment"
              className={inputField}
              value={form.comment}
              onChange={(e) => set('comment', e.target.value)}
              placeholder="vd: Khách lẻ tầng 2"
            />
          </Field>

          {/* Glass toggle */}
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-soft">
            <span>Vô hiệu hóa (không cho đăng nhập)</span>
            <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-ink/10 transition-colors data-[on=true]:bg-primary" data-on={form.disabled === 'true'}>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={form.disabled === 'true'}
                onChange={(e) => set('disabled', e.target.checked ? 'true' : 'false')}
              />
              <span className="inline-block h-5 w-5 translate-x-0.5 transform rounded-full bg-white shadow transition peer-checked:translate-x-[22px] peer-checked:shadow-[0_0_12px_rgba(0,132,255,0.7)]" />
            </span>
          </label>
        </form>
      </Modal>

      {/* Modal gia hạn thời gian */}
      <Modal
        open={!!extending}
        title={`Gia hạn "${extending?.name}"`}
        onClose={() => setExtending(null)}
        footer={
          <>
            <button onClick={() => setExtending(null)} className="btn-ghost px-4 py-2 text-sm">
              Hủy
            </button>
            <button onClick={handleExtend} disabled={extendBusy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {extendBusy ? 'Đang xử lý…' : 'Gia hạn'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Giới hạn hiện tại:{' '}
            <b className="text-ink">{extending?.['limit-uptime'] ? formatDuration(extending['limit-uptime']) : 'Không giới hạn'}</b>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {['1h', '4h', '1d', '3d', '7d', '30d'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setExtendTime(t)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  extendTime === t
                    ? 'bg-primary text-white shadow-[0_0_14px_rgba(0,132,255,0.5)]'
                    : 'bg-white/50 text-ink-soft hover:bg-primary-soft'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Field label="Hoặc nhập tùy chỉnh (vd: 30m, 2h30m, 2d)">
            <input
              id="extend-time"
              name="extend-time"
              className={inputField}
              value={extendTime}
              onChange={(e) => setExtendTime(e.target.value)}
              placeholder="vd: 1h30m"
              autoFocus
            />
          </Field>
        </div>
      </Modal>

      {/* Modal xác nhận xóa */}
      <Modal
        open={!!deleting}
        title="Xóa người dùng"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button
              onClick={() => setDeleting(null)}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Hủy
            </button>
            <button
              onClick={handleDelete}
              className="btn-danger px-4 py-2 text-sm"
            >
              Xóa
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Bạn có chắc chắn muốn xóa{' '}
          <b className="font-semibold text-ink">{deleting?.name}</b>? Hành động này
          không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}