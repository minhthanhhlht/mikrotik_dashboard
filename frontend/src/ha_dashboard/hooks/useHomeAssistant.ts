import { useCallback, useEffect, useRef, useState } from 'react'
import { haService } from '../lib/homeAssistant'
import { getEnvHAConfig, getEnvConnectTimeout } from '../lib/env'
import type { ConnectionState, HAConfig, HAState } from '../lib/types'

/**
 * Hook trung tâm: quản lý kết nối HA, danh sách states và các action.
 */
export function useHomeAssistant() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    haService.getConnectionState(),
  )
  const [states, setStates] = useState<HAState[]>([])
  const [notice, setNotice] = useState<string>('')
  const [config, setConfig] = useState<HAConfig | null>(null)
  const initialized = useRef(false)

  const refreshStates = useCallback(() => {
    setStates(haService.getAllStates())
  }, [])

  useEffect(() => {
    // Lắng nghe thay đổi connection state
    const unsubConn = haService.onConnectionState((s) => {
      setConnectionState(s)
      refreshStates()
    })

    // Lắng nghe thay đổi từng state
    const unsubState = haService.onStateChanged(() => {
      refreshStates()
    })

    const unsubNote = haService.onNotification((msg) => {
      setNotice(msg)
      setTimeout(() => setNotice(''), 4000)
    })

    refreshStates()

    return () => {
      unsubConn()
      unsubState()
      unsubNote()
    }
  }, [refreshStates])

  // Tự động kết nối một lần khi mount: ưu tiên HA thật từ .env, fallback mock
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      // Cho phép service đọc timeout từ env
      haService.setConnectTimeout(getEnvConnectTimeout())

      const envConfig = getEnvHAConfig()
      const config = envConfig ?? { host: '', token: '', useTls: false, useMock: true }
      setConfig(config)
      haService.connect(config).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = useCallback(async (cfg: HAConfig) => {
    setConfig(cfg)
    await haService.connect(cfg)
    refreshStates()
  }, [refreshStates])

  /**
   * Kết nối bằng cấu hình đọc từ biến môi trường (.env).
   * env.ts đã ưu tiên HA thật khi có host + token; ngược lại -> chế độ demo.
   * Token KHÔNG nhập qua UI, chỉ lấy từ env.
   */
  const connectFromEnv = useCallback(async () => {
    const envConfig =
      getEnvHAConfig() ?? { host: '', token: '', useTls: false, useMock: true }
    setConfig(envConfig)
    await haService.connect(envConfig)
    refreshStates()
  }, [refreshStates])

  const disconnect = useCallback(() => {
    haService.disconnect()
    setConfig(null)
    refreshStates()
  }, [refreshStates])

  return {
    connectionState,
    states,
    config,
    setConfig,
    notice,
    connect,
    connectFromEnv,
    disconnect,
    refresh: refreshStates,
    service: haService,
  }
}
