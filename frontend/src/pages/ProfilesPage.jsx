import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';

const EMPTY = {
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

export default function ProfilesPage() {
  const { canManageProfiles } = useAuth();
  const toast = useToast();
  const { data: profiles = [], loading, error, reload } = useApi(api.profiles);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => `${p.name || ''}`.toLowerCase().includes(q));
  }, [profiles, search]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name || '',
      'shared-users': p['shared-users'] || '1',
      'rate-limit': p['rate-limit'] || '',
      'address-list': p['address-list'] || '',
      'idle-timeout': p['idle-timeout'] || '',
      'keepalive-timeout': p['keepalive-timeout'] || '',
      'mac-cookie-timeout': p['mac-cookie-timeout'] || '',
      'add-mac-cookie': p['add-mac-cookie'] ?? 'true',
    });
    setFormError('');
    setFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Vui lòng nhập tên hồ sơ.');
      return;
    }
    setFormBusy(true);
    setFormError('');
    try {
      const body = {
        ...form,
        name: form.name.trim(),
        'add-mac-cookie': form['add-mac-cookie'] === 'true' ? 'true' : 'false',
      };
      Object.keys(body).forEach((k) => {
        if (body[k] === undefined || body[k] === null || body[k] === '') delete body[k];
      });
      if (editing) {
        delete body.name;
        await api.updateProfile(editing['.id'], body);
        toast.success(`Đã cập nhật hồ sơ "${editing.name}"`, 'Cập nhật thành công');
      } else {
        await api.createProfile(body);
        toast.success(`Đã tạo hồ sơ hotspot "${body.name}"`, 'Tạo thành công');
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

  async function handleDelete(p) {
    if (!window.confirm(`Xóa hồ sơ "${p.name}"? Người dùng thuộc hồ sơ này có thể bị lỗi.`)) return;
    setBusyId(p['.id']);
    try {
      await api.deleteProfile(p['.id']);
      toast.success(`Đã xóa hồ sơ "${p.name}"`, 'Xóa thành công');
      reload();
    } catch (err) {
      toast.error(`Lỗi xóa: ${err.message}`, 'Xóa thất bại');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Topbar */}
      <div className="sk-topbar flex-wrap">
        <div>
          <h1 className="sk-title">Hồ sơ gói cước (Profiles)</h1>
          <p className="sk-subtitle font-mono">
            Quản lý /ip/hotspot/user/profile · Giới hạn tốc độ, thời gian, MAC cookie
          </p>
        </div>
        {canManageProfiles && (
          <button onClick={openCreate} className="btn btn-primary btn-sm">
            + Thêm hồ sơ
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="w-64">
          <input
            id="profiles-search"
            name="profilesSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm hồ sơ…"
            className="form-input text-xs h-8"
          />
        </div>
        <span className="font-mono text-xs text-[var(--text-faint)]">
          {filtered.length}/{profiles.length} hồ sơ
        </span>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs">
          <p className="font-semibold text-[var(--red)]">Không lấy được danh sách hồ sơ.</p>
          <p className="mt-1 text-[var(--text-dim)]">{error}</p>
          <button onClick={reload} className="btn btn-danger btn-sm mt-3">
            ⟳ Thử lại
          </button>
        </div>
      ) : loading ? (
        <Spinner label="Đang tải danh sách hồ sơ…" />
      ) : (
        <div className="sk-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="sk-dtable">
              <thead>
                <tr>
                  <th>Tên hồ sơ</th>
                  <th>Tốc độ (rate-limit)</th>
                  <th>Số user dùng chung</th>
                  <th>Idle timeout</th>
                  <th>MAC cookie</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center font-mono text-xs text-[var(--text-faint)]">
                      Không có hồ sơ nào.
                    </td>
                  </tr>
                )}
                {filtered.map((p) => (
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
                          <button onClick={() => openEdit(p)} className="btn btn-secondary btn-sm h-7 px-2 text-[11px]">
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            disabled={busyId === p['.id'] || p.default === 'true'}
                            className="btn btn-ghost btn-sm h-7 px-2 text-[11px] text-[var(--red)] hover:bg-[var(--red-bg)] disabled:opacity-30"
                            title={p.default === 'true' ? 'Không xóa được hồ sơ mặc định' : undefined}
                          >
                            {busyId === p['.id'] ? '…' : 'Xóa'}
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

      {/* Modal tạo / sửa hồ sơ */}
      <Modal
        open={formOpen}
        title={editing ? `Sửa hồ sơ "${editing.name}"` : 'Thêm hồ sơ mới'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn btn-secondary btn-sm">
              Hủy
            </button>
            <button onClick={handleSubmit} disabled={formBusy} className="btn btn-primary btn-sm">
              {formBusy ? 'Đang lưu…' : editing ? 'Cập nhật' : 'Tạo hồ sơ'}
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

          <Field label="Tên hồ sơ *">
            <input
              id="profile-name"
              name="name"
              className="form-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="vd: khach-4h"
              autoFocus
              disabled={!!editing}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Giới hạn tốc độ (rate-limit)" hint="vd: 10M/10M, 5M/2M">
              <input
                id="profile-rate"
                name="rate-limit"
                className="form-input"
                value={form['rate-limit']}
                onChange={(e) => set('rate-limit', e.target.value)}
                placeholder="vd: 10M/10M"
              />
            </Field>
            <Field label="Số user dùng chung" hint="vd: 1, 5, unlimited">
              <input
                id="profile-shared"
                name="shared-users"
                className="form-input"
                value={form['shared-users']}
                onChange={(e) => set('shared-users', e.target.value)}
                placeholder="vd: 1"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Idle timeout">
              <input
                id="profile-idle"
                name="idle-timeout"
                className="form-input"
                value={form['idle-timeout']}
                onChange={(e) => set('idle-timeout', e.target.value)}
                placeholder="vd: 5m, none"
              />
            </Field>
            <Field label="Keepalive timeout">
              <input
                id="profile-keepalive"
                name="keepalive-timeout"
                className="form-input"
                value={form['keepalive-timeout']}
                onChange={(e) => set('keepalive-timeout', e.target.value)}
                placeholder="vd: 5m"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="MAC cookie timeout">
              <input
                id="profile-maccookie"
                name="mac-cookie-timeout"
                className="form-input"
                value={form['mac-cookie-timeout']}
                onChange={(e) => set('mac-cookie-timeout', e.target.value)}
                placeholder="vd: 3d"
              />
            </Field>
            <Field label="Address list" hint="Tên address-list để kiểm soát">
              <input
                id="profile-addresslist"
                name="address-list"
                className="form-input"
                value={form['address-list']}
                onChange={(e) => set('address-list', e.target.value)}
                placeholder="vd: allowed-hotspot"
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={form['add-mac-cookie'] === 'true'}
              onChange={(e) => set('add-mac-cookie', e.target.checked ? 'true' : 'false')}
            />
            <span className="text-xs text-[var(--text-dim)]">Bật MAC cookie (đăng nhập tự động không hỏi lại)</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}