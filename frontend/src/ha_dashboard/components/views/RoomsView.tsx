import { useState } from 'react'
import type { HAState } from '../../lib/types'
import { rooms } from '../../data/mockData'
import EntityCard from '../EntityCard'

interface RoomsViewProps {
  states: HAState[]
}

/**
 * View Quản lý Khu vực & Phòng chuẩn ServerKit
 */
export default function RoomsView({ states }: RoomsViewProps) {
  const [activeRoomId, setActiveRoomId] = useState<string>('all')
  const stateMap = new Map(states.map((s) => [s.entity_id, s]))

  const filteredRooms = activeRoomId === 'all'
    ? rooms
    : rooms.filter((r) => r.id === activeRoomId)

  return (
    <div className="space-y-7">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Khu Vực & Không Gian
            </h1>
            <span className="sk-tag sk-tag--prod">{rooms.length} KHU VỰC</span>
          </div>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-dim)' }}>
            Quản lý và điều khiển tập trung các thiết bị theo không gian phân bổ.
          </p>
        </div>

        {/* Room Filter Segmented Control (.sk-seg) */}
        <div className="sk-seg overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveRoomId('all')}
            className={`sk-seg__btn ${activeRoomId === 'all' ? 'is-on' : ''}`}
          >
            <span>Tất cả</span>
            <span className="sk-seg__count">{rooms.length}</span>
          </button>
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setActiveRoomId(room.id)}
              className={`sk-seg__btn ${activeRoomId === room.id ? 'is-on' : ''}`}
            >
              <span>{room.icon}</span>
              <span className="hidden sm:inline">{room.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Room Panels */}
      <div className="space-y-6">
        {filteredRooms.map((room) => {
          const roomStates = room.entityIds
            .map((id) => stateMap.get(id))
            .filter((s): s is HAState => Boolean(s))
          if (roomStates.length === 0) return null

          const onCount = roomStates.filter((s) => s.state === 'on').length

          return (
            <div key={room.id} className="sk-card p-6 space-y-4">
              <div
                style={{ borderColor: 'var(--border-soft)' }}
                className="flex items-center justify-between border-b pb-3.5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{room.icon}</span>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                      {room.name}
                    </h2>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
                      ID: {room.id}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`sk-pill ${onCount > 0 ? 'sk-pill--green' : ''}`}>
                    <span className="sk-pill__dot" />
                    <span>{onCount} / {roomStates.length} HOẠT ĐỘNG</span>
                  </span>
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {roomStates.map((s) => (
                  <EntityCard key={s.entity_id} state={s} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
