import type { HAState } from '../../lib/types'
import ClimateCard from '../entities/ClimateCard'
import SensorCard from '../entities/SensorCard'

interface ClimateViewProps {
  states: HAState[]
}

/**
 * View Quản lý Khí hậu & Điều hòa chuẩn ServerKit
 */
export default function ClimateView({ states }: ClimateViewProps) {
  const climates = states.filter((s) => s.entity_id.startsWith('climate.'))
  const tempSensors = states.filter(
    (s) =>
      s.entity_id.startsWith('sensor.') &&
      String(s.attributes.device_class) === 'temperature',
  )
  const humSensors = states.filter(
    (s) =>
      s.entity_id.startsWith('sensor.') &&
      String(s.attributes.device_class) === 'humidity',
  )
  const allSensors = [...tempSensors, ...humSensors].filter(
    (s, i, arr) => arr.findIndex((x) => x.entity_id === s.entity_id) === i,
  )

  const activeClimates = climates.filter((c) => c.state !== 'off').length

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Khí Hậu & Môi Trường
            </h1>
            <span className="sk-tag sk-tag--dev">HVAC</span>
          </div>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-dim)' }}>
            Theo dõi vi khí hậu từng phòng, điều chỉnh nhiệt độ mục tiêu và chế độ gió.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`sk-pill ${activeClimates > 0 ? 'sk-pill--cyan' : ''}`}>
            <span className="sk-pill__dot" />
            <span>{activeClimates} / {climates.length} MÁY LẠNH BẬT</span>
          </span>
        </div>
      </div>

      {/* Climates Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: 'var(--text-dim)' }}>
            HỆ THỐNG ĐIỀU HÒA KHÔNG KHÍ ({climates.length})
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {climates.length === 0 ? (
            <div className="sk-card p-5 text-sm font-mono" style={{ color: 'var(--text-faint)' }}>
              Không phát hiện thực thể điều hòa.
            </div>
          ) : (
            climates.map((s) => <ClimateCard key={s.entity_id} state={s} />)
          )}
        </div>
      </div>

      {/* Sensors Section */}
      {allSensors.length > 0 && (
        <div className="space-y-3.5 pt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: 'var(--text-dim)' }}>
              MẠNG LƯỚI CẢM BIẾN NHIỆT ẨM ({allSensors.length})
            </h2>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allSensors.map((s) => (
              <SensorCard key={s.entity_id} state={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
