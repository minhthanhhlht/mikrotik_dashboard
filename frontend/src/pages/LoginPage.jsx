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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await login(username.trim(), password);
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
    <div className="relative flex min-h-screen items-center justify-center">
      {/* Ambient orbs */}
      <div className="orb orb-cyan" />
      <div className="orb orb-magenta" />
      <div className="orb orb-violet" />

      <div className="glass glass-glow relative z-10 w-full max-w-sm rounded-2xl p-8">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#00a2ff] text-white shadow-[0_0_26px_rgba(0,132,255,0.6)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <rect x="3" y="8" width="18" height="8" rx="2" />
              <circle cx="6.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
              <circle cx="9" cy="12" r="0.6" fill="currentColor" stroke="none" />
              <path d="M16 10.5h3M16 13.5h2" />
              <path d="M7 16v3M12 16v3" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              Hotspot Admin
            </h1>
            <p className="label-caps mt-1">MikroTik · Đăng nhập quản trị</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <label className="block">
            <span className="label-caps mb-1.5 block">Tài khoản</span>
            <input
              id="login-username"
              name="username"
              className="input-ghost"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vd: admin"
              autoFocus
              autoComplete="username"
            />
          </label>

          <label className="block">
            <span className="label-caps mb-1.5 block">Mật khẩu</span>
            <input
              id="login-password"
              name="password"
              type="password"
              className="input-ghost"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={busy} className="btn-primary mt-2 w-full justify-center px-4 py-2.5 text-sm disabled:opacity-50">
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-faint">
          RouterOS 7 · REST API · Neon Glass Light
        </p>
      </div>
    </div>
  );
}