import type { HAState } from '../../lib/types'
import { homeAssistantService } from '../../hooks/useService'

interface MediaPlayerCardProps {
  state: HAState
}

/**
 * Card Media Player chuẩn ServerKit
 */
export default function MediaPlayerCard({ state }: MediaPlayerCardProps) {
  const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
  const isPlaying = !isUnavailable && state.state === 'playing'
  const title = isUnavailable ? 'Không khả dụng' : String(state.attributes.media_title ?? 'Không phát nội dung')
  const artist = isUnavailable ? '' : String(state.attributes.media_artist ?? '')
  const volume = Number(state.attributes.volume_level ?? 0.5)
  const duration = Number(state.attributes.media_duration ?? 0)
  const position = Number(state.attributes.media_position ?? 0)
  const progress = duration > 0 ? (position / duration) * 100 : 0
  const name = String(state.attributes.friendly_name ?? state.entity_id)

  const fmt = (sec: number) => {
    if (!sec) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <article
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: isUnavailable ? 'rgba(239, 68, 68, 0.3)' : isPlaying ? 'var(--accent-dim)' : 'var(--border)',
        boxShadow: isPlaying ? 'var(--shadow-sm), 0 0 12px var(--accent-bg)' : 'var(--shadow-sm)',
      }}
      className="sk-card p-3.5 sm:p-4 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{
              backgroundColor: isUnavailable ? 'rgba(239, 68, 68, 0.15)' : isPlaying ? 'rgba(244, 114, 182, 0.25)' : 'var(--surface-2)',
              borderColor: isUnavailable ? 'rgba(239, 68, 68, 0.35)' : isPlaying ? 'rgba(244, 114, 182, 0.55)' : 'var(--border-soft)',
              boxShadow: isPlaying ? '0 0 14px rgba(244, 114, 182, 0.35)' : 'none',
              filter: isPlaying ? 'none' : 'grayscale(100%) opacity(0.4)',
              transition: 'all 0.25s ease',
            }}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base shadow-sm"
          >
            🎵
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
              {name}
            </p>
            <p className="truncate text-[11px] font-medium mt-0.5" style={{ color: isUnavailable ? 'var(--red)' : isPlaying ? 'var(--accent-bright)' : 'var(--text-dim)' }}>
              {title}
            </p>
            {artist && (
              <p className="truncate font-mono text-[10px]" style={{ color: 'var(--text-faint)' }}>
                {artist}
              </p>
            )}
          </div>
        </div>
        <span className={`sk-state ${isUnavailable ? 'sk-state--red' : isPlaying ? 'sk-state--green' : ''}`}>
          {isUnavailable ? 'KHÔNG KHẢ DỤNG' : isPlaying ? 'ĐANG PHÁT' : 'CHỜ'}
        </span>
      </div>

      {/* Scrubber Progress Bar */}
      <div className="mt-3.5 pt-2.5 border-t" style={{ borderColor: 'var(--border-soft)' }}>
        <div
          style={{ backgroundColor: 'var(--surface-3)' }}
          className="h-1.5 overflow-hidden rounded-full"
        >
          <div
            style={{
              width: `${isPlaying ? progress : 0}%`,
              backgroundColor: 'var(--accent)',
            }}
            className="h-full rounded-full transition-all"
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>
          <span>{fmt(position)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="mt-2.5 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Bài trước"
          disabled={isUnavailable}
          onClick={() => homeAssistantService.mediaControl(state.entity_id, 'previous')}
          className="btn btn-ghost btn-sm btn-icon text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⏮
        </button>
        <button
          type="button"
          aria-label="Phát/Tạm dừng"
          disabled={isUnavailable}
          onClick={() => homeAssistantService.mediaControl(state.entity_id, 'play_pause')}
          className="btn btn-primary btn-sm btn-icon text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          aria-label="Bài tiếp theo"
          disabled={isUnavailable}
          onClick={() => homeAssistantService.mediaControl(state.entity_id, 'next')}
          className="btn btn-ghost btn-sm btn-icon text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⏭
        </button>
      </div>

      {/* Volume Bar */}
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="text-sm" style={{ color: 'var(--text-faint)' }}>🔉</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          disabled={isUnavailable}
          onChange={(e) =>
            homeAssistantService.setMediaVolume(state.entity_id, Number(e.target.value))
          }
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--surface-3)',
            accentColor: 'var(--accent)',
          }}
        />
        <span className="w-9 text-right font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
          {isUnavailable ? '--' : `${Math.round(volume * 100)}%`}
        </span>
      </div>
    </article>
  )
}
