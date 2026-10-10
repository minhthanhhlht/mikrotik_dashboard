import type { DashboardConfig } from './storageTypes'

export const INITIAL_DASHBOARD_CONFIG: DashboardConfig = {
  title: 'Home Assistant Modern Dashboard',
  version: 3,
  updatedAt: new Date().toISOString(),
  views: [
    {
      id: 'overview',
      title: 'Tổng quan',
      icon: 'overview',
      category: 'DASHBOARD',
      cards: [
        {
          id: 'card_ov_w_0',
          type: 'weather',
          entityId: 'weather.weatherapi_ha_noi',
        },
        {
          id: 'card_ov_w_1',
          type: 'weather',
          entityId: 'weather.forecast_home',
        },
        {
          id: 'card_ov_sw_0',
          type: 'on_off',
          entityId: 'switch.may_bom_child_lock',
        },
        {
          id: 'card_ov_sw_1',
          type: 'on_off',
          entityId: 'switch.may_bom_socket_1',
        },
        {
          id: 'card_ov_sn_0',
          type: 'sensor',
          entityId: 'sensor.sun_next_dawn',
        },
        {
          id: 'card_ov_sn_1',
          type: 'sensor',
          entityId: 'sensor.sun_next_dusk',
        },
        {
          id: 'card_ov_sn_2',
          type: 'sensor',
          entityId: 'sensor.sun_next_midnight',
        },
        {
          id: 'card_ov_sn_3',
          type: 'sensor',
          entityId: 'sensor.sun_next_noon',
        },
        {
          id: 'card_ov_sn_4',
          type: 'sensor',
          entityId: 'sensor.sun_next_rising',
        },
        {
          id: 'card_ov_sn_5',
          type: 'sensor',
          entityId: 'sensor.sun_next_setting',
        },
        {
          id: 'card_ov_au_0',
          type: 'on_off',
          entityId: 'script.tat_toan_bo_den',
        },
        {
          id: 'card_ov_au_1',
          type: 'on_off',
          entityId: 'automation.tat_toan_bo_den',
        },
        {
          id: 'card_ov_au_2',
          type: 'on_off',
          entityId: 'automation.tu_dong_hoa_moi',
        },
        {
          id: 'card_ov_au_3',
          type: 'on_off',
          entityId: 'automation.nhan_dien_camera_phong_khach',
        },
      ],
    },
    {
      id: 'tang_1',
      title: 'Tầng 1',
      icon: 'rooms',
      category: 'DASHBOARD',
      tabs: [
        { id: 'phong_khach', label: 'Phòng khách', icon: '🛋️' },
        { id: 'bep', label: 'Bếp & Phòng ăn', icon: '🍳' },
      ],
      cards: [
        {
          id: 't1_card_1',
          type: 'on_off',
          entityId: 'light.phong_khach',
          customTitle: 'Đèn chùm phòng khách',
          area: 'phong_khach',
        },
        {
          id: 't1_card_2',
          type: 'climate',
          entityId: 'climate.dieu_hoa_phong_khach',
          customTitle: 'Điều hòa phòng khách',
          area: 'phong_khach',
        },
        {
          id: 't1_card_3',
          type: 'on_off',
          entityId: 'light.den_bep',
          customTitle: 'Đèn bàn ăn',
          area: 'bep',
        },
        {
          id: 't1_card_4',
          type: 'on_off',
          entityId: 'switch.may_hut_mui',
          customTitle: 'Máy hút mùi',
          area: 'bep',
        },
        {
          id: 'card_wu8c7nc',
          type: 'on_off',
          entityId: 'switch.bong_den_tran_l1',
          customTitle: 'Bóng đèn Trần L1',
          area: 'phong_khach',
        },
      ],
    },
    {
      id: 'tang_2',
      title: 'Tầng 2',
      icon: 'rooms',
      category: 'DASHBOARD',
      tabs: [
        { id: 'phong_ngu_1', label: 'Phòng ngủ trước', icon: '🛏️' },
        { id: 'hanh_lang', label: 'Hành lang T2', icon: '🚪' },
        { id: 'phong_ngu_2', label: 'Phòng ngủ sau', icon: '🛏️' },
      ],
      cards: [
        {
          id: 't2_card_1',
          type: 'on_off',
          entityId: 'light.phong_ngu_master',
          customTitle: 'Đèn phòng ngủ trước',
          area: 'phong_ngu_1',
        },
        {
          id: 't2_card_2',
          type: 'climate',
          entityId: 'climate.dieu_hoa_pn_master',
          customTitle: 'Điều hòa Master',
          area: 'phong_ngu_1',
        },
        {
          id: 't2_card_3',
          type: 'on_off',
          entityId: 'light.den_hanh_lang_t2',
          customTitle: 'Đèn hành lang',
          area: 'hanh_lang',
        },
        {
          id: 't2_card_4',
          type: 'on_off',
          entityId: 'light.phong_ngu_2',
          customTitle: 'Đèn phòng ngủ sau',
          area: 'phong_ngu_2',
        },
      ],
    },
    {
      id: 'tang_3',
      title: 'Tầng 3',
      icon: 'rooms',
      category: 'DASHBOARD',
      tabs: [
        { id: 'phong_ngu_1', label: 'Phòng ngủ trước', icon: '🛏️' },
        { id: 'hanh_lang', label: 'Hành lang T3', icon: '🚪' },
        { id: 'phong_ngu_2', label: 'Phòng ngủ sau', icon: '🛏️' },
      ],
      cards: [
        {
          id: 't3_card_1',
          type: 'on_off',
          entityId: 'light.phong_ngu_t3_1',
          customTitle: 'Đèn trần PN trước',
          area: 'phong_ngu_1',
        },
        {
          id: 't3_card_2',
          type: 'on_off',
          entityId: 'light.den_hanh_lang_t3',
          customTitle: 'Đèn hành lang T3',
          area: 'hanh_lang',
        },
        {
          id: 't3_card_3',
          type: 'on_off',
          entityId: 'light.phong_ngu_t3_2',
          customTitle: 'Đèn trần PN sau',
          area: 'phong_ngu_2',
        },
      ],
    },
    {
      id: 'tang_tum',
      title: 'Tầng tum',
      icon: 'rooms',
      category: 'DASHBOARD',
      tabs: [
        { id: 'san_phoi', label: 'Sân phơi & Giặt', icon: '🧺' },
        { id: 'phong_tho', label: 'Phòng thờ', icon: '🕯️' },
      ],
      cards: [
        {
          id: 'tt_card_1',
          type: 'on_off',
          entityId: 'switch.may_giat',
          customTitle: 'Ổ cắm Máy giặt',
          area: 'san_phoi',
        },
        {
          id: 'tt_card_2',
          type: 'on_off',
          entityId: 'light.den_san_phoi',
          customTitle: 'Đèn sân phơi',
          area: 'san_phoi',
        },
        {
          id: 'tt_card_3',
          type: 'on_off',
          entityId: 'light.den_phong_tho',
          customTitle: 'Đèn phòng thờ',
          area: 'phong_tho',
        },
      ],
    },
    {
      id: 'climate',
      title: 'Khí hậu & Điều hòa',
      icon: 'climate',
      category: 'HỆ THỐNG',
      cards: [
        {
          id: 'cl_1',
          type: 'climate',
          entityId: 'climate.dieu_hoa_phong_khach',
          customTitle: 'Điều hòa phòng khách',
        },
      ],
    },
    {
      id: 'security',
      title: 'An ninh & Cửa',
      icon: 'security',
      category: 'HỆ THỐNG',
      cards: [
        {
          id: 'sec_1',
          type: 'sensor',
          entityId: 'sensor.cua_chinh',
          customTitle: 'Cửa chính',
        },
      ],
    },
    {
      id: 'energy',
      title: 'Năng lượng & Điện',
      icon: 'energy',
      category: 'HỆ THỐNG',
      cards: [
        {
          id: 'en_1',
          type: 'sensor',
          entityId: 'sensor.cong_suat_tong',
          customTitle: 'Công suất tiêu thụ',
        },
      ],
    },
  ],
}
