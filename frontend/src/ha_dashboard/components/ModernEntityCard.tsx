import { useState } from 'react'
import type { HAState } from '../lib/types'
import { domainOf, friendlyName } from '../lib/format'
import { homeAssistantService } from '../hooks/useService'
import OnOffCard from './entities/OnOffCard'
import ClimateCard from './entities/ClimateCard'
import ModernSensorCard from './entities/ModernSensorCard'
import BinarySensorCard from './entities/BinarySensorCard'
import CoverCard from './entities/CoverCard'
import MediaPlayerCard from './entities/MediaPlayerCard'
import FanCard from './entities/FanCard'
import LockCard from './entities/LockCard'
import ModernWeatherCard from './entities/ModernWeatherCard'

export interface EntityCardProps {
  state: HAState
}

export default function ModernEntityCard({ state }: EntityCardProps) {
  const domain = domainOf(state.entity_id)
  const [isRunning, setIsRunning] = useState(false)

  switch (domain) {
    case 'light':
      return (
        <OnOffCard
          state={state}
          isLight
          brightness={Number(state.attributes.brightness ?? 0)}
          onSetBrightness={(v) =>
            homeAssistantService.setBrightness(state.entity_id, v)
          }
        />
      )
    case 'switch':
    case 'input_boolean':
      return <OnOffCard state={state} />
    case 'climate':
      return <ClimateCard state={state} />
    case 'sensor':
      return <ModernSensorCard state={state} />
    case 'binary_sensor':
      return <BinarySensorCard state={state} />
    case 'cover':
      return <CoverCard state={state} />
    case 'media_player':
      return <MediaPlayerCard state={state} />
    case 'fan':
      return <FanCard state={state} />
    case 'lock':
      return <LockCard state={state} />
    case 'weather':
      return <ModernWeatherCard state={state} />
    case 'script':
    case 'automation':
    case 'scene': {
      const isScript = domain === 'script'
      const isAutomation = domain === 'automation'
      const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
      const isOn = !isUnavailable && state.state === 'on'

      const handleAction = async () => {
        if (isUnavailable) return
        setIsRunning(true)
        try {
          if (isScript) {
            await homeAssistantService.callService('script', 'turn_on', { entity_id: state.entity_id })
          } else if (domain === 'scene') {
            await homeAssistantService.callService('scene', 'turn_on', { entity_id: state.entity_id })
          } else if (isAutomation) {
            await homeAssistantService.callService('automation', 'trigger', { entity_id: state.entity_id })
          }
        } catch (err) {
          console.error('Lỗi khi kích hoạt thực thể:', err)
        } finally {
          setTimeout(() => setIsRunning(false), 800)
        }
      }

      const handleToggleAutomation = async () => {
        if (isAutomation && !isUnavailable) {
          await homeAssistantService.toggle(state.entity_id)
        }
      }

      return (
        <article className="sk-card h-full p-4 sm:p-5 flex items-center justify-between gap-3.5 transition-all duration-200">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              style={{
                backgroundColor: isUnavailable ? 'rgba(239, 68, 68, 0.15)' : isOn ? 'rgba(59, 130, 246, 0.18)' : 'var(--surface-2)',
                borderColor: isUnavailable ? 'rgba(239, 68, 68, 0.35)' : isOn ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-soft)',
              }}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border text-xl shadow-sm"
            >
              {isScript ? '📜' : isAutomation ? '⚡' : '🎬'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                {friendlyName(state)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`sk-state ${isUnavailable ? 'sk-state--red' : isOn ? 'sk-state--green' : ''}`}
                >
                  {isUnavailable ? 'KHÔNG KHẢ DỤNG' : isAutomation ? (isOn ? 'MỞ' : 'TẮT') : domain.toUpperCase()}
                </span>
                <span className="font-mono text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                  {state.entity_id}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAutomation && (
              <button
                type="button"
                onClick={handleToggleAutomation}
                disabled={isUnavailable}
                className="btn btn-secondary btn-sm text-xs px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                title={isOn ? 'Tắt tự động hóa' : 'Bật tự động hóa'}
              >
                {isOn ? 'Tắt' : 'Bật'}
              </button>
            )}
            <button
              type="button"
              onClick={handleAction}
              disabled={isRunning || isUnavailable}
              style={{
                backgroundColor: 'var(--accent-bg)',
                borderColor: 'var(--accent)',
                color: 'var(--accent-bright)',
              }}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{isRunning ? '⏳' : '▶'}</span>
              <span>{isScript ? 'Chạy' : isAutomation ? 'Kích hoạt' : 'Bật cảnh'}</span>
            </button>
          </div>
        </article>
      )
    }
    default: {
      const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
      const isOn = !isUnavailable && (state.state === 'on' || state.state === 'home' || state.state === 'open')
      const isOff = !isUnavailable && (state.state === 'off' || state.state === 'not_home' || state.state === 'closed')

      const stateLabel = isUnavailable
        ? 'KHÔNG KHẢ DỤNG'
        : isOn
        ? (domain === 'update' ? 'CÓ BẢN MỚI' : 'MỞ')
        : isOff
        ? (domain === 'update' ? 'MỚI NHẤT' : 'TẮT')
        : state.state.toUpperCase()

      const iconEmoji = domain === 'update' ? '📦' : domain === 'person' ? '👤' : domain === 'device_tracker' ? '📍' : '📦'

      return (
        <article
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: isUnavailable ? 'rgba(239, 68, 68, 0.3)' : isOn ? 'var(--accent-dim)' : 'var(--border)',
          }}
          className="sk-card h-full p-4 sm:p-5 flex items-center justify-between gap-3.5 transition-all duration-200"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              style={{
                backgroundColor: isUnavailable ? 'rgba(239, 68, 68, 0.15)' : isOn ? 'rgba(59, 130, 246, 0.18)' : 'var(--surface-2)',
                borderColor: isUnavailable ? 'rgba(239, 68, 68, 0.35)' : isOn ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-soft)',
              }}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border text-xl shadow-sm"
            >
              {iconEmoji}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                {friendlyName(state)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`sk-state ${
                    isUnavailable ? 'sk-state--red' : isOn ? 'sk-state--green' : ''
                  }`}
                >
                  {stateLabel}
                </span>
                <span className="font-mono text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                  {state.entity_id}
                </span>
              </div>
            </div>
          </div>
        </article>
      )
    }
  }
}
