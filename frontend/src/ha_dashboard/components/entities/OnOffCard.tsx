import type { HAState } from '../../lib/types'
import { homeAssistantService } from '../../hooks/useService'
import Toggle from '../Toggle'

interface OnOffCardProps {
  state: HAState
  isLight?: boolean
  brightness?: number
  onSetBrightness?: (value: number) => void
}

/**
 * Card điều khiển bật/tắt (Light, Switch) chuẩn ServerKit
 */
export default function OnOffCard({
  state,
  isLight,
  brightness,
  onSetBrightness,
}: OnOffCardProps) {
  const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
  const on = !isUnavailable && state.state === 'on'
  const name = String(state.attributes.friendly_name ?? state.entity_id)

  const handleToggle = () => {
    if (!isUnavailable) {
      homeAssistantService.toggle(state.entity_id)
    }
  }

  return (
    <article
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: on ? 'var(--accent-dim)' : 'var(--border)',
        boxShadow: on ? 'var(--shadow-sm), 0 0 12px var(--accent-bg)' : 'var(--shadow-sm)',
      }}
      className="sk-card p-3.5 sm:p-4 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{
              backgroundColor: on
                ? isLight
                  ? 'rgba(251, 191, 36, 0.22)'
                  : 'rgba(129, 140, 248, 0.22)'
                : 'var(--surface-2)',
              borderColor: on
                ? isLight
                  ? 'rgba(251, 191, 36, 0.55)'
                  : 'rgba(129, 140, 248, 0.55)'
                : 'var(--border-soft)',
              boxShadow: on
                ? isLight
                  ? '0 0 14px rgba(251, 191, 36, 0.35)'
                  : '0 0 14px rgba(129, 140, 248, 0.35)'
                : 'none',
              filter: on ? 'none' : 'grayscale(100%) opacity(0.4)',
              transition: 'all 0.25s ease',
            }}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base shadow-sm"
          >
            {isLight ? '💡' : '🔌'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
              {name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`sk-state text-[9.5px] ${isUnavailable ? 'sk-state--red' : on ? 'sk-state--green' : ''}`}>
                {isUnavailable ? 'KHÔNG KHẢ DỤNG' : on ? 'MỞ' : 'TẮT'}
              </span>
              <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
                {state.entity_id}
              </span>
            </div>
          </div>
        </div>
        <Toggle
          on={on}
          onChange={handleToggle}
          accent={isLight ? 'accent' : 'amber'}
          disabled={isUnavailable}
        />
      </div>

      {isLight && on && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-dim)' }}>
              ĐỘ SÁNG
            </span>
            <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent-bright)' }}>
              {Math.round(((brightness ?? 0) / 255) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={255}
            value={brightness ?? 0}
            onChange={(e) => onSetBrightness?.(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{
              backgroundColor: 'var(--surface-3)',
              accentColor: 'var(--accent)',
            }}
          />
        </div>
      )}
    </article>
  )
}
