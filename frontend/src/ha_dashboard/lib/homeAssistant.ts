import type {
  ActionResult,
  ConnectionState,
  HAConfig,
  HAState,
  StateChangedEvent,
} from './types'
import { mockStates as mockMockStates } from '../data/mockData'

/**
 * Service kết nối Home Assistant.
 * - WebSocket: đăng ký theo dõi state thay đổi (realtime).
 * - REST API: call service để điều khiển entity.
 *
 * Hoạt động theo 2 chế độ:
 *  - real: kết nối HA thật
 *  - mock: dữ liệu giả lập (không có socket)
 */
export class HomeAssistantService {
  private ws: WebSocket | null = null
  private connState: ConnectionState = 'mock'
  private config: HAConfig | null = null
  private states = new Map<string, HAState>()
  private eventId = 0
  private connectTimeout = 15000
  private pendingRequests = new Map<number, { resolve: (res: unknown) => void; reject: (err: Error) => void }>()

  // Handlers
  private stateHandlers = new Set<(evt: StateChangedEvent) => void>()
  private connectionHandlers = new Set<(state: ConnectionState) => void>()
  private noteHandlers = new Set<(msg: string) => void>()

  /* ============ Đăng ký / hủy handler ============ */

  onStateChanged(handler: (evt: StateChangedEvent) => void): () => void {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  onConnectionState(handler: (state: ConnectionState) => void): () => void {
    this.connectionHandlers.add(handler)
    return () => this.connectionHandlers.delete(handler)
  }

  onNotification(handler: (msg: string) => void): () => void {
    this.noteHandlers.add(handler)
    return () => this.noteHandlers.delete(handler)
  }

  getConnectionState(): ConnectionState {
    return this.connState
  }

  /** Đặt timeout kết nối WebSocket (ms) — đọc từ env hoặc mặc định 15000 */
  setConnectTimeout(ms: number) {
    if (Number.isFinite(ms) && ms > 0) this.connectTimeout = ms
  }

  /* ============ Kết nối ============ */

  async connect(config: HAConfig): Promise<void> {
    this.disconnect()
    this.config = config

    if (config.useMock) {
      // Chế độ demo: nạp mock data
      this.states.clear()
      mockMockStates.forEach((s) => this.states.set(s.entity_id, s))
      this.setConnectionState('mock')
      return
    }

    this.setConnectionState('connecting')
    try {
      await this.connectWebSocket()
      await this.fetchStates()
    } catch (err) {
      console.warn('Không thể kết nối HA thật, tự động fallback sang Demo:', err)
      this.states.clear()
      mockMockStates.forEach((s) => this.states.set(s.entity_id, s))
      this.setConnectionState('mock')
    }
  }

  private async connectWebSocket(): Promise<void> {
    if (!this.config) return
    const { host, token, useTls } = this.config
    const proto = useTls ? 'wss' : 'ws'
    // Với HASS, websocket endpoint là /api/websocket
    const url = `${proto}://${host}/api/websocket`

    return new Promise<void>((resolve, reject) => {
      let isDone = false
      const ws = new WebSocket(url)
      this.ws = ws

      const timeout = setTimeout(() => {
        if (!isDone) {
          isDone = true
          reject(new Error('Hết thời gian kết nối WebSocket'))
          ws.close()
        }
      }, this.connectTimeout)

      ws.onopen = () => {
        // Đợi gói tin auth_required từ HA trước khi gửi auth
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string)
          this.handleMessage(msg, {
            onAuthOk: () => {
              if (!isDone) {
                isDone = true
                clearTimeout(timeout)
                this.setConnectionState('connected')
                this.subscribeToStates()
                resolve()
              }
            },
            onAuthRequired: () => {
              this.sendRaw({ type: 'auth', access_token: token })
            },
            onError: (err: string) => {
              if (!isDone) {
                isDone = true
                clearTimeout(timeout)
                this.noteHandlers.forEach((h) => h(err))
                this.setConnectionState('disconnected')
                reject(new Error(err))
              }
            },
          })
        } catch (e) {
          console.error('Lỗi parse message WebSocket:', e)
        }
      }

      ws.onerror = () => {
        if (!isDone) {
          isDone = true
          clearTimeout(timeout)
          this.noteHandlers.forEach((h) =>
            h('Không thể kết nối WebSocket tới Home Assistant.'),
          )
          this.setConnectionState('disconnected')
          reject(new Error('Lỗi WebSocket'))
          ws.close()
        }
      }

      ws.onclose = () => {
        clearTimeout(timeout)
        if (this.connState === 'connected' || this.connState === 'connecting') {
          this.setConnectionState('disconnected')
          this.scheduleReconnect()
        }
      }
    })
  }

  private sendRaw(msg: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  public sendCommand<T = unknown>(msg: Omit<Record<string, unknown>, 'id'>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket chưa kết nối'))
      }
      this.eventId += 1
      const id = this.eventId
      this.pendingRequests.set(id, {
        resolve: resolve as (res: unknown) => void,
        reject,
      })
      this.ws.send(JSON.stringify({ ...msg, id }))
    })
  }

  private handleMessage(
    msg: Record<string, unknown>,
    cb: {
      onAuthOk?: () => void
      onAuthRequired?: () => void
      onError?: (err: string) => void
    },
  ) {
    const type = msg.type
    if (type === 'auth_ok' && cb.onAuthOk) cb.onAuthOk()
    if (type === 'auth_required' && cb.onAuthRequired) cb.onAuthRequired()
    if (type === 'auth_invalid' && cb.onError)
      cb.onError('Token xác thực không hợp lệ (Auth Invalid).')

    if (type === 'result') {
      const id = msg.id as number | undefined
      if (typeof id === 'number' && this.pendingRequests.has(id)) {
        const pending = this.pendingRequests.get(id)!
        this.pendingRequests.delete(id)
        if (msg.success) {
          pending.resolve(msg.result)
        } else {
          const errMsg =
            ((msg.error as { message?: string })?.message || msg.error || 'Lỗi lệnh WebSocket') as string
          pending.reject(new Error(errMsg))
        }
      } else if (msg.success === false) {
        this.noteHandlers.forEach((h) => h((msg.error as string) ?? 'Lỗi không xác định'))
      }
    }

    if (type === 'event' && (msg.event as { event_type?: string })?.event_type === 'state_changed') {
      const data = msg.event as { data: StateChangedEvent }
      this.applyStateChange(data.data)
    }
  }

  private applyStateChange(evt: StateChangedEvent) {
    if (evt.new_state) this.states.set(evt.entity_id, evt.new_state)
    else this.states.delete(evt.entity_id)
    this.stateHandlers.forEach((h) => h(evt))
  }

  private subscribeToStates() {
    this.sendCommand({
      type: 'subscribe_events',
      event_type: 'state_changed',
    }).catch((err) => {
      console.warn('Lỗi subscribe_events:', err)
    })
  }

  private scheduleReconnect() {
    // Thử kết nối lại sau 5 giây nếu vẫn có config
    setTimeout(() => {
      if (this.config && !this.config.useMock) {
        this.connect(this.config).catch(() => {
          this.setConnectionState('disconnected')
        })
      }
    }, 5000)
  }

  async fetchStates(): Promise<void> {
    if (this.config?.useMock || !this.config) return
    try {
      const states = await this.sendCommand<HAState[]>({ type: 'get_states' })
      if (Array.isArray(states)) {
        this.states.clear()
        states.forEach((s) => this.states.set(s.entity_id, s))
        this.stateHandlers.forEach((h) =>
          h({ entity_id: '', new_state: null, old_state: null }),
        )
      }
    } catch (err) {
      console.warn('Lỗi fetchStates qua WebSocket:', err)
    }
  }

  /* ============ Truy vấn ============ */

  getState(entityId: string): HAState | undefined {
    return this.states.get(entityId)
  }

  getAllStates(): HAState[] {
    return Array.from(this.states.values())
  }

  getStatesByDomain(domain: string): HAState[] {
    return Array.from(this.states.values()).filter((s) =>
      s.entity_id.startsWith(`${domain}.`),
    )
  }

  /* ============ Actions (call service) ============ */

  async callService(domain: string, service: string, data: Record<string, unknown>): Promise<ActionResult> {
    if (this.config?.useMock || this.connState === 'mock' || !this.config) {
      this.applyMockAction(domain, service, data)
      return { ok: true }
    }

    try {
      await this.sendCommand({
        type: 'call_service',
        domain,
        service,
        service_data: data,
      })
      return { ok: true }
    } catch (err) {
      console.error('Lỗi callService qua WebSocket:', err)
      return { ok: false, error: (err as Error).message }
    }
  }

  /* ============ Helper action theo từng loại ============ */

  toggle(entityId: string): Promise<ActionResult> {
    const [domain] = entityId.split('.')
    return this.callService(domain, 'toggle', { entity_id: entityId })
  }

  turnOn(entityId: string, extra: Record<string, unknown> = {}): Promise<ActionResult> {
    const [domain] = entityId.split('.')
    return this.callService(domain, 'turn_on', { entity_id: entityId, ...extra })
  }

  turnOff(entityId: string): Promise<ActionResult> {
    const [domain] = entityId.split('.')
    return this.callService(domain, 'turn_off', { entity_id: entityId })
  }

  setBrightness(entityId: string, brightness: number): Promise<ActionResult> {
    return this.callService('light', 'turn_on', { entity_id: entityId, brightness })
  }

  setClimateTemperature(entityId: string, temperature: number, mode?: string): Promise<ActionResult> {
    return this.callService('climate', 'set_temperature', {
      entity_id: entityId,
      temperature,
      ...(mode ? { hvac_mode: mode } : {}),
    })
  }

  setClimateMode(entityId: string, mode: string): Promise<ActionResult> {
    return this.callService('climate', 'set_hvac_mode', { entity_id: entityId, hvac_mode: mode })
  }

  setClimateFanMode(entityId: string, fanMode: string): Promise<ActionResult> {
    return this.callService('climate', 'set_fan_mode', { entity_id: entityId, fan_mode: fanMode })
  }

  setCoverPosition(entityId: string, position: number): Promise<ActionResult> {
    if (position <= 0) return this.callService('cover', 'close_cover', { entity_id: entityId })
    if (position >= 100) return this.callService('cover', 'open_cover', { entity_id: entityId })
    return this.callService('cover', 'set_cover_position', {
      entity_id: entityId,
      position,
    })
  }

  setMediaVolume(entityId: string, volume: number): Promise<ActionResult> {
    return this.callService('media_player', 'volume_set', {
      entity_id: entityId,
      volume_level: volume,
    })
  }

  mediaControl(entityId: string, action: 'play_pause' | 'next' | 'previous'): Promise<ActionResult> {
    return this.callService('media_player', action, { entity_id: entityId })
  }

  setFanSpeed(entityId: string, percentage: number): Promise<ActionResult> {
    return this.callService('fan', 'set_percentage', {
      entity_id: entityId,
      percentage,
    })
  }

  lock(entityId: string, open: boolean): Promise<ActionResult> {
    return this.callService('lock', open ? 'unlock' : 'lock', { entity_id: entityId })
  }

  /** Áp dụng thay đổi state cục bộ khi ở chế độ mock để UI phản hồi */
  private applyMockAction(
    domain: string,
    service: string,
    data: Record<string, unknown>,
  ) {
    const entityId = String(data.entity_id ?? '')
    const current = this.states.get(entityId)
    if (!current) return

    const attrs = { ...current.attributes }
    let state = current.state

    // toggle / turn_on / turn_off cho các domain
    if (service === 'toggle') {
      state = current.state === 'on' ? 'off' : 'on'
      if (domain === 'light' && state === 'on')
        attrs.brightness = Number(attrs.brightness ?? 200)
      if (domain === 'climate') {
        state = current.state === 'off' ? 'cool' : 'off'
      }
    } else if (service === 'turn_on') {
      state = 'on'
      if (data.brightness !== undefined) attrs.brightness = data.brightness
      if (domain === 'climate' && !(attrs.hvac_modes as string[]).includes(current.state)) {
        state = (attrs.hvac_modes as string[])[0] ?? 'auto'
      }
    } else if (service === 'turn_off') {
      state = 'off'
    } else if (domain === 'climate' && service === 'set_temperature') {
      if (data.temperature !== undefined) attrs.temperature = data.temperature
      if (data.hvac_mode) state = String(data.hvac_mode)
      if (current.state === 'off') state = 'cool'
    } else if (domain === 'climate' && service === 'set_hvac_mode') {
      state = String(data.hvac_mode ?? current.state)
    } else if (domain === 'climate' && service === 'set_fan_mode') {
      attrs.fan_mode = data.fan_mode
    } else if (domain === 'cover' && service === 'set_cover_position') {
      attrs.current_position = data.position
      state = Number(data.position) === 0 ? 'closed' : 'open'
    } else if (domain === 'cover' && service === 'open_cover') {
      attrs.current_position = 100
      state = 'open'
    } else if (domain === 'cover' && service === 'close_cover') {
      attrs.current_position = 0
      state = 'closed'
    } else if (domain === 'media_player' && service === 'volume_set') {
      attrs.volume_level = data.volume_level
    } else if (domain === 'media_player' && service === 'play_pause') {
      state = current.state === 'playing' ? 'paused' : 'playing'
    } else if (domain === 'fan' && service === 'set_percentage') {
      attrs.percentage = data.percentage
    } else if (domain === 'fan' && service === 'set_preset_mode') {
      attrs.preset_mode = data.preset_mode
    } else if (domain === 'lock' && (service === 'lock' || service === 'unlock')) {
      state = service === 'unlock' ? 'unlocked' : 'locked'
    }

    const updated: HAState = {
      ...current,
      state,
      attributes: attrs,
      last_updated: new Date().toISOString(),
      last_changed: new Date().toISOString(),
    }
    this.states.set(entityId, updated)
    this.applyStateChange({
      entity_id: entityId,
      new_state: updated,
      old_state: current,
    })
  }

  /* ============ Dọn dẹp ============ */

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connState = 'mock'
  }

  private setConnectionState(state: ConnectionState) {
    this.connState = state
    this.connectionHandlers.forEach((h) => h(state))
  }
}

/** Singleton instance dùng chung toàn app */
export const haService = new HomeAssistantService()
