import type { HAConfig } from './types'

/**
 * Đọc cấu hình Home Assistant từ biến môi trường Vite (VITE_HA_*).
 * Hỗ trợ chuyển đổi giữa chế độ Demo (Mock) và kết nối HA thực tế.
 */
export function getEnvHAConfig(): HAConfig | null {
  const host = (import.meta.env.VITE_HA_HOST as string | undefined) || '192.168.20.20:8123'
  const token = (import.meta.env.VITE_HA_TOKEN as string | undefined) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI1YTBjNDFkZWJlNjc0YzVlOGUyZmM0YjE0NDlkMTYwYiIsImlhdCI6MTc4NTY3MjE5MywiZXhwIjoyMTAxMDMyMTkzfQ.FWQiFLwqwWOiu67NxK_yw5Vdm7Gg6hTIhHngAP8oXw0'
  const rawTls = import.meta.env.VITE_HA_USE_TLS as string | undefined
  const rawMock = import.meta.env.VITE_HA_USE_MOCK as string | undefined

  const toBool = (v: string | undefined, def: boolean) => {
    if (v === undefined || v === '') return def
    return v.toLowerCase() === 'true' || v === '1'
  }

  const explicitMock = toBool(rawMock, false)
  const localMode = typeof window !== 'undefined' ? localStorage.getItem('hass_mode') : null
  const isMockMode = localMode === 'mock' || (localMode !== 'real' && explicitMock)

  // Nếu người dùng chọn Mock hoặc chưa cấu hình token -> chạy Demo
  if (isMockMode) {
    return {
      host: host ?? '',
      token: token ?? '',
      useTls: toBool(rawTls, false),
      useMock: true,
    }
  }

  let cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!cleanHost.includes(':')) {
    cleanHost = `${cleanHost}:8123`
  }

  // Kết nối HA thật khi có host + token và không bật mock
  return {
    host: cleanHost,
    token,
    useTls: toBool(rawTls, false),
    useMock: false,
  }
}

/** Lấy timeout kết nối từ env (mặc định 3000ms để không bị treo lâu khi offline) */
export function getEnvConnectTimeout(): number {
  const raw = import.meta.env.VITE_HA_CONNECT_TIMEOUT as string | undefined
  const num = Number(raw)
  return Number.isFinite(num) && num > 0 ? num : 3000
}

/** Có cấu hình env để kết nối HA thật không */
export function hasEnvHAToken(): boolean {
  const cfg = getEnvHAConfig()
  return cfg !== null && cfg.token.length > 0 && cfg.host.length > 0 && !cfg.useMock
}
