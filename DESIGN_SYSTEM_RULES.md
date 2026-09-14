# SERVERKIT DESIGN SYSTEM & UI RULES SPECIFICATION
> **Phiên bản:** 1.0 (Chuẩn Infra Console Architecture)  
> **Mục đích:** Hướng dẫn toàn diện và quy chuẩn bắt buộc để trích xuất, tái tạo và áp dụng 100% ngôn ngữ thiết kế (UI/UX Design System) của ServerKit vào bất kỳ dự án mới nào mà không bị lỗi giao diện, lệch chuẩn, vỡ theme hay xung đột CSS.

---

## 1. Tổng Quan & Triết Lý Thiết Kế (Design Philosophy)

Ngôn ngữ thiết kế của ServerKit được xây dựng theo phong cách **"Infra Console"** (Bảng điều khiển hạ tầng kỹ thuật cao cấp), lấy cảm hứng từ các công cụ DevOps/Cloud hiện đại (như Linear, Vercel, Frappe, Datadog):
1. **Dark-First nhưng hỗ trợ Light & System Theme hoàn hảo:** Mặc định là giao diện tối sâu (`#0a0b0e`), độ tương phản cao, dịu mắt cho kỹ sư hạ tầng làm việc thời gian dài.
2. **High-Density & Clean Typography:** Mật độ thông tin cao nhưng thoáng đãng, phân cấp trực quan rõ ràng qua 4 cấp màu chữ, 3 cấp bề mặt nền (surface ramp), và phân tách ranh giới bằng border 1px tinh tế.
3. **Phông chữ tự lưu trữ (Self-Hosted Fonts):** Sử dụng cặp phông **IBM Plex Sans** (giao diện chung) và **IBM Plex Mono** (dữ liệu kỹ thuật, số liệu, ID, code, IP, log, trạng thái) lưu cục bộ, không phụ thuộc Google Fonts nhằm bảo mật và hoạt động offline/air-gapped.
4. **SCSS Modularity + CSS Custom Properties:** Toàn bộ màu sắc và kích thước động được quản lý qua CSS Variables (`var(--...)`) ở runtime, hỗ trợ đổi Theme và tùy biến Accent Color tức thì mà không cần biên dịch lại CSS hay re-render React nặng nề.
5. **Nghiêm cấm Tailwind Utility Clutter:** Không sử dụng các class Tailwind tùy tiện (`flex gap-3 px-4 bg-card`). Mọi component phải tuân thủ chuẩn SCSS có cấu trúc với BEM hoặc namespace độc quyền `.sk-*`.

---

## 2. Hệ Thống Design Tokens (CSS Custom Properties)

Mọi mã màu và thuộc tính giao diện **phải** được gọi qua CSS Variables hoặc biến SCSS tương ứng. Tuyệt đối không hardcode mã hex trong component.

### 2.1 Bảng Tokens Theme Tối (Dark Theme - Mặc định `:root`)

