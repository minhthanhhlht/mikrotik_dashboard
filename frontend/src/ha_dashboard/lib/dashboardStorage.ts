import { INITIAL_DASHBOARD_CONFIG } from './defaultConfig'
import type { DashboardCardConfig, DashboardConfig, DashboardViewConfig } from './storageTypes'

const STORAGE_KEY = 'ha_dashboard_storage_v3'

/**
 * Đọc cấu hình Dashboard từ localStorage.
 * Nếu chưa có hoặc lỗi hoặc là bản v1/v2 cũ thiếu tầng, nạp cấu hình mới nhất INITIAL_DASHBOARD_CONFIG
 */
export function loadDashboardConfig(): DashboardConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (localStorage.getItem('ha_dashboard_storage_v1')) {
        localStorage.removeItem('ha_dashboard_storage_v1')
      }
      if (localStorage.getItem('ha_dashboard_storage_v2')) {
        localStorage.removeItem('ha_dashboard_storage_v2')
      }

      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DashboardConfig
        if (
          parsed &&
          parsed.version >= 3 &&
          Array.isArray(parsed.views) &&
          parsed.views.some((v) => v.id === 'tang_1')
        ) {
          return parsed
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi đọc cấu hình dashboard từ localStorage:', err)
  }
  return INITIAL_DASHBOARD_CONFIG
}

/**
 * Lưu cấu hình Dashboard vào localStorage
 */
export function saveDashboardConfig(config: DashboardConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const toSave: DashboardConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave, null, 2))
    }
  } catch (err) {
    console.error('Lỗi khi lưu cấu hình dashboard vào localStorage:', err)
  }
}

/**
 * Xuất file sao lưu .json để người dùng tải về lưu vào máy/USB
 */
export function downloadBackupFile(config: DashboardConfig, filename = 'my_home_dashboard.json'): void {
  const jsonStr = JSON.stringify(config, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Lưu thẳng cấu hình vào file mã nguồn src/data/defaultDashboard.json qua API Dev Server
 */
export async function saveToSourceFile(config: DashboardConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/save-default-dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      return { ok: true, message: data.message || 'Đã lưu cấu hình vào src/data/defaultDashboard.json thành công!' }
    }
    return { ok: false, message: data.error || 'Không thể lưu vào file mã nguồn (Lỗi máy chủ).' }
  } catch (err) {
    console.error('Lỗi khi gọi API lưu file mã nguồn:', err)
    return { ok: false, message: 'Không thể kết nối đến dev server để ghi file.' }
  }
}

/**
 * Parse chuỗi JSON thành DashboardConfig (có validate cơ bản)
 */
export function parseConfigJson(jsonStr: string): DashboardConfig {
  const parsed = JSON.parse(jsonStr) as DashboardConfig
  if (!parsed || !Array.isArray(parsed.views)) {
    throw new Error('Định dạng JSON không hợp lệ: thiếu danh sách views.')
  }
  return parsed
}

/**
 * Khôi phục cấu hình về mặc định từ mã nguồn
 */
export function resetDashboardConfig(): DashboardConfig {
  saveDashboardConfig(INITIAL_DASHBOARD_CONFIG)
  return INITIAL_DASHBOARD_CONFIG
}

/**
 * Tạo ID ngẫu nhiên duy nhất cho Card / View
 */
export function generateUniqueId(prefix = 'card'): string {
  return prefix + '_' + Math.random().toString(36).substring(2, 9)
}

/**
 * Thêm một Card mới vào View chỉ định
 */
export function addCardToView(
  config: DashboardConfig,
  viewId: string,
  cardData: Omit<DashboardCardConfig, 'id'>,
): DashboardConfig {
  const newCard: DashboardCardConfig = {
    ...cardData,
    id: generateUniqueId('card'),
  }

  const newViews = config.views.map((v) => {
    if (v.id === viewId) {
      return {
        ...v,
        cards: [...v.cards, newCard],
      }
    }
    return v
  })

  return {
    ...config,
    views: newViews,
  }
}

/**
 * Cập nhật thuộc tính của Card trong View
 */
export function updateCardInView(
  config: DashboardConfig,
  viewId: string,
  cardId: string,
  patch: Partial<DashboardCardConfig>,
): DashboardConfig {
  const newViews = config.views.map((v) => {
    if (v.id === viewId) {
      return {
        ...v,
        cards: v.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
      }
    }
    return v
  })

  return {
    ...config,
    views: newViews,
  }
}

/**
 * Xóa một Card khỏi View
 */
export function deleteCardFromView(
  config: DashboardConfig,
  viewId: string,
  cardId: string,
): DashboardConfig {
  const newViews = config.views.map((v) => {
    if (v.id === viewId) {
      return {
        ...v,
        cards: v.cards.filter((c) => c.id !== cardId),
      }
    }
    return v
  })

  return {
    ...config,
    views: newViews,
  }
}

/**
 * Đổi thứ tự hiển thị của Card (Move Left / Right)
 * Hỗ trợ hoán đổi thông minh theo Tab khu vực (area) hoặc danh sách toàn bộ
 */
export function moveCardInView(
  config: DashboardConfig,
  viewId: string,
  cardId: string,
  direction: 'left' | 'right',
  area?: string,
): DashboardConfig {
  const newViews = config.views.map((v) => {
    if (v.id === viewId) {
      const allCards = [...v.cards]
      // Nếu lọc theo khu vực cụ thể và không phải 'all'
      const relevantCards =
        area && area !== 'all' ? allCards.filter((c) => c.area === area) : allCards

      const relIdx = relevantCards.findIndex((c) => c.id === cardId)
      if (relIdx === -1) return v

      const targetRelIdx = direction === 'left' ? relIdx - 1 : relIdx + 1
      if (targetRelIdx < 0 || targetRelIdx >= relevantCards.length) return v

      const targetCard = relevantCards[targetRelIdx]
      const actualIdx = allCards.findIndex((c) => c.id === cardId)
      const targetActualIdx = allCards.findIndex((c) => c.id === targetCard.id)

      if (actualIdx === -1 || targetActualIdx === -1) return v

      // Hoán đổi vị trí thẻ trong danh sách cards của view
      const newCards = [...allCards]
      const [removed] = newCards.splice(actualIdx, 1)
      newCards.splice(targetActualIdx, 0, removed)

      return {
        ...v,
        cards: newCards,
      }
    }
    return v
  })

  return {
    ...config,
    views: newViews,
  }
}

/**
 * Thêm một View (Tab không gian) mới vào Dashboard
 */
export function addViewToDashboard(
  config: DashboardConfig,
  viewData: Omit<DashboardViewConfig, 'id' | 'cards'>,
): DashboardConfig {
  const newView: DashboardViewConfig = {
    ...viewData,
    id: generateUniqueId('view'),
    cards: [],
  }

  return {
    ...config,
    views: [...config.views, newView],
  }
}

/**
 * Xóa một View khỏi Dashboard
 */
export function deleteViewFromDashboard(
  config: DashboardConfig,
  viewId: string,
): DashboardConfig {
  return {
    ...config,
    views: config.views.filter((v) => v.id !== viewId),
  }
}
