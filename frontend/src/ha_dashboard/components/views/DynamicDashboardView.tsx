import { useState, useMemo } from 'react'
import type { HAState } from '../../lib/types'
import type { DashboardCardConfig, DashboardViewConfig } from '../../lib/storageTypes'
import EntityCard from '../EntityCard'
import CardWrapper from '../editor/CardWrapper'

interface DynamicDashboardViewProps {
  viewConfig: DashboardViewConfig
  states: HAState[]
  isEditMode: boolean
  onMoveCard: (cardId: string, direction: 'left' | 'right', area?: string) => void
  onEditCard: (card: DashboardCardConfig) => void
  onDeleteCard: (cardId: string) => void
  onAddCard?: (area?: string) => void
}

/**
 * View kết xuất linh hoạt danh sách Card theo cấu hình Storage Mode kèm hỗ trợ Tabs Khu vực / Phòng
 */
export default function DynamicDashboardView({
  viewConfig,
  states,
  isEditMode,
  onMoveCard,
  onEditCard,
  onDeleteCard,
  onAddCard,
}: DynamicDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<string>('all')

  const stateMap = useMemo(() => {
    return new Map(states.map((s) => [s.entity_id, s]))
  }, [states])

  // Lọc cards theo tab khu vực được chọn
  const filteredCards = useMemo(() => {
    if (!viewConfig.tabs || viewConfig.tabs.length === 0 || activeTab === 'all') {
      return viewConfig.cards
    }
    return viewConfig.cards.filter((c) => c.area === activeTab)
  }, [viewConfig.cards, viewConfig.tabs, activeTab])

  // Map tên khu vực từ tab id
  const areaNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (viewConfig.tabs) {
      viewConfig.tabs.forEach((t) => map.set(t.id, t.label))
    }
    return map
  }, [viewConfig.tabs])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              {viewConfig.title}
            </h1>
            <span className="sk-tag sk-tag--prod">{viewConfig.cards.length} THIẾT BỊ</span>
          </div>
          <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            Quản lý và điều khiển các thực thể không gian {viewConfig.title}.
          </p>
        </div>

        {isEditMode && onAddCard && (
          <button
            type="button"
            onClick={() => onAddCard(activeTab !== 'all' ? activeTab : undefined)}
            className="btn btn-primary btn-sm"
          >
            + Thêm thẻ vào {viewConfig.title}
          </button>
        )}
      </div>

      {/* Sub-tabs khu vực / phòng */}
      {viewConfig.tabs && viewConfig.tabs.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--border-soft)]">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={{
              backgroundColor: activeTab === 'all' ? 'var(--accent-bg)' : 'transparent',
              color: activeTab === 'all' ? 'var(--accent-bright)' : 'var(--text-dim)',
              borderColor: activeTab === 'all' ? 'var(--accent)' : 'transparent',
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors whitespace-nowrap"
          >
            <span>🏢</span>
            <span>Tất cả phòng ({viewConfig.cards.length})</span>
          </button>

          {viewConfig.tabs.map((tab) => {
            const count = viewConfig.cards.filter((c) => c.area === tab.id).length
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent',
                  color: isActive ? 'var(--accent-bright)' : 'var(--text-dim)',
                  borderColor: isActive ? 'var(--accent)' : 'transparent',
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium border transition-colors whitespace-nowrap hover:bg-[var(--surface-hover)]"
              >
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.label}</span>
                <span
                  style={{
                    backgroundColor: isActive ? 'var(--accent)' : 'var(--surface-active)',
                    color: isActive ? 'var(--accent-contrast, #000)' : 'var(--text-faint)',
                  }}
                  className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold"
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border-strong)',
          }}
          className="rounded-2xl border border-dashed p-12 text-center space-y-3"
        >
          <div className="text-3xl">📭</div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Chưa có thẻ thiết bị nào trong mục này
          </h3>
          <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--text-dim)' }}>
            {activeTab !== 'all'
              ? `Chưa có thiết bị nào được gán vào khu vực "${areaNameMap.get(activeTab) || activeTab}". Bấm nút bên dưới để thêm mới.`
              : 'Bấm nút bên dưới để chọn thiết bị từ Home Assistant và thêm vào bảng điều khiển.'}
          </p>
          {onAddCard && (
            <button
              type="button"
              onClick={() => onAddCard(activeTab !== 'all' ? activeTab : undefined)}
              className="btn btn-primary btn-sm mt-2"
            >
              + Thêm Thẻ Thiết Bị
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCards.map((cardConfig, idx) => {
            const rawState = stateMap.get(cardConfig.entityId)
            const resolvedState: HAState = rawState ?? {
              entity_id: cardConfig.entityId,
              state: 'unavailable',
              attributes: {
                friendly_name: cardConfig.customTitle ?? cardConfig.entityId,
              },
              last_changed: '',
              last_updated: '',
              context: { id: '' },
            }

            // Ghi đè friendly_name nếu có customTitle
            const finalState: HAState = cardConfig.customTitle
              ? {
                  ...resolvedState,
                  attributes: {
                    ...resolvedState.attributes,
                    friendly_name: cardConfig.customTitle,
                  },
                }
              : resolvedState

            const areaLabel = cardConfig.area ? areaNameMap.get(cardConfig.area) : undefined

            return (
              <div key={cardConfig.id} className="relative group flex flex-col h-full">
                {activeTab === 'all' && viewConfig.tabs && viewConfig.tabs.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-1.5 px-1 min-h-[20px]">
                    {areaLabel ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-bright)]" />
                        <span className="text-[11px] font-mono font-semibold text-[var(--text-dim)]">
                          {areaLabel}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-transparent select-none">&nbsp;</span>
                    )}
                  </div>
                )}
                <div className="flex-1 flex flex-col">
                  <CardWrapper
                    card={cardConfig}
                    isEditMode={isEditMode}
                    onMoveLeft={idx > 0 ? () => onMoveCard(cardConfig.id, 'left', activeTab) : undefined}
                    onMoveRight={idx < filteredCards.length - 1 ? () => onMoveCard(cardConfig.id, 'right', activeTab) : undefined}
                    onEdit={() => onEditCard(cardConfig)}
                    onDelete={() => onDeleteCard(cardConfig.id)}
                  >
                    <EntityCard state={finalState} />
                  </CardWrapper>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
