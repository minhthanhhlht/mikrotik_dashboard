/**
 * Các kiểu dữ liệu cho Home Assistant entities
 */

export type Domain =
  | 'light'
  | 'switch'
  | 'climate'
  | 'sensor'
  | 'binary_sensor'
  | 'cover'
  | 'media_player'
  | 'fan'
  | 'lock'
  | 'camera'
  | 'scene'

/** Trạng thái kết nối */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'mock'

/** Entity cơ bản của Home Assistant */
export interface HAState {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  last_changed: string
  last_updated: string
  context: { id: string; parent_id?: string; user_id?: string }
}

/** Cấu hình kết nối HA */
export interface HAConfig {
  host: string
  token: string
  useTls: boolean
  useMock: boolean
}

/** Sự kiện thay đổi state từ WebSocket */
export interface StateChangedEvent {
  entity_id: string
  new_state: HAState | null
  old_state: HAState | null
}

/** Kết quả của một action */
export interface ActionResult {
  ok: boolean
  error?: string
}
