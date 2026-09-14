# MikroTik Hotspot Admin Dashboard

Trang **Dashboard quản trị user** cho **WiFi Hotspot của MikroTik** (RouterOS 7.x), dùng **REST API thường** (endpoint `/rest`).

- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4 + React Router 7
- **Backend**: Node.js (Express 5) làm **proxy** chuyển tiếp tới MikroTik REST API
- **UI**: **ServerKit Design System** — Chuẩn kiến trúc **Infra Console Architecture** (Dark-First `#0a0b0e`, hỗ trợ Light `#f6f7fb` & System theme, phông chữ **IBM Plex Sans** & **IBM Plex Mono**, technical background grid, hệ thống Primitives `.sk-*`), xem `DESIGN_SYSTEM_RULES.md`

> ⚠️ Vì sao cần backend proxy?
> MikroTik REST API **không gửi header CORS** nên trình duyệt không thể gọi trực tiếp. Backend làm trung gian để:
> 1. Thêm header CORS cho frontend.
> 2. Giữ mật khẩu router ở phía server (không lộ ra trình duyệt).

> 📌 **QUY TẮC PHÁT TRIỂN & PHÊ DUYỆT TÁC VỤ (AI AGENT & WORKFLOW RULES):**
> 1. **Cập nhật tài liệu bắt buộc**: Mỗi khi hoàn thành hoặc sửa đổi bất kỳ tính năng, cấu hình, trang màn hình hay API nào, **BẮT BUỘC cập nhật chi tiết vào `README.md`** (cập nhật Cấu trúc thư mục, Checklist và thêm mục mới trong `Nhật ký phiên làm việc`) để các phiên tiếp theo luôn nắm bắt chính xác tiến độ.
> 2. **Tự động phê duyệt tác vụ cần thiết ("Allow this time" / Auto-approval)**: Tự động cho phép và thực thi các thao tác phát triển thông thường (đọc/tìm kiếm code, chỉnh sửa nội dung, tạo file mới, build, chạy test, chạy server, kiểm tra git) mà không cần chờ đợi thủ công.
> 3. ⚠️ **QUY TẮC AN TOÀN TUYỆT ĐỐI KHI XÓA FILE (FILE DELETION SAFETY POLICY)**:
>    - **NGHIÊM CẤM** tự động phê duyệt hoặc tự ý xóa bất kỳ tệp tin/thư mục mã nguồn, cấu hình, tài nguyên hay dữ liệu nào của dự án nếu **chưa có sự xác nhận/phê duyệt trực tiếp từ người dùng**.
>    - **NGOẠI LỆ DUY NHẤT**: Chỉ được phép tự động xóa các file tạm do chính AI tự viết phục vụ mục đích kiểm thử UI hoặc kiểm thử Backend (ví dụ: các file scratch test, temporary mock test trong `scripts/`).
> 4. 🛡️ **QUY TẮC BẢO TOÀN LOGIC & PHÒNG CHỐNG HỒI QUY (ZERO-REGRESSION & IMPACT ANALYSIS POLICY)**:
>    - **BẮT BUỘC** suy nghĩ, rà soát và phân tích kỹ lưỡng các luồng dữ liệu (Data flow), chữ ký hàm (Function signature), kiểu dữ liệu trả về và trạng thái (State) trước khi sửa đổi bất kỳ đoạn code nào.
>    - Tuyệt đối **KHÔNG** làm ảnh hưởng (breaking changes/side effects) đến các tính năng, luồng logic cũ đã hoạt động ổn định và thành công trước đó.
>    - Luôn chạy kiểm thử (`npm run build`, API test scripts) và kiểm tra tương thích ngược sau mỗi lần chỉnh sửa.

---

## 🚀 Cách chạy nhanh

### Lần đầu (cài dependency)

```bash
npm run setup
```

### Chế độ 1 — Phát triển với MOCK router (không cần router thật)

```bash
npm run dev:mock     # terminal 1: server giả lập MikroTik (port 4000)
npm run dev:backend  # terminal 2: backend proxy (port 3000)
npm run dev:frontend # terminal 3: Vite (port 5173) -> mở http://localhost:5173
```

Hoặc chạy 1 lệnh (dùng concurrently):

```bash
npm run dev          # mock + backend + frontend
npm run dev:all      # nếu muốn đủ 3 service
```

> Mẹo Windows: có thể dùng script `scripts/start-servers.ps1` để chạy nền
> và `scripts/stop-servers.ps1` để tắt (xem phần cuối README).

### Chế độ 2 — Kết nối router thật

