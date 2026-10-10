import { useEffect, useMemo, useState } from 'react'
import type { HAState } from '../../lib/types'
import type { CardType, DashboardCardConfig, DashboardTabConfig } from '../../lib/storageTypes'
import EntityCard from '../EntityCard'

interface CardConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (cardData: Omit<DashboardCardConfig, 'id'>) => void
  initialCard?: DashboardCardConfig | null
  states: HAState[]
  tabs?: DashboardTabConfig[]
  defaultArea?: string
}

export type FilterCategory = CardType | 'all' | 'automation'

const CARD_TYPES: { type: FilterCategory; label: string; icon: string; defaultDomain: string; color: string }[] = [
  { type: 'all', label: 'Tất cả thực thể (Toàn bộ HA)', icon: '🌐', defaultDomain: 'all', color: '#38bdf8' },
  { type: 'on_off', label: 'Đèn & Công tắc (Light / Switch)', icon: '💡', defaultDomain: 'light', color: '#fbbf24' },
  { type: 'sensor', label: 'Cảm biến đo lường (Sensor)', icon: '📊', defaultDomain: 'sensor', color: '#10b981' },
  { type: 'climate', label: 'Điều hòa & Khí hậu (Climate)', icon: '❄️', defaultDomain: 'climate', color: '#06b6d4' },
  { type: 'binary_sensor', label: 'Cảm biến cửa & chuyển động (Binary)', icon: '🚪', defaultDomain: 'binary_sensor', color: '#f59e0b' },
  { type: 'weather', label: 'Thời tiết (Weather)', icon: '🌤️', defaultDomain: 'weather', color: '#eab308' },
  { type: 'automation', label: 'Tự động hóa & Script', icon: '⚡', defaultDomain: 'automation', color: '#a78bfa' },
  { type: 'cover', label: 'Rèm cửa & Cửa cuốn (Cover)', icon: '🪟', defaultDomain: 'cover', color: '#14b8a6' },
  { type: 'media_player', label: 'Giải trí & Media Player', icon: '🎵', defaultDomain: 'media_player', color: '#f472b6' },
  { type: 'fan', label: 'Quạt thông minh (Fan)', icon: '🌀', defaultDomain: 'fan', color: '#0ea5e9' },
  { type: 'lock', label: 'Khóa cửa thông minh (Lock)', icon: '🔒', defaultDomain: 'lock', color: '#ef4444' },
]

function inferCardType(entityId: string): CardType {
  if (entityId.startsWith('light.') || entityId.startsWith('switch.') || entityId.startsWith('input_boolean.') || entityId.startsWith('automation.') || entityId.startsWith('script.')) return 'on_off'
  if (entityId.startsWith('climate.')) return 'climate'
  if (entityId.startsWith('sensor.')) return 'sensor'
  if (entityId.startsWith('binary_sensor.')) return 'binary_sensor'
  if (entityId.startsWith('cover.')) return 'cover'
  if (entityId.startsWith('media_player.')) return 'media_player'
  if (entityId.startsWith('fan.')) return 'fan'
  if (entityId.startsWith('lock.')) return 'lock'
  if (entityId.startsWith('weather.')) return 'weather'
  return 'sensor'
}

export default function CardConfigModal({
  isOpen,
  onClose,
  onSave,
  initialCard,
  states,
  tabs,
  defaultArea,
}: CardConfigModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>(initialCard?.type ?? 'all')
  const [selectedType, setSelectedType] = useState<CardType>(initialCard?.type ?? 'on_off')
  const [selectedEntityId, setSelectedEntityId] = useState<string>(initialCard?.entityId ?? '')
  const [customTitle, setCustomTitle] = useState<string>(initialCard?.customTitle ?? '')
  const [selectedArea, setSelectedArea] = useState<string>(initialCard?.area ?? defaultArea ?? (tabs && tabs[0] ? tabs[0].id : ''))
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      setSelectedCategory(initialCard?.type ?? 'all')
      setSelectedType(initialCard?.type ?? 'on_off')
      setSelectedEntityId(initialCard?.entityId ?? '')
      setCustomTitle(initialCard?.customTitle ?? '')
      setSelectedArea(initialCard?.area ?? defaultArea ?? (tabs && tabs[0] ? tabs[0].id : ''))
      setSearchQuery('')
    }
  }, [isOpen, initialCard, defaultArea, tabs])

  const filteredEntities = useMemo(() => {
    return states.filter((s) => {
      let matchType = true
      if (selectedCategory === 'all') {
        matchType = true
      } else if (selectedCategory === 'on_off') {
        matchType = s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.') || s.entity_id.startsWith('input_boolean.')
      } else if (selectedCategory === 'automation') {
        matchType = s.entity_id.startsWith('automation.') || s.entity_id.startsWith('script.') || s.entity_id.startsWith('scene.')
      } else {
        matchType = s.entity_id.startsWith(`${selectedCategory}.`)
      }

      if (!matchType) return false

      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      const fname = String(s.attributes.friendly_name ?? '').toLowerCase()
      return s.entity_id.toLowerCase().includes(q) || fname.includes(q)
    })
  }, [states, selectedCategory, searchQuery])

  // Khi chọn entity, tự động cập nhật selectedType nếu đang ở chế độ all hoặc automation
  const handleSelectEntity = (entityId: string) => {
    setSelectedEntityId(entityId)
    if (selectedCategory === 'all' || selectedCategory === 'automation') {
      setSelectedType(inferCardType(entityId))
    }
  }

  // Chọn entity đầu tiên nếu chưa chọn hoặc đổi category
  const currentEntityState = useMemo(() => {
    if (selectedEntityId) {
      const found = states.find((s) => s.entity_id === selectedEntityId)
      if (found) return found
    }
    return filteredEntities[0] ?? null
  }, [selectedEntityId, states, filteredEntities])

  if (!isOpen) return null

  const handleSave = () => {
    const finalEntityId = selectedEntityId || currentEntityState?.entity_id || ''
    if (!finalEntityId) return

    onSave({
      type: selectedType,
      entityId: finalEntityId,
      customTitle: customTitle.trim() || undefined,
      area: selectedArea || undefined,
    })
    onClose()
  }

  // Giả lập preview state với custom title nếu có
  const previewState = currentEntityState
    ? {
        ...currentEntityState,
        attributes: {
          ...currentEntityState.attributes,
          friendly_name: customTitle.trim() || currentEntityState.attributes.friendly_name,
        },
      }
    : null

  return (
    <div
      style={{ zIndex: 1150 }}
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      {/* Dialog Shell */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border-strong)',
        }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div
          style={{ borderColor: 'var(--border-soft)' }}
          className="flex items-center justify-between border-b px-6 py-4"
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {initialCard ? 'Chỉnh Sửa Thẻ Thiết Bị' : 'Thêm Thẻ Thiết Bị Mới'}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Chọn thực thể từ Home Assistant và tùy chỉnh thông tin hiển thị trên bảng điều khiển.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-icon text-[var(--text-dim)]"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Sub-tab khu vực nếu view có hỗ trợ tabs */}
          {tabs && tabs.length > 0 && (
            <div>
              <label className="block text-xs font-mono font-medium mb-1.5 uppercase" style={{ color: 'var(--text-dim)' }}>
                📍 Khu Vực / Phòng
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="sk-select w-full text-xs font-mono py-2"
              >
                <option value="">-- Không gán khu vực (Chung) --</option>
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.icon ? `${tab.icon} ` : ''}{tab.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Chọn Danh Mục / Loại Thẻ */}
          <div>
            <label className="block text-xs font-mono font-medium mb-2 uppercase" style={{ color: 'var(--text-dim)' }}>
              1. Phân loại thiết bị ({states.length} thực thể đã tải)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CARD_TYPES.map((cat) => {
                const isSelected = selectedCategory === cat.type
                return (
                  <button
                    key={cat.type}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.type)
                      if (cat.type !== 'all' && cat.type !== 'automation') {
                        setSelectedType(cat.type)
                      }
                    }}
                    style={{
                      borderColor: isSelected ? cat.color : 'var(--border)',
                      backgroundColor: isSelected ? 'var(--surface-hover)' : 'var(--surface-0)',
                      color: isSelected ? 'var(--text)' : 'var(--text-dim)',
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all hover:border-[var(--border-strong)]"
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="truncate font-medium">{cat.label.split(' (')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ô tìm kiếm thực thể */}
          <div>
            <label className="block text-xs font-mono font-medium mb-1.5 uppercase" style={{ color: 'var(--text-dim)' }}>
              2. Chọn Thực Thể Home Assistant ({filteredEntities.length} kết quả)
            </label>
            <input
              type="text"
              placeholder="🔍 Tìm theo entity_id hoặc tên thiết bị (VD: light.phong_khach, switch.may_bom...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sk-input w-full font-mono text-xs px-3.5 py-2.5 rounded-lg mb-2"
            />

            {/* Entity List / Dropdown Picker */}
            <div
              style={{
                backgroundColor: 'var(--surface-0)',
                borderColor: 'var(--border)',
              }}
              className="max-h-44 overflow-y-auto rounded-lg border p-1.5 space-y-1"
            >
              {filteredEntities.length === 0 ? (
                <div className="p-4 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
                  Không tìm thấy thực thể nào phù hợp với từ khóa.
                </div>
              ) : (
                filteredEntities.map((state) => {
                  const isSelected = (selectedEntityId || currentEntityState?.entity_id) === state.entity_id
                  const name = String(state.attributes.friendly_name ?? state.entity_id)
                  const isUnavailable = state.state === 'unavailable' || state.state === 'unknown'
                  return (
                    <button
                      key={state.entity_id}
                      type="button"
                      onClick={() => handleSelectEntity(state.entity_id)}
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-bg)' : 'transparent',
                        color: isSelected ? 'var(--accent-bright)' : 'var(--text)',
                        borderColor: isSelected ? 'var(--accent)' : 'transparent',
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-left border transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold block truncate">{name}</span>
                        <span className="font-mono text-[10px] text-[var(--text-dim)] truncate">{state.entity_id}</span>
                      </div>
                      <span className={`sk-state flex-shrink-0 uppercase font-mono text-[10px] ${isUnavailable ? 'sk-state--red' : ''}`}>
                        {isUnavailable ? 'KHÔNG KHẢ DỤNG' : state.state}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Tên tùy chỉnh (Custom Title) */}
          <div>
            <label className="block text-xs font-mono font-medium mb-1.5 uppercase" style={{ color: 'var(--text-dim)' }}>
              3. Tên hiển thị tùy biến (Tùy chọn)
            </label>
            <input
              type="text"
              placeholder={String(currentEntityState?.attributes.friendly_name ?? 'Nhập tên hiển thị trên thẻ...')}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="sk-input w-full text-xs px-3.5 py-2.5 rounded-lg"
            />
          </div>

          {/* Live Preview */}
          {previewState && (
            <div>
              <label className="block text-xs font-mono font-medium mb-1.5 uppercase" style={{ color: 'var(--text-dim)' }}>
                Xem trước giao diện thẻ (Live Preview)
              </label>
              <div
                style={{
                  backgroundColor: 'var(--surface-0)',
                  borderColor: 'var(--border-soft)',
                }}
                className="p-3.5 rounded-xl border"
              >
                <EntityCard state={previewState} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{ borderColor: 'var(--border-soft)' }}
          className="flex items-center justify-end gap-2.5 border-t px-6 py-4"
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!currentEntityState && !selectedEntityId}
            className="btn btn-primary btn-sm"
          >
            {initialCard ? 'Cập Nhật Thẻ' : 'Lưu & Thêm Vào Bảng'}
          </button>
        </div>
      </div>
    </div>
  )
}
