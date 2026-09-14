import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await login(username.trim(), password, rememberMe);
      toast.success(`Chào mừng ${res?.fullName || res?.username || username}!`, 'Đăng nhập thành công');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      toast.error(err.message, 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-body)] bg-grid p-4 text-[var(--text)]">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-8 shadow-[var(--shadow-lg)]">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <rect x="3" y="8" width="18" height="8" rx="2" />
              <circle cx="6.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
              <circle cx="9" cy="12" r="0.6" fill="currentColor" stroke="none" />
              <path d="M16 10.5h3M16 13.5h2" />
              <path d="M7 16v3M12 16v3" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
              Hotspot & Infra Console
            </h1>
            <p className="font-mono text-[11px] text-[var(--text-faint)] uppercase tracking-wider mt-0.5">
              MikroTik RouterOS 7 · REST Interface
            </p>
          </div>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--red-bg)] border border-[rgba(251,111,111,0.3)] p-3 text-xs font-medium text-[var(--red)]">
              {error}
            </div>
          )}

          <div>
            <label className="form-label">Tài khoản</label>
            <input
              id="login-username"
              name="username"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vd: admin"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="form-label">Mật khẩu</label>
            <input
              id="login-password"
              name="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-[var(--text-dim)] hover:text-[var(--text)] select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="cursor-pointer"
              />
              <span>Ghi nhớ đăng nhập (3 ngày)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full mt-2 h-10 font-semibold"
          >
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập vào hệ thống'}
          </button>
        </form>

        <div className="mt-6 border-t border-[var(--border-soft)] pt-4 text-center">
          <p className="font-mono text-[11px] text-[var(--text-faint)]">
            ServerKit Infra Console Architecture v1.0
          </p>
        </div>
      </div>
    </div>
  );
}