import type { HAState } from '../../lib/types'
import { friendlyName } from '../../lib/format'

export interface WeatherCardProps {
  state?: HAState
  temperature?: number
  humidity?: number
  condition?: string
}

const conditionIcons: Record<string, string> = {
  clear: '☀️',
  'clear-night': '🌙',
  partlycloudy: '⛅',
  cloudy: '☁️',
  rainy: '🌧️',
  pouring: '🌧️',
  snowy: '❄️',
  stormy: '⛈️',
  lightning: '⚡',
  fog: '🌫️',
  windy: '💨',
}

const conditionLabels: Record<string, string> = {
  clear: 'Trời quang đãng',
  'clear-night': 'Trời đêm quang đãng',
  partlycloudy: 'Có mây rải rác',
  cloudy: 'Nhiều mây',
  rainy: 'Có mưa',
  pouring: 'Mưa rào lớn',
  snowy: 'Tuyết rơi',
  stormy: 'Giông bão',
  lightning: 'Sấm sét',
  fog: 'Sương mù',
  windy: 'Gió mạnh',
}

export default function ModernWeatherCard({
  state,
  temperature: propTemp,
  humidity: propHum,
  condition: propCond,
}: WeatherCardProps) {
  const isUnavailable = state ? (state.state === 'unavailable' || state.state === 'unknown') : false
  let temp = propTemp ?? 25
  let hum = propHum ?? 60
  let cond = propCond ?? 'clear'
  let title = 'MÔI TRƯỜNG BÊN NGOÀI'

  if (state) {
    cond = String(state.state ?? 'clear')
    const attrs = state.attributes || {}
    if (typeof attrs.temperature === 'number') {
      temp = attrs.temperature
    }
    if (typeof attrs.humidity === 'number') {
      hum = attrs.humidity
    }
    title = friendlyName(state)
  }

  const icon = isUnavailable ? '🌫️' : (conditionIcons[cond] ?? '🌤️')
  const label = isUnavailable ? 'Không khả dụng' : (conditionLabels[cond] ?? cond)

  return (
    <article className="sk-card p-3.5 sm:p-4 flex items-center justify-between gap-4 transition-all duration-200">
      <div className="flex items-center gap-3 min-w-0">
        <div
          style={{
            backgroundColor: isUnavailable ? 'rgba(239, 68, 68, 0.18)' : 'rgba(245, 158, 11, 0.18)',
            borderColor: isUnavailable ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)',
            boxShadow: isUnavailable ? 'none' : '0 0 14px rgba(245, 158, 11, 0.25)',
          }}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-xl"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider font-semibold truncate" style={{ color: 'var(--text-faint)' }}>
            {title}
          </div>
          <div className="mt-0.5 truncate flex items-center gap-2">
            {isUnavailable ? (
              <span className="sk-state sk-state--red font-mono text-[10px] font-bold">
                KHÔNG KHẢ DỤNG
              </span>
            ) : (
              <span className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>
                {label}
              </span>
            )}
          </div>
          {!isUnavailable && (
            <div className="font-mono text-[10.5px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
              Độ ẩm: <span style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>{Math.round(hum)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <span
          style={{ color: isUnavailable ? 'var(--text-faint)' : 'var(--cyan)' }}
          className="font-mono text-2xl font-bold tracking-tight"
        >
          {isUnavailable ? '--' : Math.round(temp)}
        </span>
        {!isUnavailable && (
          <span className="font-mono text-xs ml-0.5" style={{ color: 'var(--text-faint)' }}>
            °C
          </span>
        )}
      </div>
    </article>
  )
}
