import type { HAState } from '../lib/types'

/**
 * Dữ liệu mẫu (mock) mô phỏng nhiều loại entity của Home Assistant.
 * Được sử dụng khi chưa kết nối được tới HA thật hoặc bật chế độ demo.
 */

const now = new Date().toISOString()

const base = (entity_id: string, state: string, attributes: Record<string, unknown>): HAState => ({
  entity_id,
  state,
  attributes,
  last_changed: now,
  last_updated: now,
  context: { id: `mock-${entity_id}` },
})

export const mockStates: HAState[] = [
  // ===== Phòng khách (Living Room) =====
  base('light.living_room_ceiling', 'on', {
    friendly_name: 'Đèn trần phòng khách',
    brightness: 180,
    color_temp: 2700,
    supported_features: 3,
  }),
  base('light.living_room_floor_lamp', 'on', {
    friendly_name: 'Đèn cây phòng khách',
    brightness: 120,
    effect: 'Rainbow',
    supported_features: 3,
  }),
  base('switch.living_room_tv', 'off', {
    friendly_name: 'TV phòng khách',
    current_power: 0,
  }),
  base('switch.living_room_air_purifier', 'on', {
    friendly_name: 'Máy lọc không khí',
  }),
  base('climate.living_room', 'cool', {
    friendly_name: 'Điều hòa phòng khách',
    temperature: 24,
    target_temp_low: 18,
    target_temp_high: 32,
    current_temperature: 25.3,
    fan_mode: 'auto',
    fan_modes: ['auto', 'low', 'medium', 'high'],
    hvac_modes: ['off', 'heat', 'cool', 'dry', 'fan_only', 'auto'],
    supported_features: 0,
  }),
  base('sensor.living_room_temperature', '24.5', {
    friendly_name: 'Nhiệt độ phòng khách',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
  base('sensor.living_room_humidity', '60', {
    friendly_name: 'Độ ẩm phòng khách',
    unit_of_measurement: '%',
    device_class: 'humidity',
  }),
  base('sensor.living_room_illuminance', '320', {
    friendly_name: 'Cường độ sáng',
    unit_of_measurement: 'lx',
    device_class: 'illuminance',
  }),
  base('binary_sensor.living_room_motion', 'on', {
    friendly_name: 'Cảm biến chuyển động',
    device_class: 'motion',
  }),
  base('cover.living_room_window', 'closed', {
    friendly_name: 'Rèm cửa phòng khách',
    current_position: 20,
    supported_features: 15,
  }),

  // ===== Nhà bếp (Kitchen) =====
  base('light.kitchen_main', 'on', {
    friendly_name: 'Đèn bếp',
    brightness: 255,
    supported_features: 3,
  }),
  base('switch.kitchen_coffee', 'off', {
    friendly_name: 'Máy pha cà phê',
  }),
  base('switch.kitchen_fridge', 'on', {
    friendly_name: 'Tủ lạnh thông minh',
  }),
  base('switch.kitchen_dishwasher', 'off', {
    friendly_name: 'Máy rửa bát',
  }),
  base('sensor.kitchen_temperature', '22.1', {
    friendly_name: 'Nhiệt độ bếp',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
  base('sensor.kitchen_energy', '1.24', {
    friendly_name: 'Tiêu thụ điện bếp',
    unit_of_measurement: 'kWh',
    device_class: 'energy',
  }),
  base('sensor.kitchen_water', '18.7', {
    friendly_name: 'Tiêu thụ nước',
    unit_of_measurement: 'L',
    device_class: 'water',
  }),

  // ===== Phòng ngủ (Bedroom) =====
  base('light.bedroom_main', 'off', {
    friendly_name: 'Đèn phòng ngủ',
    brightness: 0,
    supported_features: 3,
  }),
  base('light.bedroom_night_stand', 'off', {
    friendly_name: 'Đèn ngủ',
    brightness: 0,
    supported_features: 3,
  }),
  base('switch.bedroom_master_plug', 'off', {
    friendly_name: 'Ổ cắm bàn làm việc',
  }),
  base('climate.bedroom', 'heat', {
    friendly_name: 'Điều hòa phòng ngủ',
    temperature: 25,
    target_temp_low: 16,
    target_temp_high: 30,
    current_temperature: 26.2,
    fan_mode: 'low',
    fan_modes: ['auto', 'low', 'medium', 'high'],
    hvac_modes: ['off', 'heat', 'cool', 'auto'],
    supported_features: 0,
  }),
  base('sensor.bedroom_temperature', '26.2', {
    friendly_name: 'Nhiệt độ phòng ngủ',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
  base('binary_sensor.bedroom_door', 'off', {
    friendly_name: 'Cảm biến cửa phòng ngủ',
    device_class: 'door',
  }),
  base('cover.bedroom_blackout', 'on', {
    friendly_name: 'Rèm che phòng ngủ',
    current_position: 100,
    supported_features: 15,
  }),

  // ===== Phòng tắm (Bathroom) =====
  base('light.bathroom_main', 'off', {
    friendly_name: 'Đèn phòng tắm',
    brightness: 0,
    supported_features: 3,
  }),
  base('switch.bathroom_heater', 'off', {
    friendly_name: 'Đèn sưởi phòng tắm',
  }),
  base('sensor.bathroom_humidity', '72', {
    friendly_name: 'Độ ẩm phòng tắm',
    unit_of_measurement: '%',
    device_class: 'humidity',
  }),
  base('sensor.bathroom_temperature', '28.0', {
    friendly_name: 'Nhiệt độ phòng tắm',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),

  // ===== Ngoài trời / Nhà kho (Outdoor/Garage) =====
  base('switch.garage_main_light', 'off', {
    friendly_name: 'Đèn nhà xe',
  }),
  base('sensor.outdoor_temperature', '31.0', {
    friendly_name: 'Nhiệt độ ngoài trời',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
  base('sensor.outdoor_weather', 'partlycloudy', {
    friendly_name: 'Thời tiết',
    temperature: 31,
    humidity: 78,
  }),
  base('binary_sensor.front_door', 'off', {
    friendly_name: 'Cửa trước',
    device_class: 'door',
  }),
  base('binary_sensor.main_gate', 'off', {
    friendly_name: 'Cổng chính',
    device_class: 'garage_door',
  }),
  base('lock.front_door', 'locked', {
    friendly_name: 'Khóa cửa trước',
  }),
  base('media_player.living_room_speaker', 'playing', {
    friendly_name: 'Loa phòng khách',
    media_title: 'Midnight City',
    media_artist: 'M83',
    volume_level: 0.6,
    is_volume_muted: false,
    media_duration: 260,
    media_position: 84,
    supported_features: 1,
  }),
  base('fan.bedroom_ceiling_fan', 'on', {
    friendly_name: 'Quạt trần phòng ngủ',
    percentage: 60,
    speed: 'medium',
    preset_modes: ['auto', 'off', 'low', 'medium', 'high'],
    preset_mode: 'medium',
  }),
]

/** Nhóm entity theo phòng để hiển thị */
export interface Room {
  id: string
  name: string
  icon: string
  entityIds: string[]
}

export const rooms: Room[] = [
  {
    id: 'living',
    name: 'Phòng khách',
    icon: '🛋️',
    entityIds: [
      'light.living_room_ceiling',
      'light.living_room_floor_lamp',
      'switch.living_room_tv',
      'switch.living_room_air_purifier',
      'climate.living_room',
      'sensor.living_room_temperature',
      'sensor.living_room_humidity',
      'sensor.living_room_illuminance',
      'binary_sensor.living_room_motion',
      'cover.living_room_window',
      'media_player.living_room_speaker',
    ],
  },
  {
    id: 'kitchen',
    name: 'Nhà bếp',
    icon: '🍳',
    entityIds: [
      'light.kitchen_main',
      'switch.kitchen_coffee',
      'switch.kitchen_fridge',
      'switch.kitchen_dishwasher',
      'sensor.kitchen_temperature',
      'sensor.kitchen_energy',
      'sensor.kitchen_water',
    ],
  },
  {
    id: 'bedroom',
    name: 'Phòng ngủ',
    icon: '🛏️',
    entityIds: [
      'light.bedroom_main',
      'light.bedroom_night_stand',
      'switch.bedroom_master_plug',
      'climate.bedroom',
      'sensor.bedroom_temperature',
      'binary_sensor.bedroom_door',
      'cover.bedroom_blackout',
      'fan.bedroom_ceiling_fan',
    ],
  },
  {
    id: 'bathroom',
    name: 'Phòng tắm',
    icon: '🚿',
    entityIds: [
      'light.bathroom_main',
      'switch.bathroom_heater',
      'sensor.bathroom_humidity',
      'sensor.bathroom_temperature',
    ],
  },
  {
    id: 'outdoor',
    name: 'Ngoài trời',
    icon: '🌳',
    entityIds: [
      'switch.garage_main_light',
      'sensor.outdoor_temperature',
      'sensor.outdoor_weather',
      'binary_sensor.front_door',
      'binary_sensor.main_gate',
      'lock.front_door',
    ],
  },
]

/** Danh sách entity_ids để request khi kết nối thật */
export const allEntityIds: string[] = rooms.flatMap((r) => r.entityIds)
