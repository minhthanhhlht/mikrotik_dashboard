-----
name: Neon Glass Light
colors:
  surface: '#f4f6fa'
  surface-dim: '#e8ecf4'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef2f8'
  surface-container: '#e3e8f2'
  surface-container-high: '#d8dfea'
  surface-container-highest: '#cdd5e2'
  on-surface: '#0f172a'
  on-surface-variant: '#475569'
  inverse-surface: '#0f172a'
  inverse-on-surface: '#f8fafc'
  outline: '#94a3b8'
  outline-variant: '#cbd5e1'
  surface-tint: '#0084ff'
  primary: '#0084ff'
  on-primary: '#ffffff'
  primary-container: '#cfe8ff'
  on-primary-container: '#003e80'
  inverse-primary: '#7cc4ff'
  secondary: '#d946ef'
  on-secondary: '#ffffff'
  secondary-container: '#fce7f3'
  on-secondary-container: '#701a75'
  tertiary: '#7c3aed'
  on-tertiary: '#ffffff'
  tertiary-container: '#ede9fe'
  on-tertiary-container: '#4c1d95'
  error: '#e11d48'
  on-error: '#ffffff'
  error-container: '#ffe4e6'
  on-error-container: '#881337'
  primary-fixed: '#bfe3ff'
  primary-fixed-dim: '#7cc4ff'
  on-primary-fixed: '#00244a'
  on-primary-fixed-variant: '#004a9e'
  secondary-fixed: '#fbcfe8'
  secondary-fixed-dim: '#f472b6'
  on-secondary-fixed: '#3b0764'
  on-secondary-fixed-variant: '#86198f'
  tertiary-fixed: '#ddd6fe'
  tertiary-fixed-dim: '#a78bfa'
  on-tertiary-fixed: '#2e1065'
  on-tertiary-fixed-variant: '#5b21b6'
  background: '#f4f6fa'
  on-background: '#0f172a'
  surface-variant: '#e2e8f0'

typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  data-display:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.2'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.1'

rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px

spacing:
  unit: 8px
  container-padding: 32px
  gutter: 24px
  rail-width: 80px
  card-gap: 20px
Brand & Style
Hệ thống thiết kế này xây dựng cho môi trường điều khiển thông minh cao cấp. Phong cách chủ đạo là sự kết hợp giữa Frosted Glassmorphism và High-Contrast Precision, giữ nguyên tính kỹ thuật nhưng đem lại cảm giác tối giản, sáng rực và hiện đại.

Thiết kế sử dụng nền Luminous Void (#F4F6FA) để làm nổi bật các panô kính mờ lơ lửng. Thay vì hiệu ứng phát sáng quá rộng của dark mode, các phần tử tương tác ở Light Mode sử dụng dải màu neon đậm sắc kết hợp viền tán xạ ánh sáng (refraction) và bóng mờ nhẹ để báo hiệu trạng thái.

Colors
Background (Luminous Void): #F4F6FA — Tạo độ sâu tươi sáng cho các lớp kính mờ.

Primary (Neon Blue): #0084FF — Dùng cho trạng thái active, nút bấm chính, indicator kết nối.

Secondary (Vibrant Magenta): #D946EF — Dùng cho bộ điều khiển media, khu vực giải trí, sưởi ấm.

Tertiary (Deep Violet): #7C3AED — Dùng cho hệ thống đèn chiếu sáng và không gian.

Amber: #D97706 — Dùng cho cảnh báo, chế độ tiết kiệm điện hoặc ánh sáng hoàng hôn.

Glass Surfaces: Dùng nền bán trong suốt sáng rgba(255, 255, 255, 0.65) kết hợp viền mỏng độ tương phản cao.

Elevation & Depth
Độ sâu không dựa vào bóng tối dày, mà thông qua Tonal Refraction & Soft Shadowing:

Background: Nền base #F4F6FA.

Level 1 (Cards): rgba(255, 255, 255, 0.65) với backdrop-filter: blur(20px). Các phần tử có viền 1px solid rgba(255, 255, 255, 0.8) ở góc trên-trái và đổ bóng nhẹ 0 8px 32px rgba(15, 23, 42, 0.06).

Level 2 (Active/Hover): Khi hover/focus, tăng độ rõ của viền và thêm hiệu ứng Neon Outer Glow nhẹ: box-shadow: 0 0 20px rgba(0, 132, 255, 0.28) kết hợp bóng đổ 0 10px 25px rgba(15, 23, 42, 0.1).



Components
Buttons & Toggles

Primary Action: Phủ màu Neon Blue (#0084FF) đậm với chữ trắng (#FFFFFF). Khi hover, tạo dải glow màu Blue neon nhẹ xung quanh.

Glass Toggles: Rãnh trượt làm bằng kính sáng mờ rgba(226, 232, 240, 0.8). Tấm di chuyển (thumb) phát sáng màu Primary (#0084FF) khi "On" và màu xám trung tính (#94A3B8) khi "Off".

Glass Cards

Tất cả thẻ bắt buộc có backdrop-filter: blur(20px).

Sử dụng viền 1px góc trên-trái màu trắng sáng (rgba(255, 255, 255, 0.9)) và góc dưới-phải màu tối nhẹ (rgba(148, 163, 184, 0.3)) để tạo hiệu ứng độ dày của thủy tinh.

Navigation Rail

Thanh dọc bên trái nền kính mờ. Icon dạng line-art màu xám đậm (#475569).

Trạng thái Active: Hiển thị thanh neon màu Primary ở mép trái, icon đổi sang màu Primary kết hợp hiệu ứng nền phát sáng nhẹ rgba(0, 132, 255, 0.15).

Technical Data Displays

Giữ nguyên phông chữ Space Grotesk. Số liệu lớn hơn đơn vị đo (ví dụ: 24°C). Sử dụng các màu accent tương phản rõ trên nền sáng (Cyan, Amber, Magenta) để phân loại dữ liệu theo trạng thái.

Input Fields

Kiểu gạch chân (Underline) hoặc ô nhạt (Ghost-box) nền rgba(255, 255, 255, 0.5). Đường gạch chân sẽ lan rộng từ giữa ra hai bên và phát sáng màu Cyan khi người dùng focus vào ô nhập liệu.