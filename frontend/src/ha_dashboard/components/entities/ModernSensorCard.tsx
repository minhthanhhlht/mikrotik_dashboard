import { useMemo } from 'react'
import type { HAState } from '../../lib/types'
import { friendlyName } from '../../lib/format'

export interface SensorCardProps {
  state: HAState
}

function parseRelativeTime(targetDate: Date): string {
  const now = new Date()
  const diffMs = targetDate.getTime() - now.getTime()
  const isPast = diffMs < 0
  const absDiffSec = Math.floor(Math.abs(diffMs) / 1000)

  const hours = Math.floor(absDiffSec / 3600)
  const minutes = Math.floor((absDiffSec % 3600) / 60)

  if (hours === 0 && minutes === 0) {
    return isPast ? 'Vừa mới đây' : 'Sắp diễn ra'
  }

  const timeStr = hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`
  return isPast ? `Cách đây ${timeStr}` : `Còn ${timeStr}`
}

export default function ModernSensorCard({ state }: SensorCardProps) {
  const uom = String(state.attributes.unit_of_measurement ?? '')
  const rawValue = state.state
  const deviceClass = String(state.attributes.device_class ?? '')
  const entityId = state.entity_id

  const isTimestamp = useMemo(() => {
    if (deviceClass === 'timestamp' || deviceClass === 'date') return true
    if (typeof rawValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawValue)) return true
    return false
  }, [deviceClass, rawValue])

  const timestampData = useMemo(() => {
    if (!isTimestamp) return null
    try {
      const d = new Date(rawValue)
      if (isNaN(d.getTime())) return null

      const timeStr = d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })

      const dateStr = d.toLocaleDateString('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      })

      const relativeStr = parseRelativeTime(d)
      return { timeStr, dateStr, relativeStr }
    } catch {
      return null
    }
  }, [isTimestamp, rawValue])

  const getIcon = () => {
    if (isTimestamp) {
      if (entityId.includes('rising') || entityId.includes('dawn')) return '🌅'
      if (entityId.includes('setting') || entityId.includes('dusk')) return '🌇'
      if (entityId.includes('noon')) return '☀️'
      if (entityId.includes('midnight')) return '🌙'
      return '⏰'
    }

    switch (deviceClass) {
      case 'temperature':
        return '🌡️'
      case 'humidity':
        return '💧'
      case 'illuminance':
        return '☀️'
      case 'power':
      case 'energy':
        return '⚡'
      case 'battery':
        return '🔋'
      default:
        return '📊'
    }
  }

  const getIconStyle = () => {
    if (isTimestamp) {
      if (entityId.includes('rising') || entityId.includes('noon')) {
        return { bg: 'rgba(251, 146, 60, 0.18)', border: 'rgba(251, 146, 60, 0.35)' }
      }
      if (entityId.includes('midnight') || entityId.includes('setting')) {
        return { bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.35)' }
      }
      return { bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.35)' }
    }

    switch (deviceClass) {
      case 'temperature':
        return { bg: 'rgba(244, 63, 94, 0.18)', border: 'rgba(244, 63, 94, 0.35)' }
      case 'humidity':
        return { bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.35)' }
      case 'illuminance':
        return { bg: 'rgba(251, 191, 36, 0.18)', border: 'rgba(251, 191, 36, 0.35)' }
      case 'power':
      case 'energy':
        return { bg: 'rgba(234, 179, 8, 0.18)', border: 'rgba(234, 179, 8, 0.35)' }
      case 'battery':
        return { bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.35)' }
      default:
        return { bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.35)' }
    }
  }

  const getMetricColor = () => {
    switch (deviceClass) {
      case 'temperature':
        return 'var(--cyan)'
      case 'humidity':
        return 'var(--accent-bright)'
      case 'power':
      case 'energy':
        return 'var(--amber)'
      default:
        return 'var(--text)'
    }
  }

  const iconStyle = getIconStyle()

  const isUnavailable = rawValue === 'unavailable' || rawValue === 'unknown'

  return (
    <article className="sk-card p-3.5 sm:p-4 transition-all duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{
              backgroundColor: iconStyle.bg,
              borderColor: iconStyle.border,
            }}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base shadow-sm"
          >
            {getIcon()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
              {friendlyName(state)}
            </p>
            <span className="font-mono text-[10px] uppercase tracking-wider mt-0.5 block" style={{ color: 'var(--text-faint)' }}>
              {isTimestamp ? 'THỜI GIAN' : (deviceClass || 'SENSOR')}
            </span>
          </div>
        </div>
      </div>

      {isUnavailable ? (
        <div className="mt-3 pt-2 border-t border-[var(--border-soft)] text-right">
          <span className="sk-state sk-state--red font-mono text-[10px] font-bold">
            KHÔNG KHẢ DỤNG
          </span>
        </div>
      ) : isTimestamp && timestampData ? (
        <div className="mt-3 pt-2.5 border-t border-[var(--border-soft)] flex items-end justify-between">
          <div className="space-y-0.5">
            <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--surface-active)] text-[10px] font-mono text-[var(--accent-bright)] font-semibold border border-[var(--border-soft)]">
              {timestampData.dateStr}
            </span>
            <p className="text-[11px] text-[var(--text-dim)] font-medium">
              ⏳ {timestampData.relativeStr}
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-xl font-bold tracking-tight text-[var(--cyan)]">
              {timestampData.timeStr}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-right">
          <span
            style={{ color: getMetricColor() }}
            className="font-mono text-2xl font-bold tracking-tight"
          >
            {rawValue}
          </span>
          {uom && (
            <span className="font-mono text-xs ml-0.5" style={{ color: 'var(--text-faint)' }}>
              {uom}
            </span>
          )}
        </div>
      )}
    </article>
  )
}
