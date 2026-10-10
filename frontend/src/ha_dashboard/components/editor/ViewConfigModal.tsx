import { useState } from 'react'
import type { DashboardViewConfig } from '../../lib/storageTypes'

interface ViewConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (viewData: Omit<DashboardViewConfig, 'id' | 'cards'>) => void
  initialView?: DashboardViewConfig | null
}

const VIEW_ICONS = [
  { id: 'overview', label: 'Bảng điều khiển', symbol: '◧', color: '#38bdf8' },
  { id: 'rooms', label: 'Ngôi nhà / Phòng', symbol: '⌂', color: '#818cf8' },
  { id: 'climate', label: 'Khí hậu / Điều hòa', symbol: '❄', color: '#06b6d4' },
  { id: 'media', label: 'Âm thanh / Giải trí', symbol: '♪', color: '#f472b6' },
  { id: 'security', label: 'An ninh / Khóa', symbol: '⬡', color: '#f59e0b' },
  { id: 'energy', label: 'Năng lượng / Điện', symbol: '⚡', color: '#eab308' },
]

export default function ViewConfigModal({
  isOpen,
  onClose,
  onSave,
  initialView,
}: ViewConfigModalProps) {
  const [title, setTitle] = useState<string>(initialView?.title ?? '')
  const [icon, setIcon] = useState<string>(initialView?.icon ?? 'rooms')
  const [category, setCategory] = useState<'DASHBOARD' | 'HỆ THỐNG'>('DASHBOARD')

  if (!isOpen) return null

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      icon,
      category,
    })
    onClose()
  }

  return (
    <div
      style={{ zIndex: 1150 }}
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
    >
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm" />

      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border-strong)',
        }}
        className="relative z-10 w-full max-w-lg rounded-xl border shadow-2xl flex flex-col"
      >
        <div
          style={{ borderColor: 'var(--border-soft)' }}
          className="flex items-center justify-between border-b px-6 py-4"
        >
          <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            {initialView ? 'Chỉnh Sửa Không Gian (Tab)' : 'Thêm Không Gian Mới (Tab)'}
          </h2>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-icon text-lg">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="sk-field">
            <label className="sk-label">1. Tên Không Gian / Khu Vực</label>
            <input
              type="text"
              placeholder="Ví dụ: Tầng 2, Sân thượng, Studio..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="sk-input text-sm"
              autoFocus
            />
          </div>

          <div className="sk-field">
            <label className="sk-label">2. Biểu tượng (Icon)</label>
            <div className="grid grid-cols-3 gap-2">
              {VIEW_ICONS.map((i) => {
                const isSelected = i.id === icon
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setIcon(i.id)}
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-bg)' : 'var(--surface-2)',
                      borderColor: isSelected ? i.color : 'var(--border-soft)',
                      color: isSelected ? 'var(--text)' : 'var(--text-dim)',
                    }}
                    className={[
                      'flex items-center gap-2 rounded-lg border p-2.5 text-xs text-left transition-all',
                      isSelected ? 'font-semibold shadow-sm' : 'hover:bg-[var(--surface-hover)]',
                    ].join(' ')}
                  >
                    <span
                      style={{
                        backgroundColor: `${i.color}22`,
                        borderColor: `${i.color}55`,
                        color: i.color,
                      }}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border font-bold text-sm"
                    >
                      {i.symbol}
                    </span>
                    <span className="truncate">{i.label.split('/')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sk-field">
            <label className="sk-label">3. Nhóm Danh Mục</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'DASHBOARD' | 'HỆ THỐNG')}
              className="sk-select text-xs w-full"
            >
              <option value="DASHBOARD">Bảng điều khiển (DASHBOARD)</option>
              <option value="HỆ THỐNG">Hạ tầng & Thiết bị (HỆ THỐNG)</option>
            </select>
          </div>
        </div>

        <div
          style={{ borderColor: 'var(--border-soft)' }}
          className="flex items-center justify-end gap-3 border-t px-6 py-4"
        >
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            className="btn btn-primary"
          >
            {initialView ? 'Lưu Thay Đổi' : 'Thêm Tab'}
          </button>
        </div>
      </div>
    </div>
  )
}

