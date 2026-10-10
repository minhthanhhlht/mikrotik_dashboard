import type { HAState } from '../../lib/types'
import { hvacLabels } from '../../lib/format'
import { homeAssistantService } from '../../hooks/useService'
import Toggle from '../Toggle'

interface ClimateCardProps {
  state: HAState
}

/**
 * Card điều hòa (Climate) chuẩn ServerKit
 */
export default function ClimateCard({ state }: ClimateCardProps) {
  const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
  const isOn = !isUnavailable && state.state !== 'off'
  const currentTemp = Number(state.attributes.current_temperature ?? 0)
  const targetTemp = Number(state.attributes.temperature ?? 0)
  const hvacModes = (state.attributes.hvac_modes as string[]) ?? ['off', 'cool']
  const fanModes = (state.attributes.fan_modes as string[]) ?? []
  const activeFan = String(state.attributes.fan_mode ?? '')
  const name = String(state.attributes.friendly_name ?? state.entity_id)

  const setTemp = (delta: number) => {
    const base = targetTemp > 0 ? targetTemp : 25
    const next = Math.min(32, Math.max(16, base + delta))
    homeAssistantService.setClimateTemperature(state.entity_id, next)
  }

  return (
    <article
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: isOn ? 'var(--cyan)' : 'var(--border)',
        boxShadow: isOn ? 'var(--shadow-sm), 0 0 12px var(--cyan-bg)' : 'var(--shadow-sm)',
      }}
      className="sk-card p-3.5 sm:p-4 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{
              backgroundColor: isOn ? 'rgba(6, 182, 212, 0.22)' : 'var(--surface-2)',
              borderColor: isOn ? 'rgba(6, 182, 212, 0.55)' : 'var(--border-soft)',
              boxShadow: isOn ? '0 0 14px rgba(6, 182, 212, 0.35)' : 'none',
              filter: isOn ? 'none' : 'grayscale(100%) opacity(0.4)',
              transition: 'all 0.25s ease',
            }}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base"
          >
            ❄️
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
              {name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`sk-state text-[9.5px] ${isOn ? 'sk-state--cyan' : isUnavailable ? 'sk-state--red' : ''}`}>
                {isUnavailable ? 'KHÔNG KHẢ DỤNG' : isOn ? (hvacLabels[state.state] ?? state.state).toUpperCase() : 'TẮT'}
              </span>
              <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
                {state.entity_id}
              </span>
            </div>
          </div>
        </div>
        <Toggle
          on={isOn}
          onChange={() => !isUnavailable && homeAssistantService.toggle(state.entity_id)}
          accent="cyan"
          disabled={isUnavailable}
        />
      </div>

      {isOn && (
        <div className="mt-3.5 space-y-3">
          {/* Nhiệt độ hiện tại vs mục tiêu */}
          <div
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--border-soft)',
            }}
            className="grid grid-cols-2 rounded-[var(--radius-sm)] border p-2.5 text-center"
          >
            <div className="border-r" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="font-mono text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-dim)' }}>
                HIỆN TẠI
              </div>
              <div className="font-mono text-xl font-bold mt-0.5" style={{ color: 'var(--text)' }}>
                {currentTemp > 0 ? currentTemp.toFixed(1) : '--'}
                <span className="text-xs ml-0.5" style={{ color: 'var(--text-faint)' }}>°C</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-dim)' }}>
                MỤC TIÊU
              </div>
              <div className="font-mono text-xl font-bold mt-0.5" style={{ color: 'var(--cyan)' }}>
                {targetTemp > 0 ? targetTemp.toFixed(1) : '--'}
                <span className="text-xs ml-0.5" style={{ color: 'var(--text-faint)' }}>°C</span>
              </div>
            </div>
          </div>

          {/* Điều chỉnh nhiệt độ */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setTemp(-0.5)}
              className="btn btn-secondary btn-sm btn-icon text-sm"
              title="Giảm 0.5°C"
            >
              −
            </button>
            <div className="flex-1 text-center font-mono text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>
              Đặt mục tiêu: <span style={{ color: 'var(--text)', fontSize: '13px' }}>{targetTemp.toFixed(1)}°C</span>
            </div>
            <button
              type="button"
              onClick={() => setTemp(0.5)}
              className="btn btn-secondary btn-sm btn-icon text-sm"
              title="Tăng 0.5°C"
            >
              +
            </button>
          </div>

          {/* HVAC Modes */}
          {hvacModes.length > 1 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              {hvacModes.map((mode) => {
                const isCurrent = mode === state.state
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => homeAssistantService.setClimateMode(state.entity_id, mode)}
                    className={[
                      'btn btn-sm text-xs',
                      isCurrent ? 'btn-primary' : 'btn-soft',
                    ].join(' ')}
                  >
                    {hvacLabels[mode] ?? mode}
                  </button>
                )
              })}
            </div>
          )}

          {/* Fan Modes */}
          {fanModes.length > 1 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>🌀 Quạt:</span>
              <div className="flex flex-wrap gap-1.5">
                {fanModes.map((fm) => (
                  <button
                    key={fm}
                    type="button"
                    onClick={() => homeAssistantService.setClimateFanMode(state.entity_id, fm)}
                    className={`sk-state cursor-pointer hover:opacity-80 ${fm === activeFan ? 'sk-state--accent' : ''}`}
                  >
                    {fm}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
