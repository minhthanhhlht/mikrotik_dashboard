import type { HAState } from '../../lib/types'
import { homeAssistantService } from '../../hooks/useService'

interface CoverCardProps {
  state: HAState
}

/**
 * Card điều khiển Rèm / Cửa cuốn (Cover) chuẩn ServerKit
 */
export default function CoverCard({ state }: CoverCardProps) {
  const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
  const position = Number(state.attributes.current_position ?? 0)
  const name = String(state.attributes.friendly_name ?? state.entity_id)

  const move = (pos: number) => {
    if (!isUnavailable) {
      homeAssistantService.setCoverPosition(state.entity_id, pos)
    }
  }

  const isOpen = !isUnavailable && (position > 0 || state.state === 'open')

  return (
    <article className="sk-card p-3.5 sm:p-4 transition-all duration-200">
      <div className="flex items-center gap-3">
        <div
          style={{
            backgroundColor: isOpen ? 'rgba(16, 185, 129, 0.22)' : 'var(--surface-2)',
            borderColor: isOpen ? 'rgba(16, 185, 129, 0.55)' : 'var(--border-soft)',
            boxShadow: isOpen ? '0 0 14px rgba(16, 185, 129, 0.35)' : 'none',
            filter: isOpen ? 'none' : 'grayscale(100%) opacity(0.4)',
            transition: 'all 0.25s ease',
          }}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base shadow-sm"
        >
          🪟
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
            {name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`sk-state text-[9.5px] ${isUnavailable ? 'sk-state--red' : 'sk-state--accent'} font-mono`}>
              {isUnavailable ? 'KHÔNG KHẢ DỤNG' : `${position}% MỞ`}
            </span>
            <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
              {state.entity_id}
            </span>
          </div>
        </div>
      </div>

      {/* Thanh tiến trình % vị trí */}
      <div className="mt-3.5">
        <div
          style={{ backgroundColor: 'var(--surface-3)' }}
          className="h-2 overflow-hidden rounded-full"
        >
          <div
            style={{
              width: `${isUnavailable ? 0 : position}%`,
              backgroundColor: 'var(--accent)',
            }}
            className="h-full rounded-full transition-all duration-300"
          />
        </div>
      </div>

      {/* Cụm nút thao tác chuẩn .btn */}
      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={() => move(0)}
          disabled={isUnavailable}
          className="btn btn-secondary btn-sm flex-1 font-mono text-xs"
        >
          Đóng (0%)
        </button>
        <button
          type="button"
          onClick={() => move(50)}
          disabled={isUnavailable}
          className="btn btn-soft btn-sm flex-1 font-mono text-xs"
        >
          Giữa (50%)
        </button>
        <button
          type="button"
          onClick={() => move(100)}
          disabled={isUnavailable}
          className="btn btn-secondary btn-sm flex-1 font-mono text-xs"
        >
          Mở (100%)
        </button>
      </div>
    </article>
  )
}