```css
:root {
    /* ---- Backgrounds & Surface Ramp ---- */
    --bg-body: #0a0b0e;        /* Nền tổng thể toàn trang */
    --bg-sidebar: #0d0f15;     /* Nền sidebar bên trái */
    --surface-0: #0d0f14;      /* Bề mặt chìm dưới card (drawer tab, header chìm) */
    --surface: #101218;        /* Bề mặt card chính (--bg-card) */
    --surface-2: #161922;      /* Bề mặt nâng cấp 2 (--bg-elevated, --bg-secondary) */
    --surface-3: #1c2029;      /* Bề mặt nâng cấp 3 (--bg-tertiary, pill xám, code inline) */
    --surface-hover: #1a1e27;  /* Bề mặt khi hover chuột (--bg-hover) */

    /* ---- Borders ---- */
    --border: #23272f;         /* Đường viền mặc định (--border-default) */
    --border-soft: #191c23;    /* Đường viền mờ / divider nhẹ (--border-subtle) */
    --border-strong: #2c313b;  /* Đường viền nổi bật / focus / hover (--border-active) */

    /* ---- Typography / 4-Tier Text Ramp ---- */
    --text: #e9ebf0;           /* Chữ chính (--text-primary) - độ tương phản cao nhất */
    --text-dim: #9aa1af;       /* Chữ phụ (--text-secondary) - nhãn, mô tả ngắn */
    --text-faint: #646b7a;     /* Chữ mờ (--text-tertiary) - timestamp, meta, header bảng */
    --text-ghost: #444b58;     /* Chữ rất mờ - placeholder, icon phụ */

    /* ---- Accent Color (Periwinkle Signature & Runtime Variants) ---- */
    --accent: #6d7cff;         /* Màu chủ đạo chính (--accent-primary) */
    --accent-hover: #5a67e8;   /* Màu chủ đạo khi hover */
    --accent-bright: #8b93ff;  /* Màu chủ đạo sáng hơn (icon, active tab, highlight) */
    --accent-dim: #4954cc;     /* Màu chủ đạo tối hơn (border focus, chip border) */
    --accent-bg: rgba(109, 124, 255, 0.13);     /* Lớp phủ mờ accent (active item) */
    --accent-bg-soft: rgba(109, 124, 255, 0.07);/* Lớp phủ rất mờ accent */
    --accent-glow: rgba(109, 124, 255, 0.35);   /* Hiệu ứng phát sáng glow */
    --accent-shadow: rgba(109, 124, 255, 0.3);

    /* ---- Semantic Colors & Washes ---- */
    --green: #3ddc97;          /* Thành công / Đang chạy / Online */
    --green-bg: rgba(61, 220, 151, 0.12);
    --amber: #f5b945;          /* Cảnh báo / Pending / Tạm dừng / Staging */
    --amber-bg: rgba(245, 185, 69, 0.12);
    --red: #fb6f6f;            /* Lỗi / Nguy hiểm / Đã dừng / Failed */
    --red-bg: rgba(251, 111, 111, 0.12);
    --cyan: #49c7f0;           /* Thông tin / RAM / Dev environment */
    --cyan-bg: rgba(73, 199, 240, 0.12);
    --violet: #b07bf5;         /* Tính năng phụ / Bộ lọc / Webhook */
    --violet-bg: rgba(176, 123, 245, 0.12);

    /* ---- Radius Scale ---- */
    --radius-sm: 7px;
    --radius: 10px;
    --radius-lg: 14px;

    /* ---- Font Stacks ---- */
    --sans: "IBM Plex Sans", system-ui, -apple-system, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;

    /* ---- Shadows ---- */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-md: 0 8px 24px -8px rgba(0, 0, 0, 0.55);
    --shadow-lg: 0 20px 48px -12px rgba(0, 0, 0, 0.65);

    /* ---- Code & Terminal ---- */
    --bg-code: #0d1017;
    --text-code: #e2e8f0;

    /* ---- Background Grid Pattern ---- */
    --grid-color: rgba(255, 255, 255, 0.02);

    /* ---- Scrollbars ---- */
    --scrollbar-track: #101218;
    --scrollbar-thumb: #2a2f3a;
    --scrollbar-thumb-hover: #363c49;
}
```

### 2.2 Bảng Tokens Theme Sáng (Light Theme - `[data-theme="light"]`)

```css
[data-theme="light"] {
    --bg-body: #f6f7fb;
    --bg-sidebar: #f1f3f9;
    --surface-0: #f1f3f9;
    --surface: #ffffff;
    --surface-2: #f6f7fb;
    --surface-3: #eef1f7;
    --surface-hover: #eef1f7;

    --border: #e2e6ef;
    --border-soft: #eef1f7;
    --border-strong: #cdd3e0;

    --text: #161a23;
    --text-dim: #515a6b;
    --text-faint: #79818f;
    --text-ghost: #a6adba;

    --accent-bg: rgba(109, 124, 255, 0.10);
    --accent-bg-soft: rgba(109, 124, 255, 0.05);
    --accent-glow: rgba(109, 124, 255, 0.22);

    --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.05);
    --shadow-md: 0 6px 16px -6px rgba(16, 24, 40, 0.12);
    --shadow-lg: 0 16px 40px -12px rgba(16, 24, 40, 0.18);

    --bg-code: #f1f3f9;
    --text-code: #334155;
    --grid-color: rgba(109, 124, 255, 0.06);

    --scrollbar-track: #f1f3f9;
    --scrollbar-thumb: #cdd3e0;
    --scrollbar-thumb-hover: #aab2c2;
}
```

