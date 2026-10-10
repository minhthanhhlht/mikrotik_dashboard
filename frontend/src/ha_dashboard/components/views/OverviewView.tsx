import { useMemo } from 'react'
import type { HAState } from '../../lib/types'
import type { DashboardCardConfig, DashboardViewConfig } from '../../lib/storageTypes'
import { friendlyName } from '../../lib/format'
import Toggle from '../Toggle'
import { homeAssistantService } from '../../hooks/useService'
import ModernWeatherCard from '../entities/ModernWeatherCard'
import EntityCard from '../EntityCard'
import CardWrapper from '../editor/CardWrapper'

export interface OverviewStats {
  onlineLights: number
  totalLights: number
  activeDevices: number
  totalDevices: number
  openDoors: number
  totalDoors: number
  avgTemp: number
  avgHum: number
}

interface OverviewViewProps {
  states: HAState[]
  stats: OverviewStats
  viewConfig?: DashboardViewConfig
  isEditMode?: boolean
  onMoveCard?: (cardId: string, direction: 'left' | 'right') => void
  onEditCard?: (card: DashboardCardConfig) => void
  onDeleteCard?: (cardId: string) => void
  onAddCard?: () => void
}

/**
 * View Tổng quan chuẩn ServerKit (KPI Band + Quick Controls + Weather)
 */
export default function OverviewView({
  states,
  stats,
  viewConfig,
  isEditMode = false,
  onMoveCard,
  onEditCard,
  onDeleteCard,
  onAddCard,
}: OverviewViewProps) {
  const lights = states.filter((s) => s.entity_id.startsWith('light.'))
  const weatherState = states.find((s) => s.entity_id.startsWith('weather.'))

  const stateMap = useMemo(() => {
    return new Map(states.map((s) => [s.entity_id, s]))
  }, [states])

  const kpis = [
    {
      label: 'ĐÈN TRỰC TUYẾN',
      val: `${stats.onlineLights}`,
      sub: `/ ${stats.totalLights} ĐÈN`,
      icon: '💡',
      color: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.22)',
      active: stats.onlineLights > 0,
    },
    {
      label: 'THIẾT BỊ HOẠT ĐỘNG',
      val: `${stats.activeDevices}`,
      sub: `/ ${stats.totalDevices} TỔNG`,
      icon: '🔌',
      color: '#818cf8',
      bg: 'rgba(129, 140, 248, 0.22)',
      active: stats.activeDevices > 0,
    },
    {
      label: 'CỬA ĐANG MỞ',
      val: `${stats.openDoors}`,
      sub: `/ ${stats.totalDoors} CỬA`,
      icon: '🚪',
      color: '#fb923c',
      bg: 'rgba(251, 146, 60, 0.22)',
      active: stats.openDoors > 0,
    },
    {
      label: 'NHIỆT ĐỘ TRUNG BÌNH',
      val: `${stats.avgTemp.toFixed(1)}`,
      sub: '°C TRONG NHÀ',
      icon: '🌡️',
      color: '#f43f5e',
      bg: 'rgba(244, 63, 94, 0.22)',
      active: true,
    },
    {
      label: 'ĐỘ ẨM TRUNG BÌNH',
      val: `${stats.avgHum.toFixed(0)}`,
      sub: '% ĐỘ ẨM',
      icon: '💧',
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.22)',
      active: true,
    },
  ]

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Tổng Quan Hệ Thống
            </h1>
            <span className="sk-tag sk-tag--prod">REALTIME</span>
          </div>
          <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            Giám sát trạng thái thiết bị, môi trường và điều khiển nhanh các thực thể.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {weatherState && (
            <div className="max-w-md w-full sm:w-auto">
              <ModernWeatherCard state={weatherState} />
            </div>
          )}

          {isEditMode && onAddCard && (
            <button
              type="button"
              onClick={onAddCard}
              className="btn btn-primary btn-sm"
            >
              + Thêm thẻ
            </button>
          )}
        </div>
      </div>

      {/* KPI Band (.sk-kpiband) */}
      <div className="sk-kpiband">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="sk-kpi">
            <div className="sk-kpi__header">
              <span className="sk-kpi__label truncate">{kpi.label}</span>
              <div
                style={{
                  backgroundColor: kpi.active ? kpi.bg : 'var(--surface-2)',
                  borderColor: kpi.active ? `${kpi.color}55` : 'var(--border-soft)',
                  boxShadow: kpi.active ? `0 0 12px ${kpi.color}40` : 'none',
                  filter: kpi.active ? 'none' : 'grayscale(100%) opacity(0.35)',
                  transition: 'all 0.25s ease',
                }}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border text-sm shadow-sm"
              >
                <span>{kpi.icon}</span>
              </div>
            </div>
            <div className="sk-kpi__value">{kpi.val}</div>
            <div className="sk-kpi__sub font-mono truncate">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Dynamic Cards Grid if viewConfig is present */}
      {viewConfig && viewConfig.cards.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border-soft)' }}>
            <h2 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Thực Thể Bảng Điều Khiển Tổng Quan
            </h2>
            <span className="sk-tag sk-tag--prod">{viewConfig.cards.length} THIẾT BỊ</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {viewConfig.cards.map((cardConfig, idx) => {
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

              const finalState: HAState = cardConfig.customTitle
                ? {
                    ...resolvedState,
                    attributes: {
                      ...resolvedState.attributes,
                      friendly_name: cardConfig.customTitle,
                    },
                  }
                : resolvedState

              return (
                <CardWrapper
                  key={cardConfig.id}
                  card={cardConfig}
                  isEditMode={isEditMode}
                  onMoveLeft={idx > 0 && onMoveCard ? () => onMoveCard(cardConfig.id, 'left') : undefined}
                  onMoveRight={idx < viewConfig.cards.length - 1 && onMoveCard ? () => onMoveCard(cardConfig.id, 'right') : undefined}
                  onEdit={onEditCard ? () => onEditCard(cardConfig) : undefined}
                  onDelete={onDeleteCard ? () => onDeleteCard(cardConfig.id) : undefined}
                >
                  <EntityCard state={finalState} />
                </CardWrapper>
              )
            })}
          </div>
        </div>
      ) : (
        /* Fallback Quick Light Controls Console */
        <div className="sk-card p-6">
          <div className="mb-5 flex items-center justify-between border-b pb-3.5" style={{ borderColor: 'var(--border-soft)' }}>
            <div>
              <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                Điều Khiển Nhanh — Chiếu Sáng
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                Chuyển đổi trạng thái tức thì cho các thực thể đèn trong nhà.
              </p>
            </div>
            <span className="sk-pill sk-pill--accent">
              <span className="sk-pill__dot" />
              <span>{stats.onlineLights} / {stats.totalLights} ĐANG BẬT</span>
            </span>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {lights.map((s) => {
              const on = s.state === 'on'
              return (
                <div
                  key={s.entity_id}
                  style={{
                    backgroundColor: on ? 'var(--surface-2)' : 'var(--surface-0)',
                    borderColor: on ? 'var(--accent-dim)' : 'var(--border-soft)',
                  }}
                  className="flex items-center justify-between rounded-lg border p-3.5 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {friendlyName(s)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`sk-state ${on ? 'sk-state--green' : ''}`}>
                        {on ? 'ON' : 'OFF'}
                      </span>
                      <span className="font-mono text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                        {s.entity_id}
                      </span>
                    </div>
                  </div>
                  <Toggle
                    on={on}
                    onChange={() => homeAssistantService.toggle(s.entity_id)}
                    accent="accent"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
