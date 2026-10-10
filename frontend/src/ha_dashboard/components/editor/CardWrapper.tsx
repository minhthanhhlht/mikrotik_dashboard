import React from 'react'
import type { DashboardCardConfig } from '../../lib/storageTypes'

interface CardWrapperProps {
  card: DashboardCardConfig
  isEditMode: boolean
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onEdit?: () => void
  onDelete?: () => void
  children: React.ReactNode
}

/**
 * Bọc ngoài mỗi Card: hiển thị thanh điều khiển khi ở Edit Mode
 */
export default function CardWrapper({
  isEditMode,
  onMoveLeft,
  onMoveRight,
  onEdit,
  onDelete,
  children,
}: CardWrapperProps) {
  if (!isEditMode) {
    return <div className="h-full flex flex-col">{children}</div>
  }

  return (
    <div className="relative group rounded-xl transition-all duration-200 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-body)] h-full flex flex-col">
      {/* Floating Action Header inside Edit Mode */}
      <div
        style={{
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--border-strong)',
        }}
        className="absolute -top-3.5 right-3 z-30 flex items-center gap-1 rounded-full border px-2 py-1 shadow-md"
      >
        {onMoveLeft && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onMoveLeft()
            }}
            title="Di chuyển sang trái / lên"
            className="flex h-5 w-5 items-center justify-center rounded text-xs hover:bg-[var(--surface-hover)] text-[var(--text)] transition-colors cursor-pointer"
          >
            ←
          </button>
        )}
        {onMoveRight && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onMoveRight()
            }}
            title="Di chuyển sang phải / xuống"
            className="flex h-5 w-5 items-center justify-center rounded text-xs hover:bg-[var(--surface-hover)] text-[var(--text)] transition-colors cursor-pointer"
          >
            →
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onEdit()
            }}
            title="Sửa cấu hình thẻ"
            className="flex h-5 w-5 items-center justify-center rounded text-xs hover:bg-[var(--surface-hover)] text-[var(--accent-bright)] transition-colors cursor-pointer"
          >
            ✏️
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onDelete()
            }}
            title="Xóa thẻ khỏi dashboard"
            className="flex h-5 w-5 items-center justify-center rounded text-xs hover:bg-[var(--surface-hover)] text-[var(--red)] transition-colors cursor-pointer"
          >
            🗑️
          </button>
        )}
      </div>

      <div className="pointer-events-none opacity-90 h-full flex flex-col">{children}</div>
    </div>
  )
}
