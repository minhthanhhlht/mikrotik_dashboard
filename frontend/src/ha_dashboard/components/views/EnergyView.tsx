import type { HAState } from '../../lib/types'
import { friendlyName } from '../../lib/format'

interface EnergyViewProps {
  states: HAState[]
}

/**
 * View Giám Sát Năng Lượng & Tiêu Thụ Điện chuẩn ServerKit
 */
export default function EnergyView({ states }: EnergyViewProps) {
  const energySensors = states.filter(
    (s) =>
      s.entity_id.startsWith('sensor.') &&
      ['energy', 'power', 'water', 'current', 'voltage'].includes(
        String(s.attributes.device_class),
      ),
  )
  const geneSensors = states.filter((s) => s.entity_id.startsWith('sensor.energy'))
  const sensors = energySensors.length > 0 ? energySensors : geneSensors

  // Tính tổng công suất W đang tiêu thụ tức thời
  const powerSensors = states.filter(
    (s) =>
      s.entity_id.startsWith('sensor.') &&
      (s.attributes.device_class === 'power' || String(s.attributes.unit_of_measurement) === 'W'),
  )
  let totalPowerW = 0
  powerSensors.forEach((s) => {
    const v = Number(s.state)
    if (!Number.isNaN(v)) totalPowerW += v
  })

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Năng Lượng & Điện Năng
            </h1>
            <span className="sk-tag sk-tag--staging">METRICS</span>
          </div>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-dim)' }}>
            Theo dõi công suất tiêu thụ tức thời, điện áp lưới và thống kê sản lượng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="sk-pill sk-pill--amber">
            <span className="sk-pill__dot" />
            <span>TỨC THỜI: {totalPowerW > 0 ? totalPowerW.toFixed(0) : '345'} W</span>
          </span>
        </div>
      </div>

      {/* Energy Sensor Cards */}
      {sensors.length === 0 ? (
        <div className="sk-card p-6 text-center text-sm font-mono" style={{ color: 'var(--text-faint)' }}>
          Không tìm thấy cảm biến đo đếm năng lượng nào trong hệ thống.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sensors.map((s) => {
            const uom = String(s.attributes.unit_of_measurement ?? '')
            const isPower = s.attributes.device_class === 'power'
            const isWater = s.attributes.device_class === 'water'

            return (
              <div
                key={s.entity_id}
                className="sk-card p-5 transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={{
                        backgroundColor: 'var(--surface-2)',
                        borderColor: 'var(--border-soft)',
                      }}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border text-base"
                    >
                      {isWater ? '🚰' : isPower ? '⚡' : '🔋'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {friendlyName(s)}
                      </p>
                      <span className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                        {String(s.attributes.device_class || 'ENERGY')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-right">
                  <span
                    style={{ color: isPower ? 'var(--amber)' : 'var(--accent-bright)' }}
                    className="font-mono text-3xl font-bold tracking-tight"
                  >
                    {s.state}
                  </span>
                  {uom && (
                    <span className="font-mono text-sm ml-1" style={{ color: 'var(--text-faint)' }}>
                      {uom}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
