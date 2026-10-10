import type { HAState } from '../../lib/types'
import { homeAssistantService } from '../../hooks/useService'
import Toggle from '../Toggle'

interface FanCardProps {
  state: HAState
}

/**
 * Card Quạt (Fan) chuẩn ServerKit
 */
export default function FanCard({ state }: FanCardProps) {
  const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
  const on = !isUnavailable && state.state === 'on'
  const percentage = Number(state.attributes.percentage ?? 0)
  const presetModes = (state.attributes.preset_modes as string[]) ?? []
  const activePreset = String(state.attributes.preset_mode ?? '')
  const name = String(state.attributes.friendly_name ?? state.entity_id)

  return (
    <article
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: on ? 'var(--violet)' : 'var(--border)',
        boxShadow: on ? 'var(--shadow-sm), 0 0 12px var(--violet-bg)' : 'var(--shadow-sm)',
      }}
      className="sk-card p-3.5 sm:p-4 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{
              backgroundColor: on ? 'rgba(14, 165, 233, 0.22)' : 'var(--surface-2)',
              borderColor: on ? 'rgba(14, 165, 233, 0.55)' : 'var(--border-soft)',
              boxShadow: on ? '0 0 14px rgba(14, 165, 233, 0.35)' : 'none',
              filter: on ? 'none' : 'grayscale(100%) opacity(0.4)',
              transition: 'all 0.25s ease',
            }}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base"
          >
            🌀
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
              {name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`sk-state text-[9.5px] ${isUnavailable ? 'sk-state--red' : on ? 'sk-state--violet' : ''}`}>
                {isUnavailable ? 'KHÔNG KHẢ DỤNG' : on ? `${percentage}% MỞ` : 'TẮT'}
              </span>
              <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
                {state.entity_id}
              </span>
            </div>
          </div>
        </div>
        <Toggle
          on={on}
          onChange={() => !isUnavailable && homeAssistantService.toggle(state.entity_id)}
          accent="violet"
          disabled={isUnavailable}
        />
      </div>

      {on && (
        <div className="mt-3.5 pt-3.5 border-t space-y-3" style={{ borderColor: 'var(--border-soft)' }}>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-dim)' }}>
                TỐC ĐỘ QUẠT
              </span>
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--violet)' }}>
                {percentage}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={percentage}
              onChange={(e) =>
                homeAssistantService.setFanSpeed(state.entity_id, Number(e.target.value))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{
                backgroundColor: 'var(--surface-3)',
                accentColor: 'var(--violet)',
              }}
            />
          </div>

          {presetModes.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {presetModes.map((p) => {
                const isCurrent = p === activePreset
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      homeAssistantService.callService('fan', 'set_preset_mode', {
                        entity_id: state.entity_id,
                        preset_mode: p,
                      })
                    }
                    className={`sk-state cursor-pointer hover:opacity-80 ${isCurrent ? 'sk-state--violet' : ''}`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
