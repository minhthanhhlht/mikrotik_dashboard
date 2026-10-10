import { useEffect, useMemo, useState } from 'react'
import { useHomeAssistant } from './hooks/useHomeAssistant'
import { useDashboardStorage } from './hooks/useDashboardStorage'
import { INITIAL_DASHBOARD_CONFIG } from './lib/defaultConfig'
import type { DashboardCardConfig, DashboardViewConfig } from './lib/storageTypes'
import { hasEnvHAToken } from './lib/env'
import NavigationRail from './components/layout/NavigationRail'
import TopBar from './components/layout/TopBar'
import OverviewView, { type OverviewStats } from './components/views/OverviewView'
import DynamicDashboardView from './components/views/DynamicDashboardView'
import SettingsView from './components/views/SettingsView'
import Toast from './components/Toast'
import EditToolbar from './components/editor/EditToolbar'
import CardConfigModal from './components/editor/CardConfigModal'
import ViewConfigModal from './components/editor/ViewConfigModal'
import RawConfigModal from './components/editor/RawConfigModal'

function App() {
  const {
    connectionState,
    states,
    notice,
    config: haConfig,
    connectFromEnv,
  } = useHomeAssistant()

  const {
    config: dashboardConfig,
    isEditMode,
    setIsEditMode,
    toggleEditMode,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    addView,
    deleteView,
    resetToDefault,
    saveRawConfig,
    saveSourceFile,
  } = useDashboardStorage()

  // Tự động kết nối tới Home Assistant khi khởi chạy (không cần đăng nhập riêng)
  useEffect(() => {
    if (connectionState === 'disconnected') {
      connectFromEnv()
    }
  }, [connectionState, connectFromEnv])

  const [view, setView] = useState<string>('overview')
  const [editingCard, setEditingCard] = useState<DashboardCardConfig | null>(null)
  const [defaultCardArea, setDefaultCardArea] = useState<string | undefined>(undefined)
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false)
  const [isRawModalOpen, setIsRawModalOpen] = useState<boolean>(false)

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('ha_theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ha_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // ĐẢM BẢO TRIỆT ĐỂ: Tổng quan ở đầu tiên, tiếp theo là 4 tầng (Tầng 1, 2, 3, Tum) và các view hệ thống
  const effectiveViews = useMemo(() => {
    const initialViews: DashboardViewConfig[] = INITIAL_DASHBOARD_CONFIG.views
    const currentViews: DashboardViewConfig[] = dashboardConfig.views || []

    // 1. Overview view luôn đứng đầu
    const overviewDef = initialViews.find((v) => v.id === 'overview')
    const overviewExisting = currentViews.find((v) => v.id === 'overview')
    const overviewView = overviewExisting || overviewDef

    // 2. Các tầng
    const floorIds = ['tang_1', 'tang_2', 'tang_3', 'tang_tum']
    const systemFloorViews = initialViews.filter((v) => floorIds.includes(v.id))

    // Lọc bỏ các view tạm thời cũ nếu có (devices, sensors, automations) và overview
    const otherViews = currentViews.filter(
      (v) =>
        !floorIds.includes(v.id) &&
        v.id !== 'overview' &&
        v.id !== 'devices' &&
        v.id !== 'sensors' &&
        v.id !== 'automations',
    )

    // Merge các tầng: giữ đúng tabs phòng và cards
    const mergedFloors = systemFloorViews.map((defFloor) => {
      const existing = currentViews.find((v) => v.id === defFloor.id)
      if (existing) {
        return {
          ...defFloor,
          ...existing,
          tabs: defFloor.tabs, // Luôn bảo toàn tabs phòng
          cards: existing.cards && existing.cards.length > 0 ? existing.cards : defFloor.cards,
        }
      }
      return defFloor
    })

    // Ghép các view hệ thống còn lại nếu chưa có
    const initialSystemViews = initialViews.filter((v) => !floorIds.includes(v.id) && v.id !== 'overview')
    const existingOtherIds = new Set(otherViews.map((v) => v.id))
    const missingSystemViews = initialSystemViews.filter((v) => !existingOtherIds.has(v.id))

    const result: DashboardViewConfig[] = []
    if (overviewView) {
      result.push(overviewView)
    }
    result.push(...mergedFloors, ...otherViews, ...missingSystemViews)
    return result
  }, [dashboardConfig.views])

  const connectionMeta = useMemo(() => {
    switch (connectionState) {
      case 'connected':
        return { label: 'Đã kết nối', dot: 'bg-[var(--green)]' }
      case 'connecting':
        return { label: 'Đang kết nối', dot: 'bg-[var(--amber)] animate-pulse' }
      case 'disconnected':
        return { label: 'Chưa kết nối', dot: 'bg-[var(--red)]' }
      default:
        return { label: 'Chế độ demo', dot: 'bg-[var(--violet)]' }
    }
  }, [connectionState])

  // Tính toán số liệu tổng quan
  const stats = useMemo<OverviewStats>(() => {
    const lights = states.filter((s) => s.entity_id.startsWith('light.'))
    const lightsOn = lights.filter((s) => s.state === 'on').length

    const domains = ['light', 'switch', 'climate', 'fan', 'media_player', 'cover', 'lock']
    const controlDevices = states.filter((s) =>
      domains.some((d) => s.entity_id.startsWith(`${d}.`)),
    )
    const activeDevices = controlDevices.filter((s) => s.state === 'on').length

    const doors = states.filter(
      (s) =>
        s.attributes.device_class === 'door' ||
        s.attributes.device_class === 'garage_door',
    )
    const openDoors = doors.filter((s) => s.state === 'on').length

    // Nhiệt độ trung bình
    const tempSensors = states.filter(
      (s) =>
        s.entity_id.startsWith('sensor.') &&
        String(s.attributes.unit_of_measurement) === '°C' &&
        !String(s.attributes.friendly_name).includes('Điều hòa'),
    )
    let sum = 0
    let count = 0
    tempSensors.forEach((s) => {
      const v = Number(s.state)
      if (!Number.isNaN(v)) {
        sum += v
        count += 1
      }
    })
    const avgTemp = count > 0 ? sum / count : 24

    // Độ ẩm trung bình
    const humSensors = states.filter(
      (s) =>
        s.entity_id.startsWith('sensor.') &&
        String(s.attributes.unit_of_measurement) === '%',
    )
    let hSum = 0
    let hCount = 0
    humSensors.forEach((s) => {
      const v = Number(s.state)
      if (!Number.isNaN(v)) {
        hSum += v
        hCount += 1
      }
    })
    const avgHum = hCount > 0 ? hSum / hCount : 60

    return {
      onlineLights: lightsOn,
      totalLights: lights.length,
      activeDevices,
      totalDevices: controlDevices.length,
      openDoors,
      totalDoors: doors.length,
      avgTemp,
      avgHum,
    }
  }, [states])

  const handleConnectFromEnv = () => {
    connectFromEnv().catch(() => {
      /* Lỗi đã được service xử lý qua notice */
    })
  }

  const hasEnvToken = hasEnvHAToken()

  // Tìm view config tương ứng từ effectiveViews
  const currentViewConfig = effectiveViews.find((v) => v.id === view)

  const handleCardSave = (cardData: Omit<DashboardCardConfig, 'id'>) => {
    const targetViewId = currentViewConfig ? currentViewConfig.id : effectiveViews[0]?.id || 'tang_1'
    if (editingCard) {
      updateCard(targetViewId, editingCard.id, cardData)
    } else {
      addCard(targetViewId, cardData)
    }
    setIsCardModalOpen(false)
    setEditingCard(null)
  }

  let content: React.ReactNode
  if (view === 'settings') {
    content = (
      <SettingsView
        connectionState={connectionState}
        hasEnvToken={hasEnvToken}
        onConnectFromEnv={handleConnectFromEnv}
        states={states}
        views={effectiveViews.map((v) => ({ id: v.id, title: v.title }))}
        onAddCardToView={(viewId, card) => addCard(viewId, card)}
      />
    )
  } else if (view === 'overview') {
    content = (
      <OverviewView
        states={states}
        stats={stats}
        viewConfig={currentViewConfig}
        isEditMode={isEditMode}
        onMoveCard={(cardId, direction) => moveCard('overview', cardId, direction)}
        onEditCard={(card) => {
          setEditingCard(card)
          setDefaultCardArea(card.area)
          setIsCardModalOpen(true)
        }}
        onDeleteCard={(cardId) => deleteCard('overview', cardId)}
        onAddCard={() => {
          setEditingCard(null)
          setDefaultCardArea(undefined)
          setIsCardModalOpen(true)
        }}
      />
    )
  } else if (currentViewConfig) {
    content = (
      <DynamicDashboardView
        key={currentViewConfig.id}
        viewConfig={currentViewConfig}
        states={states}
        isEditMode={isEditMode}
        onMoveCard={(cardId, direction, area) => moveCard(currentViewConfig.id, cardId, direction, area)}
        onEditCard={(card) => {
          setEditingCard(card)
          setDefaultCardArea(card.area)
          setIsCardModalOpen(true)
        }}
        onDeleteCard={(cardId) => deleteCard(currentViewConfig.id, cardId)}
        onAddCard={(area?: string) => {
          setEditingCard(null)
          setDefaultCardArea(area)
          setIsCardModalOpen(true)
        }}
      />
    )
  } else {
    content = (
      <OverviewView
        states={states}
        stats={stats}
        viewConfig={currentViewConfig}
        isEditMode={isEditMode}
      />
    )
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-body)',
        color: 'var(--text)',
        minHeight: '100vh',
      }}
      className="tech-grid-bg relative selection:bg-[var(--accent-bg)] selection:text-[var(--accent-bright)]"
    >
      <NavigationRail
        active={view}
        onChange={setView}
        connectionDot={connectionMeta.dot}
        connectionLabel={connectionMeta.label}
        theme={theme}
        views={effectiveViews}
        isEditMode={isEditMode}
        onAddView={() => setIsViewModalOpen(true)}
        onDeleteView={(viewId) => {
          deleteView(viewId)
          if (view === viewId) {
            setView(effectiveViews[0]?.id || 'tang_1')
          }
        }}
        onToggleTheme={toggleTheme}
      />

      {/* Main content shell — offset bởi sidebar 250px trên desktop */}
      <div className="lg:pl-[250px] flex flex-col min-h-screen">
        <TopBar
          connectionState={connectionState}
          connectionLabel={connectionMeta.label}
          connectionDetail={haConfig?.host || undefined}
          theme={theme}
          isEditMode={isEditMode}
          onToggleEditMode={toggleEditMode}
          onToggleTheme={toggleTheme}
          onOpenConnect={() => setView('settings')}
          onToggleMenu={() => setView('tang_1')}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-7 pb-24 sm:px-6 sm:pb-28 lg:pb-32">
          {content}
        </main>
      </div>

      {/* Floating Edit Mode Toolbar */}
      {isEditMode && (
        <EditToolbar
          onAddCard={() => {
            setEditingCard(null)
            setDefaultCardArea(undefined)
            setIsCardModalOpen(true)
          }}
          onAddView={() => setIsViewModalOpen(true)}
          onOpenRawConfig={() => setIsRawModalOpen(true)}
          onDone={() => setIsEditMode(false)}
        />
      )}

      {/* Modals */}
      <CardConfigModal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false)
          setEditingCard(null)
          setDefaultCardArea(undefined)
        }}
        onSave={handleCardSave}
        initialCard={editingCard}
        states={states}
        tabs={currentViewConfig?.tabs}
        defaultArea={defaultCardArea}
      />

      <ViewConfigModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        onSave={(viewData) => {
          addView(viewData)
          setIsViewModalOpen(false)
        }}
      />

      <RawConfigModal
        isOpen={isRawModalOpen}
        onClose={() => setIsRawModalOpen(false)}
        config={{ ...dashboardConfig, views: effectiveViews }}
        onSaveConfig={(newConfig) => {
          saveRawConfig(newConfig)
          setIsRawModalOpen(false)
        }}
        onResetToDefault={() => {
          resetToDefault()
          setIsRawModalOpen(false)
        }}
        onSaveToSourceFile={saveSourceFile}
      />

      <Toast message={notice} />
    </div>
  )
}

export default App
