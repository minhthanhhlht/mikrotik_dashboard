export type CardType =
  | 'on_off'
  | 'climate'
  | 'sensor'
  | 'binary_sensor'
  | 'cover'
  | 'media_player'
  | 'fan'
  | 'lock'
  | 'weather'
  | 'kpi_stat'

export interface DashboardCardConfig {
  id: string
  type: CardType
  entityId: string
  customTitle?: string
  area?: string
  options?: Record<string, unknown>
}

export interface DashboardTabConfig {
  id: string
  label: string
  icon?: string
}

export interface DashboardViewConfig {
  id: string
  title: string
  icon: string
  category?: 'DASHBOARD' | 'HỆ THỐNG' | string
  tabs?: DashboardTabConfig[]
  cards: DashboardCardConfig[]
}

export interface DashboardConfig {
  title: string
  version: number
  updatedAt?: string
  views: DashboardViewConfig[]
}
