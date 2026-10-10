import type { HAState } from '../../lib/types'
import MediaPlayerCard from '../entities/MediaPlayerCard'

interface MediaViewProps {
  states: HAState[]
}

/**
 * View Quản lý Thiết bị Giải trí (Media) chuẩn ServerKit
 */
export default function MediaView({ states }: MediaViewProps) {
  const players = states.filter((s) => s.entity_id.startsWith('media_player.'))
  const playingCount = players.filter((s) => s.state === 'playing').length

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Giải Trí & Âm Thanh
            </h1>
            <span className="sk-tag sk-tag--prod">AUDIO / VIDEO</span>
          </div>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-dim)' }}>
            Điều khiển tập trung các Smart TV, loa thông minh và bộ khuếch đại đa vùng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`sk-pill ${playingCount > 0 ? 'sk-pill--green' : ''}`}>
            <span className="sk-pill__dot" />
            <span>{playingCount} / {players.length} ĐANG PHÁT</span>
          </span>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="sk-card p-6 text-center text-sm font-mono" style={{ color: 'var(--text-faint)' }}>
          Không tìm thấy thiết bị media_player nào trong hệ thống.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {players.map((s) => (
            <MediaPlayerCard key={s.entity_id} state={s} />
          ))}
        </div>
      )}
    </div>
  )
}
