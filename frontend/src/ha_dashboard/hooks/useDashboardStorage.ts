import { useCallback, useEffect, useState } from 'react'
import type { DashboardCardConfig, DashboardConfig, DashboardViewConfig } from '../lib/storageTypes'
import {
  addCardToView,
  addViewToDashboard,
  deleteCardFromView,
  deleteViewFromDashboard,
  downloadBackupFile,
  loadDashboardConfig,
  moveCardInView,
  parseConfigJson,
  resetDashboardConfig,
  saveDashboardConfig,
  saveToSourceFile,
  updateCardInView,
} from '../lib/dashboardStorage'

export function useDashboardStorage() {
  const [config, setConfig] = useState<DashboardConfig>(() => loadDashboardConfig())
  const [isEditMode, setIsEditMode] = useState<boolean>(false)

  // Tự động lưu tức thì vào LocalStorage VÀ file mã nguồn defaultDashboard.json
  useEffect(() => {
    saveDashboardConfig(config)

    // Tự động lưu vào file mã nguồn defaultDashboard.json trong nền
    const timer = setTimeout(() => {
      saveToSourceFile(config).catch((err) => {
        console.warn('Tự động ghi file mã nguồn defaultDashboard.json:', err)
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [config])

  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => !prev)
  }, [])

  const addCard = useCallback((viewId: string, card: Omit<DashboardCardConfig, 'id'>) => {
    setConfig((prev) => addCardToView(prev, viewId, card))
  }, [])

  const updateCard = useCallback(
    (viewId: string, cardId: string, cardData: Partial<DashboardCardConfig>) => {
      setConfig((prev) => updateCardInView(prev, viewId, cardId, cardData))
    },
    [],
  )

  const deleteCard = useCallback((viewId: string, cardId: string) => {
    setConfig((prev) => deleteCardFromView(prev, viewId, cardId))
  }, [])

  const moveCard = useCallback(
    (viewId: string, cardId: string, direction: 'left' | 'right', area?: string) => {
      setConfig((prev) => moveCardInView(prev, viewId, cardId, direction, area))
    },
    [],
  )

  const addView = useCallback((view: Omit<DashboardViewConfig, 'id' | 'cards'>) => {
    setConfig((prev) => addViewToDashboard(prev, view))
  }, [])

  const deleteView = useCallback((viewId: string) => {
    setConfig((prev) => deleteViewFromDashboard(prev, viewId))
  }, [])

  const exportBackup = useCallback(() => {
    downloadBackupFile(config)
  }, [config])

  const importBackup = useCallback((jsonStr: string): boolean => {
    try {
      const parsed = parseConfigJson(jsonStr)
      setConfig(parsed)
      saveDashboardConfig(parsed)
      return true
    } catch (err) {
      console.error('Import thất bại:', err)
      return false
    }
  }, [])

  const resetToDefault = useCallback(() => {
    const def = resetDashboardConfig()
    setConfig(def)
  }, [])

  const saveRawConfig = useCallback((newConfig: DashboardConfig) => {
    setConfig(newConfig)
    saveDashboardConfig(newConfig)
  }, [])

  const saveSourceFile = useCallback(async () => {
    return await saveToSourceFile(config)
  }, [config])

  return {
    config,
    isEditMode,
    setIsEditMode,
    toggleEditMode,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    addView,
    deleteView,
    exportBackup,
    importBackup,
    resetToDefault,
    saveRawConfig,
    saveSourceFile,
  }
}
