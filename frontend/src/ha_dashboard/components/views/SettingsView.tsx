import { useMemo, useState } from 'react'
import type { ConnectionState, HAState } from '../../lib/types'
import type { CardType, DashboardCardConfig } from '../../lib/storageTypes'
import ConnectPanel from '../ConnectPanel'

interface SettingsViewProps {
  connectionState: ConnectionState
  hasEnvToken: boolean
  onConnectFromEnv: () => void
  states?: HAState[]
  views?: { id: string; title: string }[]
  onAddCardToView?: (viewId: string, card: Omit<DashboardCardConfig, 'id'>) => void
  onAutoSyncDashboard?: () => void
}

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

/**
 * View Cấu hình & Cài đặt chuẩn ServerKit kèm Trình duyệt Thực thể (Entity Explorer)
 */
export default function SettingsView({
  connectionState,
  hasEnvToken,
  onConnectFromEnv,
  states = [],
  views = [],
  onAddCardToView,
  onAutoSyncDashboard,
}: SettingsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [targetViewId, setTargetViewId] = useState<string>(views[0]?.id ?? 'overview')
  const [addedEntityId, setAddedEntityId] = useState<string | null>(null)

  // Danh sách các domain có trong states
  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    states.forEach((s) => {
      const domain = s.entity_id.split('.')[0]
      counts[domain] = (counts[domain] ?? 0) + 1
    })
    return counts
  }, [states])

  const domainList = useMemo(() => {
    return Object.entries(domainCounts).sort((a, b) => b[1] - a[1])
  }, [domainCounts])

  const filteredStates = useMemo(() => {
    return states.filter((s) => {
      if (selectedDomain !== 'all') {
        if (!s.entity_id.startsWith(`${selectedDomain}.`)) return false
      }
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      const fname = String(s.attributes.friendly_name ?? '').toLowerCase()
      return s.entity_id.toLowerCase().includes(q) || fname.includes(q)
    })
  }, [states, selectedDomain, searchQuery])

  const handleQuickAdd = (state: HAState) => {
    if (!onAddCardToView) return
    const cardType = inferCardType(state.entity_id)
    onAddCardToView(targetViewId, {
      type: cardType,
      entityId: state.entity_id,
      customTitle: state.attributes.friendly_name ? String(state.attributes.friendly_name) : undefined,
    })
    setAddedEntityId(state.entity_id)
    setTimeout(() => setAddedEntityId(null), 2500)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Cài Đặt & Quản Lý Thực Thể
            </h1>
            <span className="sk-tag sk-tag--dev">CONFIG</span>
          </div>
          <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            Quản lý cổng kết nối Home Assistant WebSocket và khám phá toàn bộ thực thể được nạp từ hệ thống.
          </p>
        </div>

        {states.length > 0 && onAutoSyncDashboard && (
          <button
            type="button"
            onClick={onAutoSyncDashboard}
            className="btn btn-primary btn-sm flex items-center gap-2"
          >
            <span>⚡</span>
            <span>Tự động đồng bộ Dashboard từ HA ({states.length} entities)</span>
          </button>
        )}
      </div>

      {/* Gateway Panel */}
      <ConnectPanel
        connectionState={connectionState}
        hasEnvToken={hasEnvToken}
        onConnectFromEnv={onConnectFromEnv}
      />

      {/* Entity Explorer Section */}
      <section className="sk-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-soft)' }}>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                Trình Duyệt Thực Thể (Entity Explorer)
              </h2>
              <span className="sk-tag sk-tag--accent font-mono text-xs">
                {states.length} THỰC THỂ ĐÃ NẠP
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
              Xem toàn bộ danh sách thiết bị/thực thể đang online trên Home Assistant của bạn và thêm nhanh vào Dashboard.
            </p>
          </div>

          {views.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>Thêm vào Tab:</span>
              <select
                value={targetViewId}
                onChange={(e) => setTargetViewId(e.target.value)}
                className="sk-select text-xs py-1 px-2 font-mono"
              >
                {views.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search & Domain Filter Chips */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="🔍 Tìm kiếm theo entity_id hoặc tên thiết bị (VD: switch, weather, sensor, may_bom...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sk-input text-xs w-full"
          />

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedDomain('all')}
              className={`sk-state cursor-pointer hover:opacity-80 text-xs ${selectedDomain === 'all' ? 'sk-state--cyan' : ''}`}
            >
              Tất cả ({states.length})
            </button>
            {domainList.map(([domain, count]) => (
              <button
                key={domain}
                type="button"
                onClick={() => setSelectedDomain(domain)}
                className={`sk-state cursor-pointer hover:opacity-80 text-xs ${selectedDomain === domain ? 'sk-state--cyan' : ''}`}
              >
                {domain} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Entities Table with Scrollable Container and Sticky Header */}
        <div
          style={{
            borderColor: 'var(--border-soft)',
            backgroundColor: 'var(--surface-2)',
          }}
          className="rounded-lg border max-h-[420px] overflow-y-auto overflow-x-auto shadow-inner"
        >
          {filteredStates.length === 0 ? (
            <div className="text-center py-12 font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
              Không tìm thấy thực thể nào phù hợp với bộ lọc tìm kiếm.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: 'var(--surface-3)' }}>
                <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--border-soft)', color: 'var(--text-faint)' }}>
                  <th className="py-2.5 px-3">Tên & Thực Thể (Entity ID)</th>
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3">Trạng Thái (State)</th>
                  <th className="py-2.5 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                {filteredStates.map((s) => {
                  const domain = s.entity_id.split('.')[0]
                  const isJustAdded = addedEntityId === s.entity_id
                  return (
                    <tr key={s.entity_id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <div className="font-sans font-semibold text-xs truncate max-w-xs" style={{ color: 'var(--text)' }}>
                          {String(s.attributes.friendly_name ?? s.entity_id)}
                        </div>
                        <div className="text-[11px] truncate max-w-xs" style={{ color: 'var(--text-faint)' }}>
                          {s.entity_id}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="sk-tag font-mono text-[10px]">{domain}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`sk-state text-xs ${s.state === 'on' || s.state === 'playing' ? 'sk-state--green' : ''}`}>
                          {s.state} {s.attributes.unit_of_measurement ? String(s.attributes.unit_of_measurement) : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {onAddCardToView && (
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(s)}
                            className={`btn btn-xs ${isJustAdded ? 'btn-primary' : 'btn-secondary'}`}
                          >
                            {isJustAdded ? '✓ Đã thêm' : '+ Thêm vào thẻ'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