### 2.3 Công Thức Tính Runtime Accent Ramp (JavaScript)
Nếu người dùng đổi mã Accent hex bất kỳ (ví dụ `#00ff88` hay `#3b82f6`), toàn bộ hệ màu phái sinh được tính tự động như sau:
```javascript
function deriveAccentVariants(hex) {
    const { r, g, b } = hexToRgb(hex);
    const darken = (v) => v * 0.88;             // hover
    const dim = (v) => v * 0.70;                // border active
    const bright = (v) => v + (255 - v) * 0.30; // icon & text highlight
    return {
        primary: hex,
        hover: rgbToHex(darken(r), darken(g), darken(b)),
        bright: rgbToHex(bright(r), bright(g), bright(b)),
        dim: rgbToHex(dim(r), dim(g), dim(b)),
        bg: `rgba(${r}, ${g}, ${b}, 0.13)`,
        bgSoft: `rgba(${r}, ${g}, ${b}, 0.07)`,
        glow: `rgba(${r}, ${g}, ${b}, 0.35)`,
        shadow: `rgba(${r}, ${g}, ${b}, 0.3)`,
    };
}
```

---

## 3. Quy Chuẩn Typography & Phông Chữ

1. **Phông Sans (`IBM Plex Sans`):** Dùng cho tiêu đề, nhãn nút bấm, văn bản thông thường.
2. **Phông Monospace (`IBM Plex Mono`):** **BẮT BUỘC** áp dụng cho:
   - Địa chỉ IP, Domain, URL, Path thư mục, Git commit SHA, API keys, Token.
   - Số liệu thống kê, KPI values (kèm `font-variant-numeric: tabular-nums`).
   - Nhãn trạng thái (Pills, State chips, Env tags).
   - Timestamp, thời gian chạy, biểu thức Cron (`*/5 * * * *`).
   - Tiêu đề cột bảng (Table header: `font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--mono);`).
   - Tiêu đề danh mục Sidebar (Nav category: `font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.12em; font-family: var(--mono);`).
3. **Khai báo `@font-face` Cục Bộ:**
```scss
@font-face {
    font-family: 'IBM Plex Sans';
    font-style: normal;
    font-weight: 400 700;
    font-display: swap;
    src: url('/fonts/ibm-plex-sans-400.woff2') format('woff2');
}
@font-face {
    font-family: 'IBM Plex Mono';
    font-style: normal;
    font-weight: 400 700;
    font-display: swap;
    src: url('/fonts/ibm-plex-mono-400.woff2') format('woff2');
}
```

---

## 4. Kiến Trúc Khung Bố Cục (Layout Architecture)

### 4.1 Shell Tổng Thể (`DashboardLayout`)
- **Sidebar:** Chiều rộng cố định `250px` trên desktop (`position: fixed; height: 100vh; background: var(--bg-sidebar); border-right: 1px solid var(--border-soft)`).
  - Có chế độ thu gọn **Compact Rail** (`64px`, `[data-layout="rail"]`), tự động mở rộng khi hover.
  - Trên mobile (`<= 768px`): chuyển thành Off-canvas Drawer trượt từ bên trái với Scrim backdrop (`.sidebar-backdrop`).
- **Main Content:** `margin-left: 250px; padding: 40px; min-height: 100vh;`
  - Mang họa tiết lưới nền kỹ thuật:
    ```css
    background-image:
        linear-gradient(var(--grid-color) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
    background-size: 40px 40px;
    ```
- **Page Shell Standard (`.sk-pageshell` / `.sk-tabgroup`):**
  - Mọi trang chuẩn đều có **PageTopbar** dính sát mép trên cùng (full-bleed), phần nội dung bên dưới có thanh cuộn riêng biệt (`overflow-y: auto`).

### 4.2 Cấu Trúc Giải Phẫu Mẫu Của Một Trang Danh Sách (List Page Anatomy)
Mọi trang danh sách phải tuân thủ đúng thứ tự 5 tầng sau:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PageTopbar (.sk-topbar): [Icon + Title + SubNav Tabs]  [Actions][Search]│
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. ListToolbar (.sk-listhead): [Quick Filters / SegControl]  [Count] [Tools]│
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. SortChipBar (.sk-sortchips) (Chỉ hiện khi có cột đang sort)             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Table Card: DataTable (.sk-dtable) + DataTableFooter (.sk-dtable-footer) │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. Floating BulkBar (.sk-bulkbar) (Chỉ nổi lên khi tick chọn >= 1 hàng)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Quy Tắc Thiết Kế Cho Màn Hình Dạng Console (Console Layouts)
Đối với các công cụ console kỹ thuật như **Database Explorer, File Manager, Terminal, Log Viewer**:
- **KHÔNG ĐƯỢC "Cardify" (không bọc các khung thành các thẻ bo tròn rời rạc bồng bềnh).**
- Phải áp dụng thiết kế **Flush 3-Pane Console**: zero padding viền ngoài, các vùng chia cắt (Tree Rail, Toolbar, Editor, Results Grid, Statusbar) nối liền với nhau bằng viền 1px (`border: 1px solid var(--border-soft)`).

