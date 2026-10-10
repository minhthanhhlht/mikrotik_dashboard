import type { HAState } from '../../lib/types'
import { homeAssistantService } from '../../hooks/useService'

interface LockCardProps {
  state: HAState
}

/**
 * Card Khóa thông minh (Lock) chuẩn ServerKit
 */
export default function LockCard({ state }: LockCardProps) {
  const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
  const locked = state.state === 'locked'
  const name = String(state.attributes.friendly_name ?? state.entity_id)

  const handleToggle = () => {
    if (!isUnavailable) {
      homeAssistantService.lock(state.entity_id, locked)
    }
  }

  return (
    <article
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: !locked ? 'var(--amber)' : 'var(--border)',
        boxShadow: !locked ? 'var(--shadow-sm), 0 0 12px var(--amber-bg)' : 'var(--shadow-sm)',
      }}
      className="sk-card p-3.5 sm:p-4 transition-all duration-200 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          style={{
            backgroundColor: !locked ? 'rgba(239, 68, 68, 0.22)' : 'var(--surface-2)',
            borderColor: !locked ? 'rgba(239, 68, 68, 0.55)' : 'var(--border-soft)',
            boxShadow: !locked ? '0 0 14px rgba(239, 68, 68, 0.35)' : 'none',
            filter: !locked ? 'none' : 'grayscale(100%) opacity(0.4)',
            transition: 'all 0.25s ease',
          }}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base"
        >
          {locked ? '🔒' : '🔓'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
            {name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`sk-state text-[9.5px] ${isUnavailable ? 'sk-state--red' : locked ? 'sk-state--green' : 'sk-state--amber'}`}>
              {isUnavailable ? 'KHÔNG KHẢ DỤNG' : locked ? 'ĐÃ KHÓA' : 'MỞ KHÓA'}
            </span>
            <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
              {state.entity_id}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={isUnavailable}
        className={[
          'btn btn-sm font-mono text-xs',
          locked ? 'btn-secondary' : 'btn-danger',
        ].join(' ')}
      >
        {locked ? 'Mở khóa' : 'Khóa lại'}
      </button>
    </article>
  )
}
