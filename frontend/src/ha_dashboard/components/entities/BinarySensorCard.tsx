import type { HAState } from '../../lib/types'
import { binarySensorLabel, friendlyName } from '../../lib/format'

interface BinarySensorCardProps {
  state: HAState
}

/**
 * Card Cảm biến nhị phân (Binary Sensor) chuẩn ServerKit
 */
export default function BinarySensorCard({ state }: BinarySensorCardProps) {
  const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
  const on = !isUnavailable && state.state === 'on'
  const isMotion = state.attributes.device_class === 'motion'

  return (
    <article
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: on ? 'var(--amber)' : 'var(--border)',
        boxShadow: on ? 'var(--shadow-sm), 0 0 10px var(--amber-bg)' : 'var(--shadow-sm)',
      }}
      className="sk-card p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-all duration-200"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          style={{
            backgroundColor: on ? 'rgba(245, 158, 11, 0.22)' : 'var(--surface-2)',
            borderColor: on ? 'rgba(245, 158, 11, 0.55)' : 'var(--border-soft)',
            boxShadow: on ? '0 0 14px rgba(245, 158, 11, 0.35)' : 'none',
            filter: on ? 'none' : 'grayscale(100%) opacity(0.4)',
            transition: 'all 0.25s ease',
          }}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base"
        >
          {isMotion ? '🚶' : '🚪'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
            {friendlyName(state)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`sk-state text-[9.5px] ${isUnavailable ? 'sk-state--red' : on ? 'sk-state--amber' : ''}`}>
              {isUnavailable ? 'KHÔNG KHẢ DỤNG' : binarySensorLabel(state).toUpperCase()}
            </span>
            <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
              {state.entity_id}
            </span>
          </div>
        </div>
      </div>

      <span
        style={{
          backgroundColor: isUnavailable ? 'var(--red)' : on ? 'var(--amber)' : 'var(--text-ghost)',
          boxShadow: isUnavailable ? '0 0 8px var(--red)' : on ? '0 0 8px var(--amber)' : 'none',
        }}
        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
      />
    </article>
  )
}