---

## 5. Thư Viện Primitives Chuẩn (Namespace `.sk-*`)

### 5.1 Status Pill (`.sk-pill`)
Huy hiệu trạng thái có chấm tròn phát sáng (glow) và nhãn chữ:
```html
<span class="sk-pill sk-pill--green">
    <span class="sk-pill__dot"></span>
    Running
</span>
```
*Tùy biến tone màu:* `--green`, `--amber`, `--red`, `--cyan`, `--violet`, `--gray`.

### 5.2 State Chip (`.sk-state`)
Nhãn trạng thái vi mô in hoa chữ mono trên nền wash mờ:
```scss
.sk-state {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 6px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;

    &--red    { color: var(--red);    background: var(--red-bg); }
    &--amber  { color: var(--amber);  background: var(--amber-bg); }
    &--green  { color: var(--green);  background: var(--green-bg); }
    &--cyan   { color: var(--cyan);   background: var(--cyan-bg); }
    &--accent { color: var(--accent-bright); background: var(--accent-bg); }
}
```

### 5.3 Env Tag (`.sk-tag`)
Dùng để phân biệt môi trường (PROD / DEV / STAGING):
- `sk-tag--prod`: Viền xanh lá, chữ xanh lá, nền `--green-bg`.
- `sk-tag--staging`: Viền hổ phách, chữ vàng cam, nền `--amber-bg`.
- `sk-tag--dev`: Viền xanh lam cyan, chữ cyan, nền `--cyan-bg`.

### 5.4 Segmented Control (`.sk-seg`)
Thay thế cho thẻ `<select>` thô cứng hoặc filter chips truyền thống:
```html
<div class="sk-seg">
    <button class="sk-seg__btn is-on">All <span class="sk-seg__count">12</span></button>
    <button class="sk-seg__btn">Running <span class="sk-seg__count">9</span></button>
    <button class="sk-seg__btn">Stopped <span class="sk-seg__count">3</span></button>
</div>
```

### 5.5 MetricCard / KPI Tile (`.sk-kpi`)
Thẻ hiển thị chỉ số đo lường với bố cục hàng ngang gọn gàng:
- Grid layout 3 cột: `[Icon chip] [Value + Label] [Trend Indicator]`.
- Dưới cùng có thể kèm SVG Sparkline đồ thị mini.
- Bọc ngoài bằng dải lưới đáp ứng `.sk-kpiband` (tự co giãn từ 4 cột xuống 2 cột/1 cột theo viewport).

### 5.6 Data Table Chuẩn (`.sk-dtable`)
Bảng dữ liệu mật độ cao:
```scss
.sk-dtable {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    thead {
        background: linear-gradient(180deg, var(--surface-2), var(--surface));
        th {
            font-family: var(--mono);
            font-size: 10.5px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--text-faint);
            padding: 11px 16px;
            border-bottom: 1px solid var(--border);
            text-align: left;
        }
    }

    tbody {
        tr {
            transition: background 0.12s;
            &:hover { background: var(--surface-2); }
            &.is-selected { background: var(--accent-bg-soft); }
            &.is-clickable { cursor: pointer; }
        }
        td {
            padding: 13px 16px;
            border-bottom: 1px solid var(--border-soft);
            vertical-align: middle;
        }
    }
}
```

### 5.7 Thanh Thao Tác Hàng Loạt Nổi (`.sk-bulkbar`)
Khi người dùng tick chọn các checkbox trong bảng, thanh này sẽ nổi lên chính giữa đáy màn hình (`bottom: 22px; position: fixed; z-index: 60; border-radius: 999px;`):
- Hiển thị số lượng mục đã chọn.
- Chứa các nút thao tác nhanh (Start, Stop, Delete, Export...).
- Nút "Clear Selection" bên phải.

