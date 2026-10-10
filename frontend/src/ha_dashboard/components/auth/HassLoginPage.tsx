import { useState } from 'react'
import type { ConnectionState, HAConfig } from '../../lib/types'
import { getEnvHAConfig } from '../../lib/env'
import { authenticateWithCredentials } from '../../lib/auth'

export interface LoginPageProps {
  onLogin: (config: HAConfig) => Promise<void>
  connectionState: ConnectionState
  errorMessage?: string
  onLoginFromEnv?: () => Promise<void>
  onExploreOffline?: () => void
}

export default function LoginPage({
  onLogin,
  connectionState,
  errorMessage,
}: LoginPageProps) {
  const envCfg = getEnvHAConfig()

  // Form states (Chỉ đăng nhập bằng tài khoản và mật khẩu HASS OS)
  const [host, setHost] = useState(envCfg?.host || '192.168.100.150:8123')
  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('ha_saved_username') || ''
    }
    return ''
  })
  const [password, setPassword] = useState('')
  const [useTls, setUseTls] = useState(envCfg?.useTls ?? false)
  const [rememberUser, setRememberUser] = useState(true)

  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  // Xử lý đăng nhập bằng Username & Password HASS OS
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (!host.trim()) {
      setLocalError('Vui lòng nhập Host hoặc IP của Home Assistant')
      return
    }
    if (!username.trim()) {
      setLocalError('Vui lòng nhập Tên đăng nhập (Username HASS OS)')
      return
    }
    if (!password) {
      setLocalError('Vui lòng nhập Mật khẩu (Password)')
      return
    }

    setIsLoading(true)
    try {
      if (rememberUser) {
        localStorage.setItem('ha_saved_username', username.trim())
      } else {
        localStorage.removeItem('ha_saved_username')
      }

      const accessToken = await authenticateWithCredentials({
        host: host.trim(),
        username: username.trim(),
        password,
        useTls,
      })

      await onLogin({
        host: host.trim(),
        token: accessToken,
        useTls,
        useMock: false,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập không thành công'
      setLocalError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const errorToShow = localError || errorMessage

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-body, #05070d)',
        color: 'var(--text, #f1f5f9)',
        minHeight: '100vh',
      }}
      className="tech-grid-bg relative flex min-h-screen items-center justify-center p-4 sm:p-6"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div
        style={{
          backgroundColor: 'var(--surface, rgba(15, 23, 42, 0.85))',
          borderColor: 'var(--border-strong, rgba(255, 255, 255, 0.12))',
        }}
        className="relative z-10 w-full max-w-md rounded-2xl border p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold text-lg shadow-lg">
            HA
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Đăng Nhập Home Assistant OS
          </h1>
          <p className="text-xs text-[var(--text-dim)]">
            Sử dụng tài khoản & mật khẩu quản trị viên hoặc người dùng của bạn trên HASS OS
          </p>
        </div>

        {errorToShow && (
          <div className="rounded-lg bg-red-500/15 border border-red-500/30 p-3.5 text-xs text-red-400 flex items-start gap-2">
            <span className="text-sm">⚠️</span>
            <span>{errorToShow}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-[var(--text-dim)] mb-1.5 uppercase">
              1. Địa chỉ Host / IP Home Assistant
            </label>
            <input
              type="text"
              required
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.100.150:8123 hoặc homeassistant.local:8123"
              className="sk-input w-full font-mono text-xs px-3.5 py-2.5 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-[var(--text-dim)] mb-1.5 uppercase">
              2. Tên đăng nhập (Username HASS OS)
            </label>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập HASS OS của bạn"
              className="sk-input w-full font-mono text-xs px-3.5 py-2.5 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-[var(--text-dim)] mb-1.5 uppercase">
              3. Mật khẩu (Password)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="sk-input w-full font-mono text-xs px-3.5 py-2.5 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--text-dim)] select-none pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberUser}
                onChange={(e) => setRememberUser(e.target.checked)}
                className="rounded border-[var(--border)] bg-[var(--surface-active)] text-cyan-500 focus:ring-0"
              />
              <span>Ghi nhớ tài khoản</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useTls}
                onChange={(e) => setUseTls(e.target.checked)}
                className="rounded border-[var(--border)] bg-[var(--surface-active)] text-cyan-500 focus:ring-0"
              />
              <span>HTTPS / WSS</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-cyan-500/20 mt-2"
          >
            {isLoading ? (
              <span>⏳ Đang xác thực với Home Assistant...</span>
            ) : (
              <span>🚀 Đăng Nhập</span>
            )}
          </button>
        </form>

        <div className="text-center pt-2 space-y-1 border-t border-[var(--border-soft)]">
          <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-[var(--text-faint)]">
            <span>Trạng thái kết nối:</span>
            <span className="sk-state uppercase text-[10px]">{connectionState}</span>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-faint)] block">
            Home Assistant v1.0 Console · ServerKit Design System
          </span>
        </div>
      </div>
    </div>
  )
}