1. Bật REST API trên MikroTik (xem [Cấu hình MikroTik](#cấu-hình-mikrotik-routeros-7)).
2. Sửa file `backend/.env` (tham khảo `backend/.env.example`):

   ```env
   MTIK_SCHEME=http
   MTIK_HOST=192.168.88.1
   MTIK_PORT=80
   MTIK_USER=admin
   MTIK_PASS=password_cua_ban
   PORT=3000
   ```

3. Chạy:

   ```bash
   npm run dev:backend  # terminal 1
   npm run dev:frontend # terminal 2
   ```

---

## 🧱 Kiến trúc

```
Trình duyệt (React:5173)
   │  /api/*  (Vite proxy -> backend:3000)
   ▼
Backend proxy (Express:3000)  — giữ Basic Auth (admin:pass)
   │  /rest/* (MikroTik REST API, HTTP Basic Auth)
   ▼
MikroTik RouterOS 7  (không CORS)   HOẶC   mock-router (localhost:4000)
```

---

## 📁 Cấu trúc thư mục

```
wifi_hostpost_web/
├── backend/                     # Proxy API
│   ├── server.js                # Express proxy -> MikroTik /rest + Proxmox API
│   ├── mock-router.js           # Giả lập MikroTik REST API (RAM) để dev
│   ├── mock-proxmox.js          # Giả lập Proxmox VE 8.x Hypervisor & Live Metrics (RAM)
│   ├── package.json
│   ├── .env                     # Cấu hình router (KHÔNG commit)
│   └── .env.example             # Mẫu cấu hình
├── frontend/                    # React 19 + Vite 8
│   ├── public/
│   │   └── fonts/               # Chứa 66 file phông .woff2 tự lưu trữ (IBM Plex Sans & Mono)
│   └── src/
│       ├── main.jsx / App.jsx   # Entry + Router (Protected routes) + ThemeProvider
│       ├── context/ThemeContext.jsx # Quản lý Dark / Light / System Theme runtime
│       ├── fonts.css            # Khai báo @font-face local trỏ vào /fonts/*.woff2
│       ├── index.css            # ServerKit Tokens, Primitives, CSS Custom Properties
│       ├── api/client.js        # Gọi backend /api (MikroTik + Proxmox)
│       ├── pages/
│       │   ├── SystemPerformancePage.jsx  # Giám sát hiệu năng RouterOS (CPU, RAM, Traffic, Interfaces)
│       │   ├── ProxmoxPerformancePage.jsx # Giám sát & Quản trị Proxmox VE (Node, KVM, LXC, ZFS, Bridges)
│       │   ├── DashboardPage.jsx          # Tổng quan Hotspot: KPI, phân bố profile, phiên gần đây
│       │   ├── UsersPage.jsx              # Quản trị người dùng hotspot & hồ sơ (BulkBar, in thẻ, CSV)
│       │   ├── ProfilesPage.jsx           # Quản trị hồ sơ gói cước hotspot
│       │   ├── SessionsPage.jsx           # Phiên active + nút Ngắt kết nối
│       │   ├── SettingsPage.jsx           # Cài đặt hệ thống, tài khoản /user, mẫu in voucher, backup .rsc
│       │   └── LoginPage.jsx              # Đăng nhập quản trị viên Infra Console
│       ├── components/          # Layout (250px sidebar), ConnectionStatus, Modal, Spinner, StatCard, CustomSelect
│       ├── hooks/               # useApi, useAuth, useEventSource, useToast
│       └── utils/format.js      # Định dạng thời lượng / dung lượng
├── scripts/
│   ├── start-servers.ps1        # Chạy mock+backend+vite nền trên Windows
│   ├── stop-servers.ps1         # Tắt mọi node process
│   ├── test-api.mjs             # Script test CRUD + kick qua backend
│   └── test-format.mjs          # Test hàm format thời lượng/dung lượng
├── package.json                 # Scripts gộp (setup/dev/build/...)
└── .gitignore
```

---

## 📬 API endpoints (backend proxy `:3000`)

| Method | Endpoint           | Target / Mô tả                                      |
|--------|--------------------|-----------------------------------------------------|
| GET    | `/api/health`      | Kiểm tra proxy + cấu hình                           |
| GET    | `/api/stats`       | Thống kê tổng quan Hotspot                          |
| GET    | `/api/performance/system` | Số liệu tài nguyên RouterOS (CPU, RAM, HDD, Nhiệt độ) |
| GET    | `/api/proxmox/summary`    | Tóm tắt hiệu năng Node, VMs, LXCs, ZFS, Bridges    |
| GET    | `/api/proxmox/events`     | Server-Sent Events (SSE) phát metrics Proxmox real-time |
| POST   | `/api/proxmox/guests/:type/:vmid/action` | Thao tác bật (start) / tắt (stop) / reboot máy ảo/LXC |
| GET    | `/api/users`       | Danh sách người dùng Hotspot                        |
| POST   | `/api/users`       | Tạo user Hotspot mới                                |
| PUT    | `/api/users/:id`   | Sửa user Hotspot                                    |
| DELETE | `/api/users/:id`   | Xóa user Hotspot                                    |
| GET    | `/api/profiles`    | Danh sách profile gói cước Hotspot                  |
| GET    | `/api/active`      | Phiên đang hoạt động Hotspot                        |
| DELETE | `/api/active/:id`  | Ngắt phiên (kick)                                   |
---

## ⚙️ Cấu hình MikroTik (RouterOS 7)

REST API có sẵn từ **RouterOS 7**, cần bật dịch vụ:

```bash
# Terminal / Winbox trên router:
/ip/service set www disabled=no
/ip/service set www-ssl disabled=no
```

Kiểm tra nhanh bằng trình duyệt/curl:

```bash
curl -u admin:matkhau http://192.168.88.1/rest/ip/hotspot/user
```

> 🔐 Khuyến nghị: tạo **user riêng** chỉ để quản trị hotspot (thay vì dùng `admin`):
> ```bash
> /user add name=hotspot-admin group=full password=matkhau-manh
> ```

---

## 📝 Nhật ký phiên làm việc

> Ghi lại các thay đổi để **phiên sau tiếp tục** từ đây.

### Phiên 1 (2026-09-04) — Khởi tạo toàn bộ dự án

**Đã tạo mới:**

1. **Backend** (`backend/`)
   - `server.js` — Express 5 proxy: mọi `/api/*` chuyển tới `MTIK_*` qua REST `/rest` với Basic Auth; tự sanitize payload (bỏ field rỗng, boolean → `"true"/"false"`); xử lý lỗi → JSON.
   - `mock-router.js` — Giả lập REST MikroTik với dữ liệu mẫu (4 user, 3 profile, 3 phiên active) lưu trong RAM; có CRUD giống thật.
   - `.env` (cấu hình mặc định trỏ vào mock `localhost:4000`) + `.env.example` (mẫu cho router thật).

2. **Frontend** (`frontend/`)
   - Vite 8 + React 19 + Tailwind 4 (`@tailwindcss/vite`), React Router 7.
   - `vite.config.js` proxy `/api` → `localhost:3000`.
   - 3 trang:
     - **Tổng quan** (`/`): 4 thẻ số liệu (user, active, profile, router), biểu đồ phân bố theo profile, bảng phiên gần đây. Tự refresh 15s.
     - **Người dùng** (`/users`): bảng CRUD, tìm kiếm, lọc theo profile, modal tạo/sửa, xác nhận xóa.
     - **Phiên hoạt động** (`/sessions`): bảng active, nút **Ngắt** (kick), tự refresh 15s.
   - `hooks/useApi.js`, `components/*`, `utils/format.js`.

3. **Scripts** (`scripts/`)
   - `start-servers.ps1` / `stop-servers.ps1` — chạy/tắt 3 service nền trên Windows.
   - `test-api.mjs`, `test-format.mjs` — test nhanh CRUD + format.

4. **package.json gốc** — scripts gộp: `setup`, `dev:mock`, `dev:backend`, `dev:frontend`, `dev`, `dev:all`, `build`, `start`.

**Đã sửa trong quá trình test:**

- `UsersPage.jsx`: lỗi JSX do comment `{/* */}` ngay sau `) : (` (parser hiểu nhầm) → bỏ comment; thiếu dấu `}` đóng ternary → thêm.
- `SessionsPage.jsx`: thiếu `useState` import → thêm.
- `useApi.js`: `useState(null)` → `useState(undefined)` để default `[]` hoạt động (tránh crash `profiles.map` trang Users).
- `utils/format.js`: bổ sung parse dạng `1d`, `2w`, `1w2d` (trước đó chỉ hiểu `HH:MM:SS`); hiển thị gọn gàng hơn (bỏ "0s" thừa).
- `.gitignore`: thêm `*.log`, `*.err.log`.

**Kết quả kiểm thử (đã chạy thành công):**
- `npm install` + `npm run build` ✔
- Backend proxy + mock: CRUD user (POST/PUT/DELETE), kick active, stats — tất cả trả về đúng JSON ✔
- Trình duyệt (localhost:5173): cả 3 trang render đúng dữ liệu; tạo user qua giao diện thành công; console sạch (chỉ 1 warning accessibility về `name` của form field — không ảnh hưởng chức năng) ✔

### Phiên 2 (2026-09-04) — Chuyển toàn bộ UI sang Neon Glass Light (theo `DESIGN.md`)

**Đã thay đổi:**

1. **Font & HTML** (`frontend/index.html`)
   - Load Google Font **Space Grotesk** (400/500/600/700) làm font chính cho toàn app.

2. **Design system** (`frontend/src/index.css`)
   - Dùng Tailwind `@theme` để định nghĩa token: `vapor` (#F4F6FA nền Luminous Void), `ink`/`ink-soft`/`ink-faint`, neon `primary` (#00A896 Cyan), `secondary` (#D946EF Magenta), `tertiary` (#7C3AED Violet), `warning` (#D97706 Amber), `danger` (#E11D48).
   - **Ambient orbs**: 3 khối gradient blur cyan/magenta/violet cố định sau nền.
   - **Glass** (Level 1): `rgba(255,255,255,0.65)` + `backdrop-filter: blur(20px)`, viền trắng sáng góc trên-trái + tối nhạt góc dưới-phải (`inset box-shadow`), bóng `0 8px 32px rbga(15,23,42,0.06)`.
   - **Glass-glow** (Level 2): hover/focus → viền cyan + `0 0 20px rgba(0,168,150,0.25)` + dịch nhẹ lên.
   - **Shimmer**: dải sáng `linear-gradient` quét chéo qua kính mỗi 5.5s.
   - **Buttons**: `.btn-primary` (gradient cyan + glow hover), `.btn-ghost` (kính trong suốt), `.btn-danger` (gradient đỏ).
   - **Inputs**: `.input-ghost` (ghost-box blur) & `.input-underline` (gạch chân **lan từ giữa ra 2 bên** + phát sáng cyan khi focus).
   - `.label-caps` (12px/700/0.1em), `.data-display`, `.glass-table`, `.neon-dot`, scrollbar kính mờ.

3. **Components**
   - `Layout.jsx`: navigation rail kính mờ, icon **SVG line-art** (dashboard/users/sessions/router), active = **thanh neon 3px** bên trái + nền `bg-primary/15`, trạng thái "REST API đã kết nối" với chấm neon.
   - `StatCard.jsx`: glass card + shimmer, accent gradient theo 4 màu neon (`cyan/magenta/violet/amber`).
   - `Modal.jsx`: kính mờ, backdrop `bg-ink/40` + `backdrop-blur-md`.
   - `Spinner.jsx`: vòng xoay neon cyan phát sáng.

4. **Pages** (đổi toàn bộ class màu slate/sky/emerald → hệ Neon Glass)
   - `DashboardPage.jsx`: header "Tổng quan." với chấm cyan, thẻ số liệu neon, thanh phân bố profile nhiều màu neon, bảng phiên gần đây (bytes-in cyan / bytes-out magenta).
   - `UsersPage.jsx`: search box ghost + icon kính lúp, select có mũi tên custom, badge trạng thái với **chấm neon** (hoạt động cyan / khóa đỏ), profile badge violet, toggle **Glass Toggle** giảm dùng cho "Vô hiệu hóa".
   - `SessionsPage.jsx`: bảng glass + shimmer, mỗi phiên có chấm neon trạng thái online, nút Ngắt dạng `.btn-danger`.

**Lỗi đã sửa khi implement:**
- `DashboardPage.jsx`: khi chia file làm 2 phần, fragment `</>` và phần JSX bị đặt sai vị trí (phân bố profile nằm **ngoài** component) → hợp nhất lại trong cùng ternary.
- `index.css`: khi chèn khối "Buttons/Inputs" bằng `insert_line`, khối CSS bị cắt ngang **giữa block `.shimmer::after`** (thiếu `}` đóng) → các `.btn-*`/`.input-*` bị Lightning CSS bỏ. Đã đóng block đúng chỗ, dọn 4 dòng thừa.

**Kết quả kiểm thử (phiên 2):**
- `npm run build` ✔ (CSS 18KB → 33.5KB với toàn bộ neon/glass).
- Script `scripts/check-css.mjs` (đã xóa) + `scripts/verify-ui.mjs`: xác nhận `.btn-primary`, `.input-ghost`, `.input-underline`, `.neon-dot`, `.orb-cyan`, `.glass-glow`, `.label-caps` đều có trong dev-server CSS (43KB) và production build.
- `grep` toàn bộ source: **không còn** class cũ (`text-slate-*`, `bg-sky-*`, `bg-red-*`, `inputCls`...) ✔
- API vẫn hoạt động qua proxy (users=4, active=3) ✔
- ⚠️ Chrome DevTools MCP không kết nối được trong phiên này nên chưa screenshot — đã sửa ở phiên 3.

### Phiên 3 (2026-09-04) — Sửa MCP + Xác nhận trực quan toàn bộ giao diện

**Đã sửa Chrome DevTools MCP ("Not connected"):**
- Tạo `scripts/start-browser.ps1` — tìm Chrome/Edge trên máy, khởi động với `--remote-debugging-port=9222 --user-data-dir=%TEMP%\chrome-debug-profile`.
- Chạy Chrome với port 9222, kiểm tra `netstat` thấy LISTENING.
- Phát hiện: `chrome-devtools-mcp` là server **stdio** — chạy CLI độc lập sẽ `Shutting down (stdin end)`, bắt buộc host (VS Code/Cline) spawn.
- Tạo **`.mcp.json`** ở gốc workspace cấu hình đúng:
  ```json
  { "mcpServers": { "chrome-devtools": { "command": "npx",
      "args": ["-y","chrome-devtools-mcp@latest","--browserUrl","http://127.0.0.1:9222","--no-usage-statistics"],
      "type": "stdio" } } }
  ```
- Sau khi Reload Window, MCP kết nối thành công.

**Xác nhận trực quan qua browser (đã chụp snapshot/screenshot):**
- **`/` Tổng quan** ✔ — sidebar mới (Hotspot Admin / MIKROTIK · ROUTEROS 7 / "REST API đã kết nối"), header "Tổng quan.", 4 StatCard neon, phân bố profile, bảng phiên (bytes-in cyan / bytes-out magenta).
- **`/users` Người dùng** ✔ — bảng glass, search ghost, filter profile, badge "Hoạt động"/"Tạm khóa", modal "Thêm người dùng" form glass + toggle Vô hiệu hóa mở đúng.
- **`/sessions` Phiên hoạt động** ✔ — bảng glass + shimmer + chấm neon, 3 phiên render đúng.
- **Kick (Ngắt)**: gọi `DELETE /api/active/:id` → HTTP 200 cho `khach1`, danh sách còn 2 phiên ✔.
- **Console**: không có lỗi nào ✔.

### Phiên 4 (2026-09-04) — Đổi màu Primary từ Electric Cyan → Neon Blue

**Yêu cầu**: đổi toàn bộ màu primary hiện tại sang blue neon.

**Bảng màu mới (Neon Blue):**
| Token | Cũ (Cyan) | Mới (Blue) |
|---|---|---|
| `--color-primary` | `#00a896` | **`#0084ff`** |
| `--color-primary-deep` | `#005b4f` | `#004a9e` |
| `--color-primary-soft` | `#ccfbf1` | `#cfe8ff` |
| Gradient nút/logo | `#00a896 → #00b8a9` | `#0084ff → #00a2ff` |
| Glow rgba | `rgba(0,168,150,x)` | `rgba(0,132,255,x)` |
| StatCard cyan accent `to-` | `#2dd4bf` | `#7cc4ff` |

**Đã chỉnh sửa:**
- `frontend/src/index.css` — token @theme + toàn bộ effects: orb-cyan, glass-glow hover, `.btn-primary/.btn-ghost/.btn-danger`, `.input-ghost:focus`, `.input-underline`, `.glass-table tr:hover`, `.neon-text/.neon-dot`, scrollbar-hover (đều chuyển `0,168,150 → 0,132,255`).
- `components/Layout.jsx` — logo gradient `to-[#00a2ff]` + shadow blue; thanh neon active `rgba(0,132,255,0.9)`.
- `components/StatCard.jsx` — accent `cyan: to-[#7cc4ff]`.
- `components/Spinner.jsx` — glow blue.
- `pages/DashboardPage.jsx` — glow thanh phân bố profile blue.
- `pages/UsersPage.jsx` — notice glow + toggle `peer-checked` glow blue.
- `frontend/index.html` — thêm **favicon SVG blue neon** (data URI) → dọn lỗi 404 favicon trên console.
- `DESIGN.md` — cập nhật token primary sang Neon Blue (đồng bộ tài liệu).

**Kiểm thử (phiên 4):**
- `npm run build` ✔.
- Script kiểm tra CSS build: chỉ còn `#0084ff...` (dạng hex-alpha `#0084ff26/73/80/e6...`), **không còn** `rgba(0,168,150)` / `#00a896` / `#2dd4bf` ✔.
- Browser computed style: `--color-primary=#0084ff`, logo gradient `rgb(0,132,255)→rgb(0,162,255)`, thanh neon & chấm neon `rgb(0,132,255)`, badge "Hoạt động" `#cfe8ff/#004a9e`, nút primary gradient blue, bytes-in blue ✔.
- Console sau khi thêm favicon: **sạch, không lỗi 404** ✔.

---
### Phiên 5 (2026-09-06) — Kết nối router thật + Toàn bộ tính năng mới

**Router thật cấu hình vào `backend/.env`:**
- `MTIK_HOST=192.168.20.1`, `MTIK_USER=user_api`, `MTIK_PASS=mat_khau_router_cua_ban`
- RouterOS **7.20.7 (long-term)**, board hEX, user `user_api` group **full**
- Lưu bản mock thành `backend/.env.mock` để bật/tắt nhanh

**Khám phá quan trọng trên router thật (đã test):**
- RouterOS 7.20 REST: **POST tạo item → "no such command"**; phải **`PUT` zbiorczy (không có id)** → 201, hoặc `POST .../add`.
- Cập nhật item yêu cầu **`name` trong body PUT** ("failure: user name is required" nếu thiếu).
- `reset-counters-by-id` không khả dụng qua REST version này → backend fallback: PUT `{name, disabled:false}` (mở khóa lại).
- Đã chỉnh `server.js` + `mock-router.js` tương ứng.

**Tính năng mới (backend + frontend):**

1. **Đăng nhập dashboard** (`/login`) — `POST /api/auth/login` (so ADMIN_USER/ADMIN_PASS trong `.env`, mặc định `admin/mikrotik2026`), token server-side; `useAuth` + localStorage; `Protected` route; nút **Thoát** sidebar; 401 → tự đăng xuất.
2. **Trang Hồ sơ (Profile)** `/profiles` — CRUD: tên, rate-limit, shared-users, idle/keepalive/mac-cookie timeout, address-list, add-mac-cookie; không xóa profile `default`.
3. **Xuất CSV** (download `hotspot-users-YYYY-MM-DD.csv`).
4. **In thẻ WiFi** — cửa sổ mới + CSS print, mỗi thẻ: SSID WIFI_HOTSPOT, user, pass, giới hạn.
5. **Gia hạn** (`/users/:id/extend`) — modal nhanh 1h/4h/1d/3d/7d/30d hoặc nhập tùy chỉnh; backend cộng `limit-uptime`.
6. **Reset** (`/users/:id/reset`) — thử reset-counters, fallback mở khóa.
7. **Dashboard realtime (SSE)** — `/api/events` mỗi 5s; hook `useEventSource` (dùng fetch để gửi header auth); thay poll cho stats.

**File mới / đổi:**
- Backend: `server.js` (auth, profiles CRUD, extend/reset, SSE, serve `frontend/dist` 1 port, time helpers), `.env.mock`, `.env.example`.
- Frontend: `LoginPage.jsx`, `ProfilesPage.jsx`, `useAuth.jsx`, `useEventSource.jsx`; `App.jsx`, `main.jsx`, `client.js`, `Layout.jsx`, `DashboardPage.jsx`, `UsersPage.jsx` (thêm tính năng + fix accessibility), `vite.config.js` (proxy không timeout).
- `package.json` — `production` script. Scripts mới: `test-auth.mjs`, `test-new-features.mjs`, `test-sse.mjs`, `cdp-test.mjs`, `start-prod.ps1`, `start-backend.ps1`, `start-app.ps1`.

**Kết quả test trên router thật:**
- API: login ✔ → tạo user 201 ✔ → gia hạn 1h→2h ✔ → reset ✔ → tạo/sửa/xóa profile ✔ → **không để lại data test** (verify cuối: users=[default-trial,khach], profiles=[default,khach]).
- Production `localhost:3000`: serve HTML + login render ✔.
- CDP navigate `/profiles` (bảng 2 profile) + `/users` (nút `+ Gia hạn/↺ Reset/Sửa/Xóa` + `Xuất CSV/In thẻ WiFi/Thêm người dùng`) + modal Gia hạn mở đúng ✔.
- SSE: `text/event-stream`, 2 frame trong 10s ✔.

## 🧭 Việc cần làm / Ý tưởng tiếp theo

- [x] **Chuyển toàn bộ UI sang Neon Glass Light** theo `DESIGN.md` (phiên 2).
- [x] **Kiểm tra trực quan** giao diện neon glass trên trình duyệt (phiên 3 — đã xác nhận cả 3 trang + kick + console sạch).
- [x] **Đổi màu Primary sang Neon Blue** `#0084FF` (phiên 4 — đã xác nhận bằng build + computed style).
- [x] **Test với router MikroTik thật** `192.168.20.1` (phiên 5 — đã connect + test CRUD thật, RouterOS 7.20.7).
- [x] **Xác thực đăng nhập cho dashboard** (phiên 5 — `/login`, token server-side).
- [x] **Thêm trang quản lý profile** (phiên 5 — CRUD `/ip/hotspot/user/profile`).
- [x] **Xuất danh sách user ra CSV / in thẻ WiFi** (phiên 5).
- [x] **Gia hạn thời gian / reset dung lượng** cho 1 user nhanh (phiên 5).
- [x] **Dashboard realtime** (phiên 5 — SSE `/api/events`, hook `useEventSource`).
- [x] **Đóng gói chạy production** trên 1 port (phiên 5 — backend serve `frontend/dist`).
- [x] Fix warning accessibility: thêm `id`/`name` cho input form (phiên 5).
- [x] **Trạng thái REST API phản ánh kết nối thực tế với router** (phiên 6 — `/api/health` ping router + `ConnectionStatus` sidebar poll 10s, hiển thị host + latency hoặc lý do mất kết nối).
- [x] **Kiểm tra tự động toàn bộ dashboard trên trình duyệt thật bằng Chrome DevTools MCP** (phiên 7 — login, snapshot/screenshot, tương tác CRUD, ping router).
- [x] **Thêm trang Cài đặt (Settings) ở sidebar phía dưới** (phiên 7 — kết nối Router, lệnh WinBox CLI, mẫu in thẻ WiFi, bảo mật, thông tin hệ thống).
- [ ] **Đổi password ADMIN mặc định** (`admin/mikrotik2026`) trước khi đưa vào sử dụng thật.
- [ ] **Tạo mã voucher / user hàng loạt theo lô** (Batch voucher generation).
- [ ] Ý tưởng: lịch sử đăng nhập / nhật ký thao tác audit log, thông báo user sắp hết hạn.

---

### Phiên 6 (2026-09-06) — Trạng thái REST API phản ánh kết nối thực tế

**Yêu cầu**: "REST API đã kết nối" trước đây hiển thị cố định → cập nhật theo trạng thái thực tế với router.

**Đã làm:**

1. **Backend** (`backend/server.js`) — `/api/health` giờ **chủ động ping router**:
   - Gọi `GET /ip/hotspot/user` (timeout 10s) mỗi lần health được hỏi.
   - Trả về: `connected`, `latencyMs`, `error` (lý do nếu không kết nối được) cùng cấu hình `mikrotik`.
   - Nếu chưa cấu hình `MTIK_USER/PASS` → `connected:false`, error hướng dẫn.

2. **Frontend** — component mới `components/ConnectionStatus.jsx`:
   - Poll `/api/health` mỗi **10s** (qua `api.health()` — tự gửi token, tự đăng xuất nếu 401).
   - 3 trạng thái:
     - `Đang kiểm tra kết nối…` (lần đầu, chấm xám pulse).
     - `REST API đã kết nối` + **host · latencyMs** (chấm neon xanh, nền primary-soft).
     - `Mất kết nối MikroTik` + lý do (chấm neon đỏ, nền danger-soft).
   - Dùng chung trong sidebar (`Layout.jsx` thay block cố định trước đây).

**Scripts hỗ trợ (giữ lại cho phiên sau):**
- `scripts/test-health.mjs` — health online/offline (dùng `OFFLINE_BASE=http://localhost:3002` để test offline).
- `scripts/cdp-conn-check.mjs` — verify text sidebar qua CDP (biến `CDP_MIK`).
- `scripts/start-offline-backend.ps1` — chạy backend port 3002 + host chết (`127.0.0.1:9`) để giả lập mất kết nối.

**Kiểm thử:**
- `npm run build` ✔.
- Health online (router thật `192.168.20.1`): `connected:true`, `latencyMs:~180`, UI sidebar hiển thị `REST API đã kết nối · 192.168.20.1 · 19ms` ✔ (CDP).
- Health offline (host `127.0.0.1:9`): `connected:false`, `error:"Không thể kết nối MikroTik (127.0.0.1): fetch failed"`, UI sidebar hiển thị `Mất kết nối MikroTik` + lý do ✔ (CDP).

**Lưu ý**: latency mỗi lần hiển thị có thể khác nhau (phụ thuộc mạng tới router); trạng thái tự cập nhật mỗi 10s.

---

### Phiên 7 (2026-09-07) — Thêm trang Cài đặt (Settings) & Kiểm thử tự động bằng Chrome DevTools MCP

**Yêu cầu**: Thêm trang Cài đặt ở menu sidebar phía dưới và tự động kiểm thử qua MCP.

**Đã làm:**
1. **Trang Cài đặt mới** (`frontend/src/pages/SettingsPage.jsx`):
   - **Kết nối Router:** Hiển thị IP Host, REST Base URL, tài khoản REST API, trạng thái kết nối + Latency (ms) và nút "Kiểm tra kết nối router".
   - **Mẫu lệnh WinBox CLI:** Cung cấp sẵn kịch bản lệnh RouterOS 7 bật REST API và tạo user API riêng với nút "Sao chép".
   - **Mẫu in thẻ WiFi (Vouchers):** Tùy chỉnh Tên cơ sở, Tên sóng WiFi (SSID), Hotline hỗ trợ, Lời chào chân trang (lưu trong `localStorage`).
   - **Bảo mật & Quản trị:** Hiển thị tài khoản quản trị hiện tại và hướng dẫn đổi mật khẩu trong `backend/.env`.
   - **Thông tin hệ thống:** Hiển thị phiên bản React 19, Vite 8, Express 5, chuẩn RouterOS 7.x REST API.
2. **Cập nhật Điều hướng & Bố cục Sidebar** (`frontend/src/components/Layout.jsx` + `frontend/src/App.jsx`):
   - Thêm icon SVG Line-Art `settings` (bánh răng).
   - Thêm route `/settings`.
   - **Vị trí nút "Cài đặt":** Đặt ở khối chân trang sidebar phía dưới, nằm ngay phía trên khối trạng thái "REST API đã kết nối" và nút Thoát.
3. **Kiểm thử tự động bằng Chrome DevTools MCP**:
   - Khởi động background servers và Chrome remote debugging port `9222`.
   - MCP tự động login vào dashboard, điều hướng qua `/`, `/users`, `/profiles`, `/sessions`, `/settings`.
   - Kiểm tra tương tác: mở/đóng modal Thêm người dùng, ping router, snapshot & screenshot UI.

---

### Phiên 8 (2026-09-07) — Triển khai Phân quyền Tài khoản Dashboard (RBAC 3 Cấp độ)

**Yêu cầu**: Phân quyền người dùng đăng nhập Dashboard.

**Đã làm:**
1. **Mô hình Phân quyền (RBAC)**:
   - **`admin` (Quản trị viên / Toàn quyền)**: Quản trị toàn bộ router, CRUD Hotspot User, CRUD Profile, Cài đặt và quản lý CRUD danh sách tài khoản dashboard.
   - **`operator` (Nhân viên / Lễ tân / Vận hành)**: Tạo user hotspot cấp cho khách, gia hạn thời gian, in thẻ voucher WiFi, mở khóa user, ngắt phiên. Chặn sửa/xóa profile và cài đặt hệ thống.
   - **`viewer` (Giám sát viên / Chỉ xem)**: Chế độ chỉ đọc cho Dashboard, Users, Profiles, Sessions. Ẩn mọi nút tạo, sửa, xóa, gia hạn, ngắt kết nối.
2. **Backend**:
   - Tạo `backend/data/dashboard-users.json` lưu trữ danh sách tài khoản.
   - Viết middleware `requireRole(['admin', 'operator'])` bảo vệ tất cả endpoint mutating.
   - Thêm bộ API `/api/admin/users` (chỉ dành cho `admin`) để Quản lý tài khoản (Thêm/Sửa/Đổi pass/Xóa).
   - Thêm endpoint `/api/auth/me`.
3. **Frontend**:
   - Cập nhật `useAuth.jsx` cung cấp các cờ quyền `isAdmin`, `isOperator`, `isViewer`, `canManageUsers`, `canManageProfiles`, `canEditSettings`.
   - `Layout.jsx`: Hiển thị Họ tên + Badge vai trò với màu Neon tương ứng (`Admin`: Blue, `Nhân viên`: Amber, `Giám sát`: Violet).
   - `UsersPage.jsx`, `ProfilesPage.jsx`, `SessionsPage.jsx`: Tự động ẩn/hiển thị nút thao tác theo vai trò.
   - `SettingsPage.jsx`: Bổ sung bảng quản lý tài khoản dashboard và modal thêm/sửa tài khoản cho `admin`.
4. **Kiểm thử**:
   - Viết `scripts/test-rbac.mjs` kiểm tra bảo vệ API backend 100% Pass.
   - Dùng Chrome DevTools MCP kiểm tra trực quan giao diện thực tế của cả 3 tài khoản: `admin`, `nhanvien`, `giamstat`.

---

### Phiên 10 (2026-09-07) — Chuyển đổi Xác thực & Phân quyền trực tiếp theo MikroTik RouterOS (/user)
1. **Kiến trúc Xác thực Đăng nhập Mới (`POST /api/auth/login`)**:
   - Xác thực trực tiếp với MikroTik RouterOS qua HTTP Basic Auth tới endpoint `/rest/user`.
   - Tự động đọc và ánh xạ nhóm quyền RouterOS (`group`) sang quyền hạn Dashboard:
     - 👑 **`full`** $\rightarrow$ **Quản trị viên (`admin`)**: Toàn quyền cấu hình router, quản lý tài khoản, profile và hotspot users.
     - ✍️ **`write`** $\rightarrow$ **Nhân viên vận hành (`operator`)**: Cấp voucher hotspot, gia hạn thời gian, reset dung lượng, in thẻ, ngắt phiên.
     - 👁️ **`read`** $\rightarrow$ **Giám sát viên (`viewer`)**: Chế độ chỉ xem toàn bộ dữ liệu thống kê.
   - **Loại bỏ hoàn toàn tài khoản cục bộ trong `.env`**: Không còn dùng các biến `ADMIN_USER` / `ADMIN_PASS`. Toàn bộ quá trình đăng nhập và phân quyền được kiểm tra trực tiếp, bảo mật 100% qua RouterOS.
2. **Quản lý Tài khoản Hệ thống trên RouterOS (`/api/admin/users`)**:
   - Toàn bộ thao tác Thêm / Sửa / Đổi mật khẩu / Xóa tài khoản trên giao diện Cài đặt (`/settings`) được gửi trực tiếp tới bảng `/user` của MikroTik.
3. **Cập nhật Giao diện**:
   - Sidebar (`Layout.jsx`): Hiển thị tên tài khoản kèm nhóm quyền MikroTik tương ứng (`Quản trị (full)`, `Nhân viên (write)`, `Giám sát (read)`).
   - Trang Cài đặt (`SettingsPage.jsx`): Bảng quản lý và modal tạo/sửa tài khoản chuyển sang lựa chọn trực tiếp nhóm quyền MikroTik (`full`, `write`, `read`).
4. **Kiểm thử**:
   - Cập nhật script `scripts/test-rbac.mjs` kiểm thử toàn bộ luồng tạo user `full`, `write`, `read` trên router, kiểm tra quyền từng vai trò và dọn dẹp sau khi test (100% Pass).
   - Xác nhận trực quan qua Chrome DevTools MCP.

---

### Phiên 11 (2026-09-07) — Thiết lập Cơ chế Bảo vệ Tài khoản Quản trị Cao nhất (`group: full`)
1. **Bảo vệ Tài khoản Quản trị Toàn quyền (Group `full`)**:
   - **Backend API (`DELETE /api/admin/users/:id`)**: Trước khi xóa, truy vấn danh sách `/user` trên MikroTik. Nếu tài khoản mục tiêu thuộc nhóm quyền `full`, backend từ chối yêu cầu và phản hồi mã lỗi `HTTP 400 Bad Request: "Không thể xóa tài khoản thuộc nhóm quyền quản trị cao nhất (full)."`.
   - **Frontend UI (`SettingsPage.jsx`)**:
     - Ẩn hoàn toàn nút "Xóa" đối với bất kỳ tài khoản nào thuộc nhóm `full`, chỉ để lại nút "Sửa / Đổi mật khẩu".
     - Trong hàm `handleDeleteUser`, tích hợp kiểm tra kép chặn thao tác nếu tài khoản có `group === 'full'` hoặc `role === 'admin'`.
2. **Sửa lỗi Lớp phủ Kính mờ chặn Click chuột (`index.css`)**:
   - Khắc phục thuộc tính `.shimmer::after` thiếu `pointer-events: none`, khiến lớp hiệu ứng ánh sáng kính mờ phủ đè lên toàn bộ khung thẻ đăng nhập và chặn mọi thao tác nhấp chuột/focus vào các ô nhập tài khoản, mật khẩu.
3. **Sửa lỗi Endpoint Kiểm tra Trạng thái (`/api/health`)**:
   - Khắc phục lỗi `ReferenceError: AUTH_ENABLED is not defined` sau khi gỡ bỏ biến môi trường cũ trong `server.js`.
4. **Kiểm thử Tự động (100% Pass)**:
   - Cập nhật script `scripts/test-rbac.mjs` với kịch bản kiểm tra an toàn: Thử gửi request xóa tài khoản nhóm `full` $\rightarrow$ hệ thống trả về chính xác HTTP 400.

---

### Phiên 12 (2026-09-07) — Xây dựng Hệ thống Toast Notification Toàn diện (Neon Glassmorphism)
1. **Kiến trúc Toast Provider (`useToast.jsx`)**:
   - Xây dựng Context + Hook `useToast()` hỗ trợ 4 kiểu thông báo: `success` (Xanh Neon), `error` (Đỏ Hồng Neon), `warning` (Vàng Cam Neon), `info` (Tím Neon).
   - Thiết kế chuẩn **Neon Glass Light**: khung kính mờ `backdrop-blur-2xl`, hiệu ứng phát sáng đa sắc, tự động biến mất sau 3.5s và có nút đóng nhanh `✕`.
   - Vị trí hiển thị: Góc trên bên phải (`fixed top-4 right-4 z-[9999]`), hỗ trợ xếp tầng mượt mà khi có nhiều sự kiện liên tiếp.
2. **Tích hợp Toast vào tất cả Action trên toàn bộ hệ thống**:
   - **Đăng nhập (`LoginPage.jsx`)**: Thông báo chào mừng người dùng kèm vai trò khi thành công; báo lỗi chi tiết khi sai mật khẩu.
   - **Người dùng (`UsersPage.jsx`)**: Bật popup khi Thêm, Sửa, Xóa user, Gia hạn thời gian, Reset bộ đếm dung lượng, Xuất CSV, v.v.
   - **Hồ sơ (`ProfilesPage.jsx`)**: Bật popup khi Thêm, Cập nhật, Xóa Profile.
   - **Phiên hoạt động (`SessionsPage.jsx`)**: Bật popup khi Ngắt phiên kết nối (Kick) người dùng thành công/thất bại.
   - **Cài đặt (`SettingsPage.jsx`)**: Bật popup khi Kiểm tra kết nối router, Lưu mẫu in thẻ voucher WiFi, Khôi phục mặc định, Thêm/Sửa/Xóa tài khoản MikroTik RouterOS, Sao chép script CLI.
3. **Hiệu ứng Con trỏ Chuột Bàn tay (`cursor: pointer`)**:
   - Thiết lập toàn cục trong `index.css`: Toàn bộ `button`, `[role="button"]`, `select`, `input[type="checkbox/radio"]`, `a` và các nút chức năng đều hiển thị con trỏ bàn tay (`pointer`) khi di chuột vào, và chuyển sang `not-allowed` khi bị vô hiệu hóa (`disabled`).

---

### Phiên 13 (2026-09-07) — Nâng cấp Tính năng In Thẻ WiFi: Chọn User trước khi in
1. **Cơ chế Chọn Người dùng (Checkbox Selection)**:
   - Thêm cột Checkbox chọn từng dòng và Checkbox "Chọn tất cả" / "Bỏ chọn" ở đầu bảng người dùng (`UsersPage.jsx`).
   - Dòng được chọn tự động đổi màu nền kính xanh Neon làm nổi bật (`bg-primary-soft/30`).
2. **Thanh công cụ & Nút In Thẻ Thông minh**:
   - Nút **"In thẻ WiFi"** ở thanh tiêu đề tự động cập nhật số lượng: `In thẻ WiFi (X)` và sáng màu Neon khi đã chọn ít nhất 1 người dùng.
   - Nếu chưa chọn user nào mà bấm in, hệ thống sẽ bật cảnh báo Toast: *"Vui lòng tích chọn ít nhất 1 người dùng trong bảng trước khi in thẻ!"*.
   - Hiển thị thanh trạng thái nổi: `Đã chọn X người dùng` kèm nút `🖨️ In X thẻ ngay` và `Bỏ chọn`.
   - Bổ sung nút **`🖨️ In thẻ`** riêng trên từng dòng để in nhanh 1 thẻ bất kỳ mà không cần tích chọn.

---

---

### Phiên 15 (2026-09-07) — Bổ sung Tài khoản & Mật khẩu vào Mẫu in thẻ WiFi (Voucher) và Live Preview
1. **Mở rộng Cấu hình Mẫu in thẻ WiFi (`voucher`)**:
   - Thêm các trường dữ liệu mới vào `settings.json` và API:
     - `sampleUser`: Tài khoản mẫu hiển thị trên thẻ in (VD: `khach_vip88`).
     - `samplePassword`: Mật khẩu mẫu hiển thị trên thẻ in (VD: `88889999`).
     - `loginUrl`: Địa chỉ trang đăng nhập Captive Portal Hotspot (VD: `http://192.168.20.1`).
2. **Giao diện Cài đặt Mẫu in thẻ & Xem trước Trực quan (`SettingsPage.jsx`)**:
   - Mở rộng Section 2 thành layout 2 cột linh hoạt:
     - Cột trái: Form nhập đầy đủ (Tên cơ sở, Tên WiFi SSID, Trang đăng nhập, Tài khoản mẫu, Mật khẩu mẫu, Hotline, Lời chào).
     - Cột phải: **Khung Xem trước thẻ in thực tế (Live Card Preview)** mô phỏng trực quan chuẩn thẻ vật lý với khối thông tin tài khoản và mật khẩu in to đậm nổi bật.
   - Bổ sung nút **`🖨️ In thử 1 thẻ mẫu`** cho phép xem và in thử mẫu thẻ ngay lập tức.
---

### Phiên 18 (2026-09-07) — Kiểm tra & Chuẩn hóa Phân định Lưu trữ: Router MikroTik vs. File JSON Local
1. **Dữ liệu & Cài đặt Đồng bộ Trực tiếp vào Router MikroTik (RouterOS 7 REST API)**:
   - **Tài khoản Hệ thống MikroTik (`/user`)**: Thêm, sửa, đổi mật khẩu, phân nhóm quyền (`full`/`write`/`read`), xóa tài khoản -> Lưu và thực thi **trực tiếp 100% trên RouterOS** qua REST API.
   - **Người dùng Hotspot (`/ip/hotspot/user`)**: Tạo mới, batch tạo voucher, sửa, xóa, gia hạn thời gian, reset bộ đếm -> Lưu và thực thi **trực tiếp 100% trên RouterOS**.
   - **Hồ sơ Hotspot (`/ip/hotspot/user/profile`)**: Tốc độ `rate-limit`, `shared-users`, `mac-cookie` -> Lưu và thực thi **trực tiếp 100% trên RouterOS**.
   - **Phiên hoạt động (`/ip/hotspot/active`)**: Ngắt kết nối (Kick) -> Xử lý **trực tiếp trên RouterOS**.
2. **Cài đặt Local / Dashboard (Lưu vào File JSON Máy chủ)**:
   - **Mẫu in thẻ WiFi (Voucher Template)**: Tên địa điểm, SSID, Link đăng nhập, User/Pass mẫu, Hotline, Lời chào chân trang -> Lưu tập trung vào **`backend/data/settings.json`**.
   - **Tham số Dashboard**: Chủ đề giao diện (`theme`), chu kỳ làm mới (`refreshIntervalSeconds`) -> Lưu tập trung vào **`backend/data/settings.json`**.
3. **Dọn dẹp tệp tin thừa**:
   - Đã xóa tệp cũ không còn dùng `backend/data/dashboard-users.json` (do hệ thống đã chuyển toàn bộ sang xác thực trực tiếp MikroTik `/user`).

---

### Phiên 19 (2026-09-07) — Dropdown Chọn Tài khoản Hotspot từ Router & Tự động Điền Mật khẩu vào Mẫu in thẻ
1. **Dropdown Danh sách Tài khoản RouterOS (`SettingsPage.jsx`)**:
   - Tự động gọi `api.users()` nạp danh sách người dùng Hotspot đang có trên MikroTik Router (`/ip/hotspot/user`).
   - Tích hợp menu dropdown `<select>` hiển thị danh sách tài khoản kèm mật khẩu, gói cước profile và ghi chú.
   - Nút **`⟳ Làm mới danh sách`** để đồng bộ lại danh sách user từ router bất kỳ lúc nào.
2. **Tự động Điền Mật khẩu (Auto-fill Password)**:
   - Khi người dùng chọn bất kỳ tài khoản nào từ dropdown, hệ thống sẽ khớp chính xác theo cả `name` và `.id` RouterOS, tự động trích xuất mật khẩu thực tế và điền ngay tức thì vào 2 ô `👤 Tên tài khoản` và `🔑 Mật khẩu (Tự động điền)`.
   - Hiển thị Toast thông báo xác nhận: `Đã tự động điền tài khoản "<user>" (Mật khẩu: <pass>)`.
   - Cập nhật thời gian thực vào **Khung Xem trước thẻ in (Live Card Preview)** và tự động đồng bộ vào file [`backend/data/settings.json`](file:///d:/mikrotik/wifi_hostpost_web/backend/data/settings.json).

---

### Phiên 20 (2026-09-07) — Tự động Lấy Thời hạn, Dung lượng & Gói cước theo Tài khoản Được Chọn
1. **Trích xuất Thời hạn & Dung lượng Động**:
   - Khi chọn tài khoản trong danh sách Router, hệ thống tự động trích xuất `limit-uptime` (thời hạn) và `limit-bytes-total` (dung lượng) của tài khoản đó.
   - Định dạng chuẩn thân thiện qua `formatDuration` (vd: `2 ngày 4 giờ`, `30 phút`) và `formatBytes` (vd: `5 GB`, `500 MB`, `Không giới hạn`).
2. **Hiển thị Trực quan & Đồng bộ In Thử**:
   - Thêm khối tóm tắt thông số ngay dưới ô chọn tài khoản trên form Cài đặt: `⏱️ Thời hạn sử dụng`, `📊 Dung lượng giới hạn`, `📦 Gói hồ sơ (Profile)`.
   - Cập nhật dòng Thời hạn và Dung lượng trong **Khung Xem trước thẻ in thực tế (Live Card Preview)** và mẫu in thử nghiệm `printSampleCard()` theo đúng thông số của user đã chọn.

### Phiên 21 (2026-09-07) — Sắp xếp lại Bố cục Trang Cài đặt Hệ thống
1. **Di chuyển vị trí khối "Mẫu in thẻ WiFi Voucher"**:
   - Đưa toàn bộ khối **Mẫu in thẻ WiFi Voucher & Tài khoản / Mật khẩu** lên vị trí ưu tiên, nằm ngay sau khối **Quản lý Tài khoản Hệ thống MikroTik (/user)**.
   - Giúp người quản trị dễ dàng quan sát, cấu hình mẫu in thẻ và xem trước trực quan ngay dưới phần tài khoản mà không phải cuộn sâu xuống cuối trang.
2. **Cân đối Bố cục Grid**:
   - Khối Kết nối Router MikroTik, Bảo mật & Tài khoản hiện tại, và Thông tin Hệ thống được gom thành cụm thông tin hạ tầng ở phía dưới gọn gàng và rõ ràng.

### Phiên 22 (2026-09-07) — Xây dựng Trang Real-Time System Performance Dashboard
1. **Trang Giám sát Hiệu năng RouterOS theo Thời gian thực (`SystemPerformancePage.jsx`)**:
   - Vị trí trên cùng (đầu tiên) trong thanh menu điều hướng (`/performance`).
   - Hàng KPI Gauge Neon: CPU Load (%), RAM Usage (%), Lưu lượng Băng thông Tức thời (Download/Upload Mbps), Nhiệt độ CPU (°C), Điện áp nguồn (V), Ổ cứng Flash HDD và Bad blocks.
   - **Biểu đồ Real-time Vector SVG**: Đồ thị sóng thời gian thực cho Tải CPU & RAM, Đồ thị Băng thông mạng Download (Rx) / Upload (Tx) 30 giây gần nhất.
   - **Bảng Giám sát Chi tiết Toàn bộ Interface Mạng**: Thống kê tốc độ Rx/Tx từng card mạng, tổng lưu lượng Bytes, số gói Packets, Tỷ lệ Drop/Errors và trạng thái Up/Down.
   - Bảng thông tin phần cứng RouterBOARD, Serial Number, Firmware RouterOS.
   - Bộ điều khiển tần suất realtime: 1s, 1.5s, 3s và nút Tạm dừng / Tiếp tục live stream.
2. **Backend Proxy & Real-Time SSE Stream (`server.js` & `mock-router.js`)**:
   - Tích hợp endpoint REST `/api/system/performance` trích xuất đồng thời `/system/resource`, `/system/routerboard`, `/system/health`, `/interface`.
   - Tính toán tốc độ mạng tức thời Rx/Tx Rate bps dựa trên delta byte giữa các lần đo.
   - Tích hợp luồng Server-Sent Events (SSE) `/api/system/performance/events` đẩy dữ liệu stream liên tục cho frontend.
### Phiên 23 (2026-09-07) — Tính năng Sao lưu & Xuất Cấu hình Router (Backup & Export)
1. **Hỗ trợ Đầy đủ 2 Phương thức Sao lưu RouterOS**:
   - **📄 Xuất Tập lệnh Cấu hình (.rsc - Khuyên dùng)**:
     - Xuất toàn bộ lệnh cấu hình RouterOS dạng văn bản CLI (`/export`).
     - Tùy chọn: `show-sensitive` (mật khẩu WiFi, Hotspot, PPPoE) và `compact` (chỉ cấu hình tùy biến).
     - **Tự động tải về máy tính cá nhân**: Trình duyệt kích hoạt hộp thoại tải file `.rsc` để người dùng chọn thư mục lưu trên máy tính.
     - **Xem trước trực tiếp (Live Code Preview)**: Modal xem toàn bộ script cấu hình trên nền tối màu cú pháp kèm nút sao chép mã.
   - **📦 Bản sao lưu Nhị phân Toàn diện (.backup)**:
     - Tạo snapshot toàn bộ hệ sinh thái RouterOS (`/system/backup/save`).
     - Tùy chọn mật khẩu mã hóa hoặc không mã hóa (`dont-encrypt`).
     - Lưu trữ an toàn trên bộ nhớ Router để khôi phục nhanh.
2. **Quản lý & Tải về Bản sao lưu trên Router**:
   - Bảng danh sách các file `.backup` và `.rsc` có sẵn trên bộ nhớ Router.
   - Thống kê dung lượng, ngày tạo, nút tải về máy tính, nút xem nội dung và nút xóa bản sao lưu cũ.
### Phiên 24 (2026-09-07) — Hỗ trợ Tải Trực tiếp File Nhị phân .backup về Máy tính
1. **Tích hợp Tải File Nhị phân (.backup) qua FTP Stream**:
   - Backend Proxy tích hợp `basic-ftp` kết nối cổng FTP 21 của RouterOS để trích xuất file `.backup` nguyên bản từng byte.
   - Endpoint `GET /api/router/backups/download/:filename` stream file nhị phân với header `Content-Disposition: attachment`.
2. **Trải nghiệm Tải về Đồng nhất trên Giao diện**:
   - Cả 2 dạng **`.rsc`** và **`.backup`** đều hỗ trợ **Tự động tải về máy tính cá nhân ngay khi bấm Tạo**.
   - Nút **`⬇️ Tải về`** trong danh sách file cho phép tải bất kỳ file nào (`.backup` hoặc `.rsc`) về máy tính của người dùng chỉ với 1 click.

### Phiên 25 (2026-09-09) — Thiết lập Quy tắc Phê duyệt Tác vụ & Bảo vệ An toàn Tệp tin Dự án
1. **Quy tắc Tự động Phê duyệt ("Allow this time" / Auto-approval)**:
   - Tự động hóa các thao tác thông thường (đọc/tìm kiếm, chỉnh sửa code, tạo mới file, build, chạy test, chạy server, kiểm tra git) nhằm tối ưu tốc độ và trải nghiệm phát triển.
2. **Quy tắc Bảo vệ Tuyệt đối khi Xóa File (Strict File Deletion Protection)**:
   - Nghiêm cấm mọi hành vi tự động duyệt hoặc tự ý xóa bất kỳ file mã nguồn, tài nguyên, cấu hình nào của dự án nếu chưa có phê duyệt trực tiếp của người dùng.
   - Ngoại lệ duy nhất được phép tự dọn dẹp: các file tạm do chính AI tạo ra để kiểm thử UI hoặc Backend.

### Phiên 26 (2026-09-09) — Chuẩn hóa Kích thước Inline Spinner & Tối ưu Nút Bấm Đang Xử lý Sao lưu Router
1. **Khắc phục lỗi chiều cao nút bấm (Button Height Overflow)**:
   - Nguyên nhân: Component `Spinner` trước đó mặc định có padding `py-12` và kích thước `h-10 w-10`, khi đặt trong nút bấm làm đội chiều cao nút lên quá lớn (> 130px).
   - Giải pháp: Nâng cấp [`Spinner.jsx`](file:///d:/mikrotik/wifi_hostpost_web/frontend/src/components/Spinner.jsx) hỗ trợ các kích thước inline `size="sm"` (16px) và `size="xs"` (14px) với viền quay mượt mà, không kèm padding lớn.
2. **Tối ưu Giao diện Nút Sao lưu & Tải về (`SettingsPage.jsx`)**:
   - Căn giữa nội dung chuẩn xác (`justify-center`), giữ nguyên kích thước chiều cao chuẩn của nút khi ở trạng thái đang xử lý sao lưu RouterOS.

### Phiên 27 (2026-09-09) — Tích hợp Trực tiếp Quản lý Hồ sơ (Profiles) vào Trang Người Dùng
1. **Thanh Chuyển đổi Tab Tiện Lợi (`UsersPage.jsx`)**:
   - Tab **👥 Tài khoản Người dùng** (kèm badge số lượng user): Toàn bộ bảng quản lý, xuất CSV, in thẻ voucher, gia hạn, reset counter, tìm kiếm và lọc profile.
   - Tab **⚡ Hồ sơ Gói cước (Profiles)** (kèm badge số lượng profile): Quản lý `/ip/hotspot/user/profile`, xem chi tiết giới hạn tốc độ `rate-limit`, `shared-users`, timeout, MAC cookie.
2. **Thống kê User Đang Dùng Mỗi Profile**:
   - Bảng Profile tự động đếm và hiển thị số lượng người dùng đang gán từng profile (vd: `👥 3 users`).
   - Click vào số user sẽ tự động chuyển sang tab Người dùng và áp dụng bộ lọc profile tương ứng tức thì.
3. **Liên kết Nhanh Khi Tạo / Sửa Người Dùng**:
   - Nút **`+ Tạo hồ sơ mới`** đặt ngay cạnh nhãn chọn Profile trong modal tạo/sửa người dùng, tự động chọn profile mới tạo sau khi lưu thành công mà không phải rời trang.
   - Nút **`⚡ Quản lý hồ sơ`** đặt ngay cạnh thanh lọc Profile của bảng người dùng để chuyển tab nhanh chóng.
4. **Modal CRUD Profile An Toàn**:
   - Thêm/sửa cấu hình Profile đầy đủ các trường RouterOS.
   - Modal xác nhận xóa cảnh báo chi tiết nếu đang có tài khoản người dùng hoạt động thuộc hồ sơ đó.

### Phiên 28 (2026-09-09) — Chuẩn hóa & Nâng cấp Toàn diện Giao diện Dropdown List (CustomSelect)
1. **Xây dựng Component `CustomSelect.jsx` (Neon Glass Light Dropdown)**:
   - Thay thế toàn bộ thẻ `<select>` mặc định của trình duyệt (vốn bị vuông góc, viền thô và nền hệ điều hành xanh đậm).
   - Thiết kế popover kính mờ `backdrop-blur-2xl`, bo tròn `rounded-2xl`, hiệu ứng đổ bóng Neon Blue `shadow-[0_16px_40px_rgba(0,132,255,0.18)]`, mũi tên chevron xoay hoạt họa mượt mà.
   - Hỗ trợ Icon đại diện, Subtitle/Ghi chú phụ, Badge đếm số lượng người dùng/gói cước, Checkmark `✓` đánh dấu lựa chọn hiện tại.
   - Tự động đóng popover khi nhấp chuột ra ngoài (click outside) và hỗ trợ điều hướng phím (Escape, Enter).
2. **Áp dụng Đồng bộ Toàn Hệ thống**:
   - **Trang Người dùng (`UsersPage.jsx`)**:
     - Dropdown Lọc Profile: Hiển thị tên gói cước kèm badge số lượng user thực tế (`👥 X users`).
     - Dropdown Chọn Profile trong Modal Thêm/Sửa User: Hiển thị thông số tốc độ `rate-limit` và nhãn `default`.
   - **Trang Cài đặt (`SettingsPage.jsx`)**:
     - Dropdown Chọn Tài khoản Router điền mẫu in thẻ: Hiển thị icon `👤`, tên tài khoản, mật khẩu kèm badge gói cước.
     - Dropdown Phân nhóm quyền Hệ thống (`admin-user-group`): Hiển thị icon `👑`/`✍️`/`👁️`, quyền chi tiết và badge phân quyền rõ ràng.

### Phiên 31 (2026-09-14) — Tái Thiết Kế Toàn Bộ Giao Diện Theo Chuẩn ServerKit Design System (Infra Console Architecture)
1. **Chuyển Đổi Hệ Thống CSS Tokens & Theme (`DESIGN_SYSTEM_RULES.md`)**:
   - Áp dụng chuẩn **Dark-First** (`#0a0b0e`) hỗ trợ đồng thời **Light Theme** (`#f6f7fb`) & **System Theme**.
   - Tích hợp `ThemeProvider` (`frontend/src/context/ThemeContext.jsx`) lưu lựa chọn vào `localStorage`, gán runtime attribute `data-theme` lên thẻ `<html>`.
   - Cài đặt bộ phông chuẩn kỹ thuật tự lưu trữ (Self-hosted 100% offline/air-gapped): Tải toàn bộ 66 file `.woff2` vào `frontend/public/fonts/` và khai báo qua `frontend/src/fonts.css` cho **IBM Plex Sans** (giao diện chung) và **IBM Plex Mono** (IP, Domain, Uptime, Bytes, Port, KPI, Table headers).
   - Thiết lập họa tiết lưới nền kỹ thuật 40x40px (`.bg-grid`).
2. **Hệ Thống Primitives Chuẩn ServerKit (`.sk-*`)**:
   - Status Pill (`.sk-pill`, `.sk-pill__dot` với các biến thể `--green`, `--amber`, `--red`, `--cyan`, `--violet`).
   - State Chip (`.sk-state`) & Env Tag (`.sk-tag`).
   - Segmented Control (`.sk-seg`, `.sk-seg__btn`, `.sk-seg__count`).
   - MetricCard / KPI Tile (`.sk-kpi`, `.sk-kpiband`) kèm font mono tabular-nums.
   - Data Table chuẩn (`.sk-dtable`) với thead gradient, border 1px tinh tế và hover state mượt mà.
   - Floating BulkBar (`.sk-bulkbar`) nổi lên ở đáy màn hình khi tick chọn nhiều người dùng.
   - Button System (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-soft`, `.btn-danger`, `.btn-ghost`, `.btn-sm`, `.btn-icon`).
3. **Tái Cấu Trúc Toàn Bộ Components & Màn Hình Nghiệp Vụ**:
   - **`Layout.jsx`**: Sidebar 250px cố định, viền mờ `var(--border-soft)`, brand logo, RouterOS badge, phân nhóm điều hướng rõ ràng, Theme toggle Sáng/Tối, Connection status và mobile off-canvas drawer.
   - **`DashboardPage.jsx`**: Topbar với SSE Live indicator, KPI Band 4 cột, phân bố người dùng theo profile và bảng phiên hoạt động gần đây.
   - **`SystemPerformancePage.jsx`**: Đồng bộ thời gian thực chu kỳ linh hoạt (1s/1.5s/3s), 4 thẻ Gauges (CPU, RAM, Bandwidth, Flash), 2 đồ thị SVG Real-time Area/Line, bảng Interface Traffic Monitor và thông số RouterBOARD.
   - **`ProxmoxPerformancePage.jsx`**: Topbar hypervisor, 6 KPI gauges, 2 đồ thị sóng SVG, bảng KVM/LXC với segmented filter và action buttons (Start, Stop, Reboot), Storage pools và Linux Bridges.
   - **`UsersPage.jsx`**: Segmented tab chuyển đổi linh hoạt giữa Người dùng và Hồ sơ, bảng `.sk-dtable` với checkbox, thanh `.sk-bulkbar` nổi đáy màn hình, In thẻ WiFi voucher, xuất CSV, modal CRUD an toàn.
   - **`ProfilesPage.jsx`**: Quản lý gói cước `/ip/hotspot/user/profile`, hiển thị rate-limit, shared-users, mac-cookie.
   - **`SessionsPage.jsx`**: Bảng phiên active, IP/MAC/Uptime/Bytes dạng mono, ngắt kết nối an toàn.
   - **`SettingsPage.jsx`**: Quản lý tài khoản hệ thống `/user`, mẫu in thẻ WiFi voucher kèm live preview card, quản lý sao lưu và xuất file script `.rsc` / `.backup` kèm modal xem trước code, lệnh CLI WinBox.
   - **`LoginPage.jsx`**: Màn hình đăng nhập phong cách Infra Console với background technical grid, form focus accent glow.
   - **`CustomSelect.jsx`**, **`Modal.jsx`**, **`useToast.jsx`**, **`Spinner.jsx`**, **`StatCard.jsx`**, **`ConnectionStatus.jsx`**: Đồng bộ 100% tokens mới.
4. **Bảo Toàn 100% Logic Nghiệp Vụ & Kiểm Thử**:
   - Tuyệt đối không thay đổi logic API, xác thực, SSE streams, CRUD hay print engine.
   - Build production frontend (`npm run build`) thành công 100% không phát sinh lỗi.

### Phiên 32 (2026-09-14) — Tích Hợp Giám Sát Hạ Tầng Home Assistant OS (HassOS)
1. **Kiến Trúc Tích Hợp Đa Chế Độ (Real API + Mock Fallback)**:
   - **Backend Mock Engine (`backend/mock-hass.js`)**: Mô phỏng chân thực hệ thống Home Assistant OS 12.4, Supervisor Engine, Core 2026.4, 4 Cores CPU kèm nhiệt độ (°C), RAM 8GB, ổ cứng NVMe 128GB, lưu lượng mạng Rx/Tx và 9 Add-on containers phổ biến (`Mosquitto`, `Zigbee2MQTT`, `Node-RED`, `Tailscale`, `ESPHome`, `Cloudflared`, `Samba`, `File Editor`, `InfluxDB`).
   - **Chuyển đổi liền mạch khi có hệ thống thật**: Backend tự động phát hiện biến môi trường `HASS_URL` (ví dụ: `http://192.168.20.10:8123`) và `HASS_TOKEN` (Long-Lived Access Token) trong `.env`. Nếu có, backend kết nối trực tiếp đến Home Assistant Core REST API (`/api/config`, `/api/states`, `/api/hassio/info`) để lấy dữ liệu thực tế; nếu chưa có, tự động dùng mock engine.
   - **Endpoints REST & SSE**:
     - `GET /api/hass/summary`: Trả về snapshot chỉ số tổng thể của HassOS.
     - `GET /api/hass/events`: Luồng Server-Sent Events (SSE) đẩy dữ liệu tài nguyên thời gian thực chu kỳ 1.5s.
     - `POST /api/hass/addons/:slug/action`: Bật, tắt, khởi động lại từng Add-on (`start`, `stop`, `restart`).
     - `POST /api/hass/core/action`: Khởi động lại Core, khởi động lại Supervisor, Reboot HassOS Host, nạp lại Automations.
2. **Giao Diện Giám Sát Chuẩn ServerKit (`frontend/src/pages/HassPerformancePage.jsx`)**:
   - **Topbar**: Live indicator `MOCK SUPERVISOR` / `REAL HOST`, bộ chọn chu kỳ cập nhật (1s / 1.5s / 3s), nút Pause/Resume và nút tắt mở trực tiếp giao diện Web của Home Assistant (`🌐 Mở HA Web`).
   - **4 Thẻ KPI Tài Nguyên Phần Cứng**:
     - CPU Usage (%) kèm số core, nhiệt độ (°C), kiến trúc (aarch64/x86_64) và đồ thị SVG real-time.
     - Bộ nhớ RAM (Used / Total / Free) kèm đồ thị SVG.
     - Lưu trữ NVMe (Used / Total / Free) kèm thanh tiến trình trực quan.
     - Lưu lượng mạng trực tiếp (Download / Upload Kbps) kèm đồ thị sóng.
   - **Khối Thông Tin Host & Supervisor**: Hiển thị chi tiết phiên bản OS, Core, Supervisor, Board phần cứng, IP/Port, Uptime và thống kê số lượng Thực thể IoT theo domain (`sensor`, `switch`, `light`, `binary_sensor`, `automation`, `climate`).
   - **Bảng Quản Trị Add-on Containers**:
     - Bộ lọc Tab: Tất cả, Đang chạy (Running), Đã dừng (Stopped).
     - Ô tìm kiếm Add-on theo tên / slug / danh mục.
     - Bảng mật độ cao `.sk-dtable` hiển thị trạng thái (`.sk-pill`), phiên bản, mức tiêu thụ CPU, RAM, Port mapping và các nút thao tác nhanh (Chạy, Dừng, Khởi động lại).
   - **Khối Thao Tác Quản Trị Nhanh (Quick Actions)**: Gửi lệnh Restart Core, Restart Supervisor, Reload Automations và Reboot Host kèm modal xác nhận an toàn.
3. **Điều Hướng & Định Tuyến**:
   - Thêm icon ngôi nhà / server `hass` và menu item "Home Assistant OS" vào nhóm "GIÁM SÁT HẠ TẦNG" trong `Layout.jsx`.
   - Đăng ký route `/hass` trong `App.jsx` và tích hợp hàm gọi API trong `frontend/src/api/client.js`.
4. **Kiểm Thử**:
   - `npm run build` thành công 100% (dist bundle JS & CSS sạch sẽ).
   - Kiểm thử tương tác qua Chrome DevTools MCP: Đăng nhập `user_api`, mở trang `/hass`, nhận luồng SSE, chuyển đổi chu kỳ, kiểm tra bảng Add-ons và thực hiện lệnh dừng/chạy Add-on thành công.

### Phiên 33 (2026-09-14) — Bổ Sung Giám Sát Chi Tiết Tất Cả Thiết Bị Kết Nối Router (Hotspot Hosts & DHCP Leases)
1. **Kiến Trúc Tích Hợp Đa Nguồn Thiết Bị RouterOS**:
   - **Endpoint Kết Nối Mới**:
     - `GET /api/hosts`: Lấy danh sách thiết bị kết nối vào sóng WiFi/LAN từ `/ip/hotspot/host` kết hợp tên thiết bị thực tế (`host-name`) từ DHCP leases.
     - `DELETE /api/hosts/:id`: Xóa thiết bị khỏi bảng Hotspot Host.
     - `GET /api/dhcp/leases`: Lấy danh sách toàn bộ bản ghi cấp phát IP từ DHCP Server (`/ip/dhcp-server/lease`).
     - `DELETE /api/dhcp/leases/:id`: Thu hồi địa chỉ IP đã cấp cho thiết bị.
   - **Mock Engine & Router Thật**: Cập nhật cả `mock-router.js` và proxy `server.js` hỗ trợ đầy đủ các trường thông tin kỹ thuật (`macAddress`, `ipAddress`, `hostName`, `bridgePort`, `uptime`, `idleTime`, `bytesIn`, `bytesOut`, `status`, `expiresAfter`, `dynamic`).
2. **Nâng Cấp Giao Diện Trang Phiên Hoạt Động (`frontend/src/pages/SessionsPage.jsx`)**:
   - **Segmented Tab Switcher (`.sk-seg`)**: Cho phép chuyển đổi mượt mà giữa 3 chế độ xem:
     - **⚡ Phiên Đăng Nhập (`/ip/hotspot/active`)**: Các thiết bị đã xác thực và có phiên Internet.
     - **📱 Thiết Bị Kết Nối Router (`/ip/hotspot/host`)**: Tất cả các máy đang bắt WiFi hoặc cắm dây LAN (cả chưa login, đã login và Bypass MAC).
     - **🌐 Cấp Phát DHCP (`/ip/dhcp-server/lease`)**: Xem toàn bộ thiết bị đã nhận IP từ DHCP Server, tên máy (`host-name`), kiểu cấp phát (Dynamic/Static) và thời gian hết hạn (`expires-after`).
   - **Ô Tìm Kiếm Đa Năng**: Tìm kiếm theo Tên máy, IP, MAC Address hoặc Server.
   - **Định Dạng Chuẩn ServerKit**: Bảng `.sk-dtable`, Status Pills (`.sk-pill.sk-pill--green`, `.sk-pill.sk-pill--amber`, `.sk-pill.sk-pill--cyan`), nút Thu hồi IP và Ngắt phiên an toàn.
3. **Kiểm Thử**:
   - Xác thực dữ liệu thực tế từ Router MikroTik `192.168.20.1`: Hiển thị chính xác 2 thiết bị `MTDD` đang nhận IP DHCP (`192.168.30.252` và `192.168.20.254`).
   - `npm run build` thành công 100%.

### Phiên 34 (2026-09-14) — Tích Hợp Ghi Nhớ Đăng Nhập 3 Ngày & Lưu Trữ Phiên Bền Vững (Remember Me - 3 Days)
1. **Kiến Trúc Xác Thực Bền Vững (Session Persistence & Expiration)**:
   - **Lưu trữ phiên tập trung (`backend/data/sessions.json`)**: Backend tự động đồng bộ Map phiên đăng nhập vào file `sessions.json` trên ổ cứng mỗi khi có đăng nhập (`login`) hoặc đăng xuất (`logout`), bảo toàn phiên đăng nhập kể cả khi khởi động lại server Node.js.
   - **Thời gian sống phiên 3 ngày (`THREE_DAYS_MS = 259,200,000 ms`)**:
     - Khi người dùng đăng nhập thành công với tùy chọn ghi nhớ, backend tạo session có `expiresAt = Date.now() + 3 ngày` và `rememberMe: true`.
     - Middleware `requireAuth` kiểm tra hạn token thời gian thực: Nếu quá 3 ngày không hoạt động, session tự động bị xóa khỏi bộ nhớ và ổ cứng, trả về lỗi `401 Phiên đăng nhập đã hết hạn sau 3 ngày`.
     - API `/api/auth/me` trả về chi tiết thông tin tài khoản và thời điểm hết hạn `expiresAt`.
2. **Nâng Cấp Giao Diện & Client Auth Flow**:
   - **Giao diện Đăng nhập (`LoginPage.jsx`)**: Bổ sung checkbox tùy chọn `Ghi nhớ đăng nhập (3 ngày)` (mặc định tích chọn) theo chuẩn thiết kế ServerKit.
   - **Tự động phục hồi phiên (`useAuth.jsx` & `client.js`)**:
     - Lưu `hs_token_expires_at` cùng với `hs_auth_token` vào `localStorage`.
     - Khi mở lại trình duyệt, ứng dụng tự động kiểm tra thời gian hết hạn; nếu còn trong vòng 3 ngày, client tự động gọi `/api/auth/me` để nạp phiên và cho phép người dùng vào thẳng trang Dashboard mà không cần đăng nhập lại.
3. **Kiểm Thử & Xác Nhận**:
   - Đã kiểm tra thực tế trên trình duyệt: Đăng nhập tài khoản quản trị `user_api`, xác nhận file `backend/data/sessions.json` ghi nhận thời gian hết hạn đúng 72 giờ (3 ngày) tiếp theo.
   - `npm run build` hoàn thành nhanh chóng (~600ms), không có bất kỳ lỗi cú pháp nào.

---

```bash
# 1. Chạy mock + backend (2 terminal riêng):
npm run dev:mock
npm run dev:backend

# 2. Test API qua script (không cần curl):
node scripts/test-api.mjs

# 3. Test formatting:
node scripts/test-format.mjs

# 4. Build production frontend:
npm.cmd run build
```

### Windows — chạy nền bằng PowerShell

```powershell
# Chạy mock + backend + vite (ẩn cửa sổ, log ra backend/*.log, frontend/vite.log)
powershell -File scripts/start-servers.ps1

# Tắt toàn bộ node process
powershell -File scripts/stop-servers.ps1
```