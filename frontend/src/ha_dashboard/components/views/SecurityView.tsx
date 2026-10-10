import type { HAState } from '../../lib/types'
import BinarySensorCard from '../entities/BinarySensorCard'
import LockCard from '../entities/LockCard'

interface SecurityViewProps {
  states: HAState[]
}

/**
 * View Quản lý An Ninh & Giám Sát Cửa chuẩn ServerKit
 */
export default function SecurityView({ states }: SecurityViewProps) {
  const binarySensors = states.filter(
    (s) =>
      s.entity_id.startsWith('binary_sensor.') &&
      ['motion', 'door', 'garage_door', 'window'].includes(
        String(s.attributes.device_class),
      ),
  )
  const locks = states.filter((s) => s.entity_id.startsWith('lock.'))
  const unlockedLocks = locks.filter((s) => s.state !== 'locked').length
  const openSensors = binarySensors.filter((s) => s.state === 'on').length

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              An Ninh & Cảm Biến Cửa
            </h1>
            <span className="sk-tag sk-tag--prod">PROTECTION</span>
          </div>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-dim)' }}>
            Giám sát trạng thái chốt khóa thông minh, cảm biến chuyển động và chu vi cửa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`sk-pill ${openSensors > 0 || unlockedLocks > 0 ? 'sk-pill--amber' : 'sk-pill--green'}`}>
            <span className="sk-pill__dot" />
            <span>
              {openSensors > 0 ? `${openSensors} CẢM BIẾN MỞ` : 'CHU VI AN TOÀN'}
            </span>
          </span>
        </div>
      </div>

      {/* Locks */}
      {locks.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: 'var(--text-dim)' }}>
              KHÓA CỬA THÔNG MINH ({locks.length})
            </h2>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {locks.map((s) => (
              <LockCard key={s.entity_id} state={s} />
            ))}
          </div>
        </div>
      )}

      {/* Binary Sensors */}
      {binarySensors.length > 0 && (
        <div className="space-y-3.5 pt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: 'var(--text-dim)' }}>
              CẢM BIẾN TIẾP XÚC & CHUYỂN ĐỘNG ({binarySensors.length})
            </h2>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {binarySensors.map((s) => (
              <BinarySensorCard key={s.entity_id} state={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