### 5.8 Hệ Thống Nút Bấm (`.btn`)
- `.btn`: Chiều cao chuẩn `40px`, padding ngang `20px`, `border-radius: 8px`, `font-size: 14px`, `font-weight: 500`.
- `.btn-primary`: Nền gradient chéo `linear-gradient(160deg, var(--accent-bright), var(--accent))`, bóng mờ `box-shadow: 0 4px 14px -4px var(--accent-glow)`.
- `.btn-secondary`: Nền trong suốt, viền `var(--border-strong)`, chữ `var(--text)`.
- `.btn-soft`: Nền `var(--surface-2)`, chữ `var(--text)`.
- `.btn-danger`: Nền `var(--red)`, hover sang đỏ đậm hơn.
- `.btn-ghost`: Nền trong suốt, không viền, hover hiện nền `var(--surface-hover)`.
- `.btn-sm`: Chiều cao `32px`, font `13px`, bán kính `6px`.
- `.btn-icon`: Nút vuông chỉ chứa icon (kích thước `28px` hoặc `32px` cho `.btn-sm`).

### 5.9 Slide-Over Drawer (`.sk-drawer` & `.sk-formdrawer`)
Ngăn kéo trượt ra từ bên phải màn hình thay thế cho Modal khi cần xem chi tiết sâu hoặc form cấu hình nhiều bước:
- Chiều rộng quy chuẩn theo 4 nấc: **380px / 520px / 640px / 720px** (ngoại lệ 1100px cho drawer toàn diện).
- Cấu trúc 3 phần rõ rệt: `sk-drawer__head` (tiêu đề + sub + nút đóng), `sk-drawer__body` (cuộn độc lập), `sk-drawer__foot` (nút Action ghim cố định đáy).

---

## 6. Các Lỗi Thường Gặp & Cảnh Báo Tránh Khi Đưa Sang Dự Án Khác

> [!CAUTION]
> 1. **Tuyệt đối không pha trộn Tailwind Utility với Token SCSS:** Nếu dự án mới có cài Tailwind, tránh dùng các class như `bg-zinc-900` hay `text-gray-400` vì chúng sẽ không đổi màu khi chuyển sang Light Mode.
> 2. **Tránh lỗi vỡ Form Control trong Drawer tối:** Các thẻ `<select>`, `<input type="checkbox">` mặc định của trình duyệt sẽ hiện ô vuông màu trắng lóa trên nền tối nếu không được style qua `.form-field` hoặc `input-base()`.
> 3. **Không hardcode màu chữ:** Luôn dùng `var(--text)`, `var(--text-dim)`, `var(--text-faint)`. Không dùng `#fff` hay `#ccc`.
> 4. **Trật tự Z-Index (Z-Index Hierarchy):**
>    - Dropdowns: `10`
>    - Sticky Headers: `20`
>    - Fixed Elements: `30`
>    - Bulk Bar: `60`
>    - Sidebar Mobile: `1150`
>    - Modal Backdrop: `1140`
>    - Modals & Drawers: `1150`
>    - Tooltips: `1160`
>    - Toasts / Notifications: `9999`
> 5. **Bảo toàn hiển thị số liệu:** Luôn đặt `font-variant-numeric: tabular-nums` và `font-family: var(--mono)` cho các cột số để khi số tăng giảm không làm nhảy chiều rộng của cột.

---

## 7. Checklist Tích Hợp Dự Án Mới (Step-by-Step Migration)

- [ ] **Bước 1: Cài đặt Phông chữ:** Tải file `ibm-plex-sans` và `ibm-plex-mono` dạng `.woff2` đặt vào thư mục `public/fonts/` và khai báo `@font-face` trong CSS gốc.
- [ ] **Bước 2: Cài đặt File Tokens:** Copy file `_theme-variables.scss` và `_variables.scss` vào dự án. Đảm bảo `:root` và `[data-theme="light"]` được import đầu tiên.
- [ ] **Bước 3: Cài đặt Mixins & Base SCSS:** Copy `_mixins.scss`, `base/_reset.scss`, `base/_typography.scss`, `base/_utilities.scss`.
- [ ] **Bước 4: Cài đặt Primitives:** Copy `styles/components/_design-system.scss`, `_buttons.scss`, `_cards.scss`, `_forms.scss`, `_modals.scss`, `_tables.scss`.
- [ ] **Bước 5: Thiết lập ThemeProvider:** Tạo React Context quản lý `theme` (`'dark'` | `'light'` | `'system'`) và gán thuộc tính `data-theme` vào thẻ `<html>` hoặc `document.documentElement`.
- [ ] **Bước 6: Khởi tạo Shell:** Áp dụng `Sidebar`, `DashboardLayout`, và `PageTopbar` cho các màn hình chính.

