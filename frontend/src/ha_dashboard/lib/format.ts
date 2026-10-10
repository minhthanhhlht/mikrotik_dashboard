import type { HAState } from './types'

/** Lấy friendly_name hoặc entity_id fallback */
export function friendlyName(state: HAState): string {
  const fn = state.attributes['friendly_name']
  return typeof fn === 'string' && fn.length > 0 ? fn : state.entity_id
}

/** Lấy domain từ entity_id */
export function domainOf(entityId: string): string {
  return entityId.split('.')[0]
}

/** Kiểm tra trạng thái "bật" (on) */
export function isOn(state: HAState): boolean {
  return state.state === 'on'
}

/** Map icon cho từng domain (dùng emoji & màu) */
export interface DomainMeta {
  icon: string
  color: string
  glow: string
  label: string
}

export const domainMeta: Record<string, DomainMeta> = {
  light: {
    icon: '💡',
    color: 'text-[#80ffec]',
    glow: 'shadow-[0_0_24px_rgba(5,222,201,0.4)]',
    label: 'Đèn',
  },
  switch: {
    icon: '🔌',
    color: 'text-[#ffb454]',
    glow: 'shadow-[0_0_24px_rgba(255,180,84,0.4)]',
    label: 'Công tắc',
  },
  climate: {
    icon: '♨️',
    color: 'text-[#ffafd2]',
    glow: 'shadow-[0_0_24px_rgba(208,0,138,0.4)]',
    label: 'Điều hòa',
  },
  sensor: {
    icon: '📊',
    color: 'text-[#d3c6ff]',
    glow: 'shadow-[0_0_24px_rgba(93,56,206,0.4)]',
    label: 'Cảm biến',
  },
  binary_sensor: {
    icon: '🚨',
    color: 'text-[#ffb454]',
    glow: 'shadow-[0_0_24px_rgba(255,180,84,0.4)]',
    label: 'Cảm biến trạng thái',
  },
  cover: {
    icon: '🪟',
    color: 'text-[#80ffec]',
    glow: 'shadow-[0_0_24px_rgba(5,222,201,0.4)]',
    label: 'Rèm cửa',
  },
  media_player: {
    icon: '🎵',
    color: 'text-[#ffafd2]',
    glow: 'shadow-[0_0_24px_rgba(208,0,138,0.4)]',
    label: 'Media',
  },
  fan: {
    icon: '🌀',
    color: 'text-[#d3c6ff]',
    glow: 'shadow-[0_0_24px_rgba(93,56,206,0.4)]',
    label: 'Quạt',
  },
  lock: {
    icon: '🔒',
    color: 'text-[#ffb454]',
    glow: 'shadow-[0_0_24px_rgba(255,180,84,0.4)]',
    label: 'Khóa',
  },
  camera: {
    icon: '📷',
    color: 'text-[#80ffec]',
    glow: 'shadow-[0_0_24px_rgba(5,222,201,0.4)]',
    label: 'Camera',
  },
  scene: {
    icon: '🎬',
    color: 'text-[#d3c6ff]',
    glow: 'shadow-[0_0_24px_rgba(93,56,206,0.4)]',
    label: 'Kịch bản',
  },
}

export function getDomainMeta(state: HAState): DomainMeta {
  const d = domainOf(state.entity_id)
  return (
    domainMeta[d] ?? {
      icon: '🔹',
      color: 'text-[#bacac6]',
      glow: '',
      label: d,
    }
  )
}

/** Định dạng giá trị sensor + đơn vị */
export function formatSensorValue(state: HAState): string {
  const uom = state.attributes['unit_of_measurement']
  const value = state.state
  if (uom) return `${value}${uom}`
  return value
}

/** Map device_class -> nhãn tiếng Việt cho binary_sensor */
export function binarySensorLabel(state: HAState): string {
  const dc = state.attributes['device_class'] as string | undefined
  const on = isOn(state)
  switch (dc) {
    case 'motion':
      return on ? 'Có chuyển động' : 'Không có chuyển động'
    case 'door':
      return on ? 'Cửa đang mở' : 'Cửa đang đóng'
    case 'garage_door':
      return on ? 'Cổng đang mở' : 'Cổng đang đóng'
    case 'window':
      return on ? 'Cửa sổ đang mở' : 'Cửa sổ đang đóng'
    case 'battery':
      return on ? 'Pin yếu' : 'Pin bình thường'
    default:
      return on ? 'Bật' : 'Tắt'
  }
}

/** Định dạng lại label cho HVAC mode */
export const hvacLabels: Record<string, string> = {
  off: 'Tắt',
  heat: 'Sưởi',
  cool: 'Làm lạnh',
  dry: 'Hút ẩm',
  fan_only: 'Quạt gió',
  auto: 'Tự động',
}

export const fanLabels: Record<string, string> = {
  auto: 'Tự động',
  low: 'Thấp',
  medium: 'Vừa',
  high: 'Cao',
}

/** Calendar/clock helper */
export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
