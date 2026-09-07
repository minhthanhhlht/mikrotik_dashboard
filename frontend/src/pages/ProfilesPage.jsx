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

const inputCls = 'input-ghost';

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label-caps mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
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
        delete body.name; // không đổi tên profile qua PUT
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
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Hồ sơ (Profile)
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Quản lý /ip/hotspot/user/profile · giới hạn tốc độ, thời gian, MAC cookie
          </p>
        </div>
        {canManageProfiles && (
          <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Thêm hồ sơ
          </button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint">
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            id="profiles-search"
            name="profilesSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm hồ sơ…"
            className="input-ghost pl-9"
          />
        </div>
        <span className="text-xs font-medium text-ink-faint">
          {filtered.length}/{profiles.length} hồ sơ
        </span>
      </div>

      {error ? (
        <div className="glass rounded-2xl border-danger/40 p-5 shadow-[0_0_24px_rgba(225,29,72,0.15)]">
          <p className="font-semibold text-danger">Không lấy được danh sách hồ sơ.</p>
          <p className="mt-1 text-sm text-ink-soft">{error}</p>
          <button onClick={reload} className="btn-danger mt-3 px-4 py-2 text-xs">
            ⟳ Thử lại
          </button>
        </div>
      ) : loading ? (
        <Spinner label="Đang tải hồ sơ…" />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="glass-table w-full text-left text-sm">
              <thead>
                <tr className="label-caps">
                  <th className="px-5 py-3.5 font-semibold">Tên</th>
                  <th className="px-5 py-3.5 font-semibold">Tốc độ (rate-limit)</th>
                  <th className="px-5 py-3.5 font-semibold">Số user dùng chung</th>
                  <th className="px-5 py-3.5 font-semibold">Idle timeout</th>
                  <th className="px-5 py-3.5 font-semibold">MAC cookie</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-ink-faint">
                      Không có hồ sơ nào.
                    </td>
                  </tr>
                )}
                {filtered.map((p) => (
                  <tr key={p['.id']}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`neon-dot ${p.default === 'true' ? '' : 'neon-dot-danger'}`} />
                        <span className="font-semibold text-ink">{p.name}</span>
                        {p.default === 'true' && (
                          <span className="rounded-full bg-tertiary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tertiary">
                            default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft">
                      {p['rate-limit'] ? (
                        <span className="rounded-lg bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-deep">
                          {p['rate-limit']}
                        </span>
                      ) : (
                        <span className="text-ink-faint">Không giới hạn</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft">{p['shared-users'] || '1'}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{p['idle-timeout'] || '—'}</td>
                    <td className="px-5 py-3.5 text-ink-soft">
                      {p['add-mac-cookie'] === 'true' ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-primary-soft/60 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                          <span>✓</span> {p['mac-cookie-timeout'] || 'Bật'}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">Tắt</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {canManageProfiles ? (
                        <>
                          <button onClick={() => openEdit(p)} className="btn-ghost px-3 py-1.5 text-xs">
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            disabled={busyId === p['.id'] || p.default === 'true'}
                            className="ml-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
                            title={p.default === 'true' ? 'Không xóa được hồ sơ mặc định' : undefined}
                          >
                            {busyId === p['.id'] ? 'Đang xóa…' : 'Xóa'}
                          </button>
                        </>
                      ) : (
                        <span className="rounded-md bg-ink/5 px-2.5 py-1 text-xs italic text-ink-faint">
                          Chỉ xem
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
            <button onClick={() => setFormOpen(false)} className="btn-ghost px-4 py-2 text-sm">
              Hủy
            </button>
            <button onClick={handleSubmit} disabled={formBusy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {formBusy ? 'Đang lưu…' : editing ? 'Cập nhật' : 'Tạo hồ sơ'}
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

          <Field label="Tên hồ sơ *">
            <input
              id="profile-name"
              name="name"
              className={inputCls}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="vd: khach-4h"
              autoFocus
              disabled={!!editing}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Giới hạn tốc độ (rate-limit)" hint="vd: 10M/10M, 5M/2M">
              <input
                id="profile-rate"
                name="rate-limit"
                className={inputCls}
                value={form['rate-limit']}
                onChange={(e) => set('rate-limit', e.target.value)}
                placeholder="vd: 10M/10M"
              />
            </Field>
            <Field label="Số user dùng chung" hint="vd: 1, 5, unlimited">
              <input
                id="profile-shared"
                name="shared-users"
                className={inputCls}
                value={form['shared-users']}
                onChange={(e) => set('shared-users', e.target.value)}
                placeholder="vd: 1"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Idle timeout">
              <input
                id="profile-idle"
                name="idle-timeout"
                className={inputCls}
                value={form['idle-timeout']}
                onChange={(e) => set('idle-timeout', e.target.value)}
                placeholder="vd: 5m, none"
              />
            </Field>
            <Field label="Keepalive timeout">
              <input
                id="profile-keepalive"
                name="keepalive-timeout"
                className={inputCls}
                value={form['keepalive-timeout']}
                onChange={(e) => set('keepalive-timeout', e.target.value)}
                placeholder="vd: 5m"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="MAC cookie timeout">
              <input
                id="profile-maccookie"
                name="mac-cookie-timeout"
                className={inputCls}
                value={form['mac-cookie-timeout']}
                onChange={(e) => set('mac-cookie-timeout', e.target.value)}
                placeholder="vd: 3d"
              />
            </Field>
            <Field label="Address list" hint="Tên address-list để kiểm soát truy cập">
              <input
                id="profile-addresslist"
                name="address-list"
                className={inputCls}
                value={form['address-list']}
                onChange={(e) => set('address-list', e.target.value)}
                placeholder="vd: allowed-hotspot"
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-soft">
            <span>Cho phép MAC cookie (đăng nhập tự động)</span>
            <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-ink/10">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={form['add-mac-cookie'] === 'true'}
                onChange={(e) => set('add-mac-cookie', e.target.checked ? 'true' : 'false')}
              />
              <span className="inline-block h-5 w-5 translate-x-0.5 transform rounded-full bg-white shadow transition peer-checked:translate-x-[22px] peer-checked:shadow-[0_0_12px_rgba(0,132,255,0.7)]" />
            </span>
          </label>
        </form>
      </Modal>
    </div>
  );
}