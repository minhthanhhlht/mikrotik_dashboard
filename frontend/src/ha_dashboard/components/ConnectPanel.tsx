import type { ConnectionState } from '../lib/types'

export interface ConnectPanelProps {
  connectionState?: ConnectionState
  hasEnvToken?: boolean
  onConnectFromEnv?: () => void
}

export function ConnectPanel({
  connectionState = 'disconnected',
}: ConnectPanelProps) {
  return (
    <section id="connect" className="py-2">
      <div className="sk-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="sk-tag sk-tag--dev">GATEWAY</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Trạng thái kết nối Home Assistant
            </span>
          </div>
          <span className="sk-state sk-state--accent font-mono text-xs uppercase">
            {connectionState}
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Hệ thống đang kết nối trực tiếp đến Home Assistant qua WebSocket realtime và giao thức OAuth2 Password Grant.
        </p>
      </div>
    </section>
  )
}

export default ConnectPanel
