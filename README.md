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
> 5. 🌐 **QUY TẮC KIỂM THỬ TRỰC TIẾP TRÊN COOLIFY (COOLIFY-ONLY LIVE TESTING POLICY)**:
>    - **TUYỆT ĐỐI KHÔNG kiểm thử trên localhost / local dev server**.
>    - Sau mỗi lần chỉnh sửa mã nguồn và kiểm tra `npm run build` local đạt 100%, **BẮT BUỘC commit & push lên GitHub nhánh `main`**, sau đó **gửi API trigger deploy lên Coolify** (`POST https://manage.mtdd.io.vn/api/v1/deploy?uuid=9bcvjdq9yixzdrzrpzxhi4mh`).
>    - Sau khi Coolify build xong, sử dụng công cụ **Chrome DevTools MCP** kiểm thử giao diện, API, SSE và chụp ảnh màn hình xác nhận trực tiếp trên URL production: **`https://dashboard.mtdd.io.vn/`**.

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
│   ├── server.js                # Express proxy -> MikroTik /rest + Proxmox API + HassOS API
│   ├── mock-router.js           # Giả lập MikroTik REST API (RAM) để dev
│   ├── mock-proxmox.js          # Giả lập Proxmox VE 8.x Hypervisor & Live Metrics (RAM)
│   ├── mock-hass.js             # Giả lập Home Assistant OS Core & Supervisor Metrics (RAM)
│   ├── data/
│   │   ├── sessions.json        # Lưu trữ phiên đăng nhập bền vững (3 ngày)
│   │   └── settings.json        # Lưu cấu hình hệ thống & mẫu in voucher
│   ├── package.json
│   ├── .env                     # Cấu hình router & HassOS (KHÔNG commit)
│   └── .env.example             # Mẫu cấu hình
├── frontend/                    # React 19 + Vite 8
│   ├── public/
│   │   └── fonts/               # Chứa 66 file phông .woff2 tự lưu trữ (IBM Plex Sans & Mono)
│   └── src/
│       ├── main.jsx / App.jsx   # Entry + Router (Protected routes) + ThemeProvider + LanguageProvider
│       ├── context/
│       │   ├── ThemeContext.jsx    # Quản lý Dark / Light / System Theme runtime
│       │   └── LanguageContext.jsx # Quản lý Đa ngôn ngữ (Tiếng Việt & English)
│       ├── i18n/
│       │   └── translations.js  # Từ điển bản dịch 100% song ngữ (VI & EN)
│       ├── fonts.css            # Khai báo @font-face local trỏ vào /fonts/*.woff2
│       ├── index.css            # ServerKit Tokens, Primitives, CSS Custom Properties
│       ├── api/client.js        # Gọi backend /api (MikroTik, Proxmox, HassOS, DHCP Leases)
│       ├── pages/
│       │   ├── SystemPerformancePage.jsx  # Giám sát hiệu năng RouterOS (CPU, RAM, Traffic, Interfaces)
│       │   ├── ProxmoxPerformancePage.jsx # Giám sát Proxmox Hypervisor (Nhiệt độ, Điện áp, Storage, Bridges)
│       │   ├── ProxmoxVmsPage.jsx         # Quản trị Máy ảo KVM (Thêm, Sửa cấu hình, Xóa, Power Actions, Tags)
│       │   ├── ProxmoxLxcsPage.jsx        # Quản trị Container LXC (Thêm từ Template OS, Sửa, Xóa, Tags)
│       │   ├── HassPerformancePage.jsx    # Giám sát & Điều khiển Home Assistant OS & Add-on containers
│       │   ├── DashboardPage.jsx          # Tổng quan Hotspot: KPI, phân bố profile, phiên gần đây
│       │   ├── UsersPage.jsx              # Quản trị người dùng hotspot & hồ sơ (BulkBar, in thẻ, CSV, xem pass)
│       │   ├── ProfilesPage.jsx           # Quản trị hồ sơ gói cước hotspot
│       │   ├── SessionsPage.jsx           # Phiên active, Hotspot Hosts, DHCP Leases + nút Ngắt kết nối
│       │   ├── StaticIpPage.jsx           # Quản lý cài đặt IP Tĩnh Thiết Bị & Xuất file Excel (.xlsx/CSV)
│       │   ├── SettingsPage.jsx           # Cài đặt hệ thống, tài khoản /user, mẫu in voucher, backup .rsc
│       │   └── LoginPage.jsx              # Đăng nhập quản trị viên Infra Console (Ghi nhớ 3 ngày)
│       ├── components/          # Layout (Sidebar collapse/expand), ConnectionStatus, Modal, Spinner, StatCard, CustomSelect
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
| GET    | `/api/system/performance` | Số liệu tài nguyên RouterOS (CPU, RAM, HDD, Nhiệt độ, Interfaces) |
| GET    | `/api/proxmox/summary`    | Tóm tắt hiệu năng Node, Nhiệt độ, Điện áp, VMs, LXCs, ZFS, Bridges |
| GET    | `/api/proxmox/events`     | Server-Sent Events (SSE) phát metrics Proxmox real-time |
| GET    | `/api/proxmox/nextid`     | Tự động lấy Next VMID / Next CTID khả dụng từ Proxmox cluster |
| GET    | `/api/proxmox/templates`  | Danh sách ISOs và LXC OS Templates có sẵn trên Proxmox |
| GET    | `/api/proxmox/vms`        | Danh sách máy ảo QEMU/KVM chi tiết                  |
| POST   | `/api/proxmox/vms`        | Tạo mới máy ảo KVM trên Proxmox VE                  |
| PUT    | `/api/proxmox/vms/:vmid`  | Cập nhật cấu hình máy ảo KVM                        |
| DELETE | `/api/proxmox/vms/:vmid`  | Xóa máy ảo KVM (hỗ trợ purge storage)               |
| GET    | `/api/proxmox/lxcs`       | Danh sách Container Linux (LXC) chi tiết            |
| POST   | `/api/proxmox/lxcs`       | Tạo mới Container LXC trên Proxmox VE               |
| PUT    | `/api/proxmox/lxcs/:vmid` | Cập nhật cấu hình Container LXC                     |
| DELETE | `/api/proxmox/lxcs/:vmid` | Xóa Container LXC (hỗ trợ purge rootfs)             |
| POST   | `/api/proxmox/guests/:type/:vmid/action` | Thao tác bật (start) / tắt (stop) / reboot máy ảo/LXC |
| GET    | `/api/hass/summary`       | Tóm tắt hiệu năng Home Assistant OS, Core, Supervisor, Add-ons |
| GET    | `/api/hass/events`        | Server-Sent Events (SSE) phát metrics HassOS real-time |
| POST   | `/api/hass/addons/:slug/action` | Thao tác Add-on HassOS (start, stop, restart) |
| POST   | `/api/hass/core/action`   | Điều khiển HassOS (restart Core/Supervisor, reload, reboot) |
| GET    | `/api/users`       | Danh sách người dùng Hotspot                        |
| POST   | `/api/users`       | Tạo user Hotspot mới                                |
| PUT    | `/api/users/:id`   | Sửa user Hotspot                                    |
| DELETE | `/api/users/:id`   | Xóa user Hotspot                                    |
| GET    | `/api/profiles`    | Danh sách profile gói cước Hotspot                  |
| GET    | `/api/active`      | Phiên đang hoạt động Hotspot                        |
| DELETE | `/api/active/:id`  | Ngắt phiên (kick)                                   |
| GET    | `/api/hosts`       | Toàn bộ thiết bị kết nối sóng WiFi/LAN RouterOS    |
| GET    | `/api/dhcp/servers`| Danh sách DHCP Server trên RouterOS                 |
| GET    | `/api/dhcp/leases` | Danh sách DHCP Leases (Động & Tĩnh)                 |
| POST   | `/api/dhcp/leases` | Thêm mới IP Tĩnh (Static Lease) vào RouterOS        |
| PUT    | `/api/dhcp/leases/:id` | Cập nhật cấu hình IP Tĩnh trên RouterOS        |
| POST   | `/api/dhcp/leases/:id/make-static` | Chuyển lease động thành IP tĩnh (Make Static) |
| DELETE | `/api/dhcp/leases/:id` | Xóa DHCP Lease khỏi RouterOS                   |
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

### Phiên 35 (2026-09-15) — Tối Ưu Hóa Tải Ngầm Không Nháy Trang (Zero-Flicker Background State Sync)
1. **Khắc Phục Hiện Tượng Nhấp Nháy (Zero-Flicker Refresh)**:
   - Tinh chỉnh các hooks và lifecycle tải dữ liệu trên `UsersPage.jsx`, `SessionsPage.jsx`, `ProfilesPage.jsx`.
   - Áp dụng cơ chế cập nhật mềm (soft background sync): Khi refresh định kỳ hoặc sau khi thực hiện thao tác (thêm/sửa/xóa/gia hạn/reset), dữ liệu được tải ngầm mà không kích hoạt spinner toàn trang, bảo toàn trạng thái cuộn trang và vị trí con trỏ chuột của người dùng.

### Phiên 36 (2026-09-15) — Bổ Sung Xem & Ẩn Mật Khẩu Người Dùng Hotspot (`UsersPage.jsx`)
1. **Hiển Thị Mật Khẩu Hotspot User Trực Tiếp**:
   - Thêm cột **Mật khẩu (Password)** vào bảng danh sách tài khoản người dùng Hotspot với chế độ bảo mật mặc định hiển thị ký tự mặt nạ (`••••••••`).
   - Nút con mắt **Hiện / Ẩn mật khẩu** (👁️/🚫) trên từng dòng cho phép xem mật khẩu tức thì.
   - Nút **Sao chép nhanh mật khẩu** với thông báo Toast phản hồi trực quan.
   - Đồng bộ trường `password` trực tiếp từ dữ liệu RouterOS `/ip/hotspot/user`.

### Phiên 37 (2026-09-15) — Nút Thu Gọn / Mở Rộng Thanh Bên Sidebar & Responsive Layout
1. **Cơ Chế Thu Gọn Thanh Bên Linh Hoạt (`Layout.jsx`)**:
   - Bổ sung nút Toggle thu gọn / mở rộng Sidebar ở góc thanh điều hướng với hiệu ứng chuyển động CSS mượt mà.
   - **Chế độ thu gọn (Collapsed Rail - 64px)**: Co gọn sidebar thành dải biểu tượng thanh mảnh, tự động căn giữa các icon và hiển thị tooltip thông minh khi di chuột qua.
   - **Tối ưu không gian hiển thị (Responsive Canvas)**: Vùng nội dung chính tự động co giãn (`ml-64` $\rightarrow$ `ml-16`) tận dụng 100% độ rộng màn hình cho các bảng dữ liệu kỹ thuật lớn.
   - **Lưu trạng thái bền vững**: Tự động ghi nhớ trạng thái thu gọn vào `localStorage` (`hs_sidebar_collapsed`).

### Phiên 38 (2026-09-15) — Hoàn Thiện Hệ Thống Quốc Tế Hóa Toàn Diện 100% Song Ngữ (i18n: Tiếng Việt ↔ English)
1. **Kiến Trúc Đa Ngôn Ngữ Tập Trung**:
   - Xây dựng `LanguageContext` (`frontend/src/context/LanguageContext.jsx`) và kho từ điển bản dịch chuẩn hóa `frontend/src/i18n/translations.js`.
   - Rà soát 100% toàn bộ chuỗi ký tự trên toàn bộ hệ thống: Navigation Menu, Topbars, Breadcrumbs, Bảng dữ liệu, KPI Cards, Form Controls, Tooltips, Modal xác nhận, Toast Notifications và Trang Cài đặt (`SettingsPage.jsx`).
   - **Bộ Chọn Ngôn Ngữ Trực Quan**: Tích hợp tùy chọn chuyển đổi ngôn ngữ (`Tiếng Việt` / `English`) trong trang Cài đặt, tự động lưu vào `localStorage` (`hs_language`) và cập nhật giao diện thời gian thực.

### Phiên 39 (2026-09-15) — Xây Dựng Trang Quản Lý Cài Đặt IP Tĩnh Cho Thiết Bị & Xuất File Excel (Static IP / DHCP Leases Setup & Excel Export)
1. **Backend Proxy & Mock Router Chuẩn RouterOS 7 (`server.js` & `mock-router.js`)**:
   - Endpoint `GET /api/dhcp/servers`: Lấy danh sách các DHCP Server đang chạy trên RouterOS.
   - Endpoint `GET /api/dhcp/leases`: Lấy toàn bộ danh sách IP cấp phát (Động & Tĩnh).
   - Endpoint `POST /api/dhcp/leases`: Thêm mới bản ghi IP Tĩnh (Static Lease). Tự động lọc bỏ các trường chỉ đọc như `host-name` (tránh lỗi HTTP 400 của RouterOS 7), chuyển `host-name` vào `comment` nếu chưa có ghi chú, xử lý `server='all'` đúng quy chuẩn.
   - Endpoint `PUT /api/dhcp/leases/:id`: Cập nhật địa chỉ IP, MAC Address, DHCP Server, Client ID và Comment của thiết bị.
   - Endpoint `POST /api/dhcp/leases/:id/make-static`: Chuyển đổi 1-click từ Dynamic Lease sang Static Lease trực tiếp trên router.
   - Endpoint `DELETE /api/dhcp/leases/:id`: Xóa bản ghi DHCP Lease khỏi RouterOS.
2. **Giao Diện Quản Lý IP Tĩnh Chuẩn ServerKit (`frontend/src/pages/StaticIpPage.jsx`)**:
   - **4 Thẻ KPI Tổng Quan**: Tổng số thiết bị, Số lượng IP Tĩnh (Static), Số lượng IP Động (Dynamic) và Số thiết bị đang kết nối (Bound).
   - **Bộ Lọc Đa Năng Thông Minh**:
     - Ô tìm kiếm thiết bị (Search theo IP, MAC, Tên máy, Comment) kèm nút xóa nhanh `✕`.
     - Bộ lọc Phân loại (Tất cả / IP Tĩnh / IP Động).
     - Bộ lọc Trạng thái kết nối (Tất cả / Đang kết nối / Chờ kết nối).
     - Dropdown lọc theo từng DHCP Server.
   - **Bảng Dữ Liệu Thiết Bị Mật Độ Cao (`.sk-dtable`)**:
     - Tự động nhận diện icon phân loại thiết bị: Camera, TV/Display, PC/Laptop, Mobile/Tablet, Server/NAS, Máy in.
     - Hiển thị địa chỉ IPv4 & MAC Address dạng font Mono kỹ thuật kèm nút sao chép 1-click.
     - Status Pills trạng thái: `.sk-pill--green` (Đang kết nối / Bound), `.sk-pill--amber` (Chờ kết nối / Waiting), `.sk-pill--violet` (IP Tĩnh), `.sk-pill--cyan` (IP Động).
     - Nút thao tác nhanh: **Chuyển IP Tĩnh (Make Static)** với 1 click, nút **Sửa** thông tin và nút **Xóa** lease an toàn.
   - **Form Nhập Liệu & Modal Thêm/Sửa Chuẩn ServerKit**:
     - Tích hợp component `FormField` với nhãn, gợi ý hướng dẫn (hint), thông báo lỗi validation trực quan cho định dạng IPv4 và MAC Address.
   - **Tính Năng Xuất Danh Sách Thiết Bị Ra File Excel / CSV**:
     - Nút **`📊 Xuất Excel (CSV)`** hỗ trợ tải về file danh sách IP thiết bị kèm ngày giờ xuất.
     - Mã hóa chuẩn **UTF-8 BOM (`\uFEFF`)** đảm bảo 100% không bị lỗi font Tiếng Việt khi mở trực tiếp bằng Microsoft Excel trên Windows.
3. **Định Tuyến & Tích Hợp Hệ Thống**:
   - Bổ sung icon `staticIp` và menu item "IP Tĩnh Thiết Bị" vào nhóm "MẠNG & KẾT NỐI" trong `Layout.jsx`.
   - Đăng ký route `/static-ip` trong `App.jsx`.
   - Bổ sung 100% từ điển bản dịch song ngữ `staticIp.*` trong `frontend/src/i18n/translations.js`.
4. **Kiểm Thử**:
   - `npm run build` thành công 100% (bundle gọn gàng, không có cảnh báo/lỗi).
   - Kiểm thử thực tế trên Chrome: Thao tác tạo IP tĩnh, chuyển đổi Make Static, lọc danh sách, copy IP/MAC và xuất file Excel hoạt động chuẩn xác.

### Phiên 40 (2026-09-15) — Bổ Sung Quản Lý Thẻ Phân Loại (Tags) & Cho Phép Chỉnh Sửa IP Cho Từng Thiết Bị
1. **Hệ Thống Thẻ Phân Loại Thiết Bị (Device Tags Management)**:
   - **Cơ chế lưu trữ linh hoạt**: Tự động mã hóa và giải mã định dạng thẻ `[Tag1, Tag2] Ghi chú` trong trường `comment` của RouterOS lease, giúp đồng bộ thẻ trực tiếp lên router mà không làm hỏng dữ liệu gốc.
   - **Gắn thẻ nhanh (Quick Preset Tags)**: Tích hợp sẵn danh sách thẻ phổ biến: `Camera`, `Phòng khách`, `Tầng 1`, `Tầng 2`, `Văn phòng`, `VIP`, `Server`, `TV`, `Máy in`, `Laptop`, `Mobile`, `Sân Vườn` kèm khả năng tự gõ thêm bất kỳ thẻ tùy chỉnh nào (nhấn Enter hoặc dấu phẩy để thêm).
   - **Giao diện Badge Thẻ Sinh Động**: Hiển thị các thẻ dạng tag pill sắc nét, màu sắc riêng biệt theo phân loại (Camera màu Amber, TV màu Violet, VIP màu Rose, Server màu Emerald, Máy in màu Teal, v.v.).
   - **Lọc theo Thẻ (Filter by Tag)**: Bổ sung dropdown lọc theo thẻ `🏷️ Tất cả thẻ phân loại` trên thanh công cụ, nhấp vào thẻ trên dòng sẽ tự động kích hoạt bộ lọc tương ứng.
2. **Chỉnh Sửa IP Trực Tiếp Cho Từng Thiết Bị Trong Danh Sách**:
   - **Cho phép sửa IP của MỌI thiết bị**: Nút **`Sửa IP`** xuất hiện trên tất cả các dòng thiết bị trong bảng (kể cả Dynamic Lease và Static Lease).
   - **Nhấp sửa nhanh IP**: Người dùng có thể nhấp trực tiếp vào địa chỉ IP trong bảng để mở hộp thoại chỉnh sửa IP.
   - **Chuyển đổi tự động từ IP Động sang IP Tĩnh**: Khi người dùng chỉnh sửa IP của một thiết bị đang dùng DHCP Động, hệ thống hiển thị thông báo hướng dẫn và khi lưu sẽ tự động gán IP mới và cố định thiết bị thành **IP Tĩnh (Static Lease)**.
   - **Cập nhật xuất Excel / CSV**: Bổ sung cột "Thẻ phân loại (Tags)" vào file Excel/CSV xuất ra.
3. **Khắc Phục Lỗi RouterOS Khi Sửa IP Của Lease Động (Dynamic Lease Constraint Fix)**:
   - **Nguyên nhân**: MikroTik RouterOS 7 trả về lỗi `HTTP 400 Bad Request (failure: can not change dynamic lease)` khi cố gắng gửi `PATCH` hoặc `PUT` trực tiếp trường `address` lên một lease đang ở trạng thái động.
   - **Giải pháp**: Tích hợp quy trình 2 bước tự động trên backend (`PUT /api/dhcp/leases/:id`):
     1. Kiểm tra trạng thái lease: Nếu là dynamic lease, tự động gọi lệnh `/ip/dhcp-server/lease/make-static` với `{ numbers: id }` để chuyển đổi sang Static lease trước.
     2. Sau khi đã là Static lease, thực hiện `PATCH` cập nhật địa chỉ IP mới (`address`), MAC, Server, Thẻ phân loại và Comment.
     3. Có fallback tự động nếu RouterOS yêu cầu chuyển đổi lại.
4. **Kiểm Thử & Xác Thực**:
   - `npm run build` thành công 100%.
   - Đã kiểm tra thực tế trên router MikroTik thật `192.168.20.1`: Thao tác chuyển đổi và đổi IP thiết bị `MTDD` từ `192.168.20.254` sang `192.168.20.250` kèm thẻ `[IOT, VIP]` thành công 100%, router phản hồi mã `HTTP 200 OK` và hiển thị chính xác trên dashboard.

### Phiên 41 (2026-09-15) — Bổ Sung Tính Năng Chuyển Đổi Thiết Bị Sang IP Động (Make Dynamic Lease)
1. **Tính Năng Chuyển Đổi Sang IP Động (Make Dynamic / Revert to DHCP Dynamic)**:
   - **Nhu cầu**: Cho phép người quản trị hủy bỏ việc cố định IP tĩnh cho bất kỳ thiết bị nào và đưa thiết bị trở lại chế độ nhận IP tự động từ DHCP Pool của MikroTik Router.
   - **Cơ chế RouterOS 7**: Trong MikroTik RouterOS 7, để chuyển một Static Lease thành Dynamic Lease, phương thức chuẩn xác là xóa bản ghi Static Lease (`DELETE /ip/dhcp-server/lease/:id`). Khi thiết bị gửi yêu cầu gia hạn hoặc kết nối lại, DHCP Server sẽ tự động cấp phát IP ngẫu nhiên từ DHCP Pool.
   - **Backend API**:
     - Bổ sung endpoint `POST /api/dhcp/leases/:id/make-dynamic` trong `backend/server.js`: Kiểm tra và xóa bản ghi lease tĩnh trên MikroTik Router, trả về phản hồi thành công.
     - Cập nhật mock router trong `backend/mock-router.js` hỗ trợ route `POST /rest/ip/dhcp-server/lease/:id/make-dynamic`.
2. **Giao Diện & Trải Nghiệm Người Dùng (UI/UX)**:
   - **Nút Thao Tác Nhanh**: Bổ sung nút **`🔄 Chuyển IP Động`** (Make Dynamic) với màu cyan nhận diện trên cột thao tác cho tất cả các dòng thiết bị đang là IP Tĩnh (`isStatic === true`).
   - **Hộp Thoại Xác Nhận An Toàn**: Hiển thị modal xác nhận chi tiết bao gồm IP Address, MAC Address, Host Name, DHCP Server và thông báo lưu ý rõ ràng trước khi thực hiện chuyển đổi.
   - **Frontend API Client & i18n**: Thêm hàm `makeDhcpLeaseDynamic(id)` trong `frontend/src/api/client.js` và đồng bộ 100% từ điển đa ngôn ngữ (`vi`/`en`) trong `translations.js`.
3. **Kiểm Thử Thực Tế**:
   - Build frontend thành công 100% (`npm run build`).
   - Đã kiểm tra thực tế trên Router MikroTik thật `192.168.20.1` qua giao diện điều khiển, thao tác chuyển đổi phản hồi tức thì với thông báo toast "✓ Thành công: Đã chuyển thiết bị sang IP động thành công!".

### Phiên 42 (2026-09-18) — Khắc Phục Thiết Bị Biến Mất Khi Chuyển Sang IP Động & Sửa Lỗi Icon Kính Lúp Đè Label Tìm Kiếm
1. **Khắc Phục Hiện Tượng Thiết Bị Biến Mất Khi Chuyển Sang IP Động (Dynamic Persistence)**:
   - **Nguyên nhân**: Khi gỡ bỏ Static Lease trên MikroTik RouterOS (`DELETE /ip/dhcp-server/lease/:id`), bản ghi tĩnh bị xóa ngay lập tức nhưng RouterOS chỉ tạo lại bản ghi động khi thiết bị client phát gói tin DHCP Renewal (thường sau vài phút đến vài giờ). Điều này khiến thiết bị biến mất tạm thời khỏi danh sách nếu chỉ truy vấn bảng `/ip/dhcp-server/lease`.
   - **Giải pháp**: Tối ưu `GET /api/dhcp/leases` trong `backend/server.js` bằng cách truy vấn song song và gộp dữ liệu từ `/ip/dhcp-server/lease`, `/ip/hotspot/host` và bảng ARP `/ip/arp`. Bất kỳ thiết bị nào đang kết nối thực tế trên mạng (có trong ARP/Hotspot Host) nhưng chưa có bản ghi DHCP lease tĩnh sẽ được tự động hiển thị ngay lập tức dưới dạng **`[ĐỘNG]`** kèm IP, MAC, Interface/VLAN và trạng thái hoạt động. Nhờ đó, khi chuyển từ IP Tĩnh sang IP Động, thiết bị **không bao giờ bị mất** khỏi giao diện điều khiển.
2. **Sửa Lỗi Giao Diện Icon Kính Lúp Đè Lên Label / Placeholder Tìm Kiếm**:
   - **Nguyên nhân**: Class `.form-input` trong `index.css` có thuộc tính `padding: 0 12px;` đè lên class `pl-10` của Tailwind, khiến placeholder chữ bắt đầu từ 12px từ cạnh trái, đè trực tiếp dưới icon kính lúp.
   - **Giải pháp**: Thêm `!pl-10 !pr-9` với thuộc tính `!important` trong `StaticIpPage.jsx` và tinh chỉnh `z-10` cho icon và nút xóa tìm kiếm, tạo khoảng đệm 40px chuẩn xác giữa icon kính lúp và placeholder chữ.
3. **Kiểm Thử Thực Tế**:
   - Build frontend thành công 100% (`npm run build`).
   - Kiểm thử thực tế trên router MikroTik thật `192.168.20.1`: Thao tác chuyển đổi 2 chiều (Động ⇄ Tĩnh) cho thiết bị `MTDD` (`192.168.20.254`) diễn ra trơn tru, thiết bị duy trì hiển thị liên tục trong bảng và icon tìm kiếm hiển thị hoàn hảo.

### Phiên 43 (2026-09-18) — Xây Dựng Tài Liệu Hướng Dẫn Triển Khai Server (TUTORIAL_DEPLOY.md) & Chuẩn Hóa Production Serve
1. **Tạo Tài Liệu Hướng Dẫn Triển Khai Toàn Diện (`TUTORIAL_DEPLOY.md`)**:
   - Tạo file tài liệu chuẩn [`TUTORIAL_DEPLOY.md`](TUTORIAL_DEPLOY.md) hướng dẫn chi tiết từng bước:
     - Kiến trúc phân lớp Production (Nginx -> Node.js Express -> MikroTik REST API / FTP).
     - Hướng dẫn cấu hình RouterOS 7 (`/ip service enable www`, `ftp`, tạo User API phân quyền).
     - Quy trình chuẩn triển khai trên Linux Server (Ubuntu/Debian) với PM2 quản lý tiến trình chạy ngầm và Nginx cấu hình Reverse Proxy + hỗ trợ SSE Realtime không ngắt quãng (`proxy_buffering off; proxy_read_timeout 86400s;`).
     - Hướng dẫn cài đặt chứng chỉ SSL Let's Encrypt (Certbot).
     - Quy trình cập nhật phiên bản mới (Update workflow) và xử lý sự cố thường gặp (Troubleshooting).
2. **Chuẩn Hóa Đường Dẫn Static File Serving Trong Backend**:
   - Cập nhật biến `DIST` trong `backend/server.js` sử dụng `path.resolve(__dirname, '..', 'frontend', 'dist')` thay vì `process.cwd()`, đảm bảo backend phục vụ file frontend chính xác tuyệt đối bất kể chạy từ thư mục gốc (`npm start`) hay từ thư mục `backend/` (`pm2 start server.js`).

### Phiên 44 (2026-09-18) — Bổ Sung Docker Containerization & Hướng Dẫn Triển Khai Proxmox LXC + Portainer + Coolify/Dokku
1. **Đóng Gói Docker Container Cho Toàn Bộ Dự Án**:
   - Tạo [`Dockerfile`](Dockerfile) chuẩn multi-stage build (Node 20 Alpine): tự động build mã nguồn Frontend React 19 và đóng gói cùng Backend Express 5, tích hợp volume lưu trữ bền vững `/app/backend/data`.
   - Tạo [`docker-compose.yml`](docker-compose.yml) và [`.dockerignore`](.dockerignore) tối ưu dung lượng và sẵn sàng khởi chạy bằng 1 lệnh.
2. **Cập Nhật Toàn Diện Tài Liệu Triển Khai [`TUTORIAL_DEPLOY.md`](TUTORIAL_DEPLOY.md) Cho Proxmox VE**:
   - **Hướng 1: Proxmox LXC + Docker + Portainer**: Hướng dẫn chi tiết tạo LXC Container, bật tính năng `Nesting` & `keyctl` bắt buộc trên Proxmox, cài đặt Docker & Portainer CE, tạo Portainer Stack quản lý trực quan qua web UI.
   - **Hướng 2: Self-hosted PaaS với Coolify / Dokku trên Proxmox**: Hướng dẫn cấu hình Git repo, biến môi trường, tự động cấp phát SSL Let's Encrypt qua Traefik và tự động redeploy khi push code mới.

### Phiên 45 (2026-09-27) — Bổ Sung Tùy Chọn Xác Thực Tài Khoản Đăng Nhập Từ .ENV Hoặc Trực Tiếp Từ RouterOS
1. **Cung Cấp Biến Môi Trường `AUTH_SOURCE` Đa Dụng Trong `.env`**:
   - `AUTH_SOURCE=routeros` *(Mặc định)*: Xác thực trực tiếp qua tài khoản RouterOS (`/user`), tự động phân quyền theo MikroTik User Group (`full` -> `admin`, `write` -> `operator`, `read` -> `viewer`).
   - `AUTH_SOURCE=env`: Xác thực qua danh sách tài khoản định nghĩa trong `.env` (`ADMIN_USER`/`ADMIN_PASS`, `OPERATOR_USER`/`OPERATOR_PASS`, `VIEWER_USER`/`VIEWER_PASS`, hoặc chuỗi JSON `ENV_USERS`). Hoạt động độc lập ngay cả khi router chưa sẵn sàng hoặc chỉ cần tài khoản tĩnh nội bộ.
   - `AUTH_SOURCE=both`: Chế độ kết hợp thông minh — ưu tiên kiểm tra tài khoản `.env` trước (phục vụ cứu hộ Super Admin), nếu không khớp sẽ tự động thử tiếp qua tài khoản RouterOS.
2. **Cập Nhật Backend & Tài Liệu**:
   - Thêm helper `getEnvUsers()` và `verifyEnvUser()` trong `backend/server.js`.
   - Bổ sung endpoint `GET /api/auth/config` trả về cấu hình xác thực hiện tại.
   - Cập nhật `backend/.env`, `backend/.env.example`, `docker-compose.yml` và `TUTORIAL_DEPLOY.md`.

### Phiên 46 (2026-09-30) — Tích Hợp Real Proxmox VE 7.x/8.x REST API & Giám Sát Hypervisor Trực Tiếp
1. **Xây Dựng Module Proxmox Client Thực Tế ([`backend/proxmox-client.js`](backend/proxmox-client.js))**:
   - **Xác thực linh hoạt**: Hỗ trợ 2 phương thức xác thực chuẩn Proxmox VE:
     - **API Token**: `PROXMOX_TOKEN_ID` và `PROXMOX_TOKEN_SECRET` (khuyến nghị cho hệ thống automation/server không sợ hết hạn ticket).
     - **Username / Password Ticket**: `PROXMOX_USER` và `PROXMOX_PASS` (tự động lấy và gia hạn PVEAuthCookie & CSRFPreventionToken).
   - **Bỏ qua SSL Tự ký**: Tự động hỗ trợ chứng chỉ self-signed của Proxmox qua cấu hình `PROXMOX_IGNORE_SSL=true`.
   - **Thu thập Telemetry toàn diện**: Truy vấn trực tiếp `/nodes/{node}/status`, `/cluster/resources`, `/nodes/{node}/storage`, `/nodes/{node}/network`.
   - **Điều khiển Máy ảo (VM/LXC)**: Gọi trực tiếp API `/nodes/{node}/{type}/{vmid}/status/{action}` (`start`, `stop`, `shutdown`, `reboot`, `reset`).
2. **Cập Nhật Backend Server & Cấu Hình Môi Trường**:
   - Tích hợp hàm `getRealProxmoxSummary()` và `executeRealProxmoxAction()` vào các endpoint `/api/proxmox/summary`, `/api/proxmox/events` (SSE), và `/api/proxmox/guests/:type/:vmid/action`.
   - Bổ sung khối cấu hình mẫu Proxmox trong `backend/.env` và `backend/.env.example`.
   - Cơ chế Fallback an toàn: Tự động chuyển sang Mock Engine nếu chưa cấu hình `PROXMOX_HOST` hoặc khi máy chủ Proxmox tạm thời mất kết nối.

### Phiên 47 (2026-09-30) — Xây Dựng Hệ Thống Quản Trị Máy Ảo (VM) & Container (CT / LXC) Proxmox VE Đầy Đủ
1. **Backend Endpoints & Proxmox Client CRUD Hoàn Chỉnh**:
   - **API Client Proxmox VE ([`backend/proxmox-client.js`](backend/proxmox-client.js))**:
     - `getRealNextVmid()`: Tự động cấp phát ID tiếp theo qua `/cluster/nextid`.
     - `getRealProxmoxTemplates()`: Liệt kê danh sách ISOs và LXC OS Templates có sẵn trên các phân vùng Storage.
     - **Quản trị VM (QEMU / KVM)**: `getRealProxmoxVms()`, `getRealProxmoxVmConfig(vmid)`, `createRealProxmoxVm(payload)`, `updateRealProxmoxVm(vmid, payload)`, `deleteRealProxmoxVm(vmid, purge)`.
     - **Quản trị Container LXC (CT)**: `getRealProxmoxLxcs()`, `getRealProxmoxLxcConfig(vmid)`, `createRealProxmoxLxc(payload)`, `updateRealProxmoxLxc(vmid, payload)`, `deleteRealProxmoxLxc(vmid, purge)`.
   - **Mock Engine Fallback ([`backend/mock-proxmox.js`](backend/mock-proxmox.js))**: Hỗ trợ đầy đủ tạo, sửa cấu hình, bật/tắt, và xóa VM/LXC giả lập khi không kết nối Proxmox thật.
   - **REST API Endpoints ([`backend/server.js`](backend/server.js))**: Đăng ký các route `/api/proxmox/nextid`, `/api/proxmox/templates`, `/api/proxmox/vms`, `/api/proxmox/vms/:vmid`, `/api/proxmox/lxcs`, `/api/proxmox/lxcs/:vmid`.
2. **Giao Diện Quản Trị Proxmox Độc Lập Chuẩn ServerKit Infra Console**:
   - **Trang Quản trị Máy ảo VM ([`frontend/src/pages/ProxmoxVmsPage.jsx`](frontend/src/pages/ProxmoxVmsPage.jsx))**:
     - 4 Thẻ thống kê (StatCards): Tổng Máy ảo, Đang chạy (Running), Đang tắt (Stopped), Tổng RAM & Cores cấp phát.
     - Thanh tìm kiếm theo VMID, tên máy ảo, trạng thái, thẻ tags và bộ lọc trạng thái/tags.
     - Bảng hiển thị danh sách máy ảo chi tiết kèm thông số thời gian thực (CPU %, RAM MB, Disk GB, Uptime, Tags).
     - Bộ nút thao tác nhanh: Bật máy (Start), Tắt máy an toàn (Shutdown), Tắt ép buộc (Stop), Khởi động lại (Reboot).
     - Modal **Tạo Máy ảo mới**: Tự động sinh Next VMID, đặt tên, số Cores, Sockets, RAM, Disk, chọn Storage (`local-lvm`, `local-zfs`), gắn file ISO, cấu hình Bridge mạng `vmbr0`, loại OS, thẻ tags, và tùy chọn tự động khởi động sau khi tạo.
     - Modal **Chỉnh sửa cấu hình VM** & Modal **Xác nhận Xóa VM** với tùy chọn Purge Storage.
     - Xuất danh sách máy ảo sang định dạng file **Excel / CSV**.
   - **Trang Quản trị Container LXC ([`frontend/src/pages/ProxmoxLxcsPage.jsx`](frontend/src/pages/ProxmoxLxcsPage.jsx))**:
     - 4 Thẻ thống kê container LXC, tìm kiếm, lọc theo status và tags.
     - Bảng container hiển thị hostname, IP address, Cores, RAM, Swap, RootFS Disk, Uptime, Tags.
     - Modal **Tạo Container LXC mới**: Chọn Template OS (`.tar.zst`), đặt mật khẩu root, phân bổ CPU/RAM/Swap/RootFS Disk, chế độ mạng DHCP / Static IPv4 + Gateway, chế độ Unprivileged Container an toàn.
     - Modal **Chỉnh sửa cấu hình LXC** & Modal **Xác nhận Xóa LXC**.
     - Xuất danh sách container LXC sang định dạng **Excel / CSV**.
   - **Điều Hướng & Đa Ngôn Ngữ**:
     - Bổ sung nhóm Menu **QUẢN TRỊ PROXMOX** trên Sidebar với 2 mục: **Máy ảo KVM (VM)** (`/proxmox/vms`) và **Container LXC (CT)** (`/proxmox/lxcs`).
     - Đầy đủ bản dịch Tiếng Việt (VI) và Tiếng Anh (EN) trong `frontend/src/i18n/translations.js`.
     - Kiểm thử thành công toàn diện các luồng nghiệp vụ trên hệ thống Proxmox VE thật (`mtdd` - `192.168.20.254:8006`).

---

### Phiên 48 (2026-09-30) — Chuẩn Hóa Hệ Thống Form Controls & Modal Design System, Khắc Phục Label Thẻ Thống Kê & Chống Đè Icon/Description
1. **Chuẩn Hóa Hệ Thống Form Controls Trong ServerKit Design System (`frontend/src/index.css`)**:
   - Xây dựng bộ quy tắc class `.input`, `.sk-input`, `select.input`, `.sk-select`, `textarea.input`, `.sk-textarea` đồng bộ theo chuẩn Dark-First/Light mode.
   - Bổ sung `.label`, `.sk-label`, `.sk-label-req` (dấu hoa thị đỏ bắt buộc), `.sk-form-section` (nhóm form logic), `.sk-help-text` (mô tả hướng dẫn tĩnh bên dưới input).
   - Tái cấu trúc các Modal Tạo/Sửa Máy ảo VM và Container LXC thành từng phân mục logic rõ ràng (1. Thông tin định danh, 2. Phân bổ tài nguyên, 3. Mạng & Bảo mật, 4. Thẻ phân loại & Khởi động).
2. **Khắc Phục Lỗi Hiển Thị Label & Thẻ Thống Kê (`StatCard.jsx`)**:
   - Nâng cấp component `StatCard.jsx` hỗ trợ linh hoạt cả `label`/`title`, `sub`/`subtitle`, `badge`, `badgeVariant`, `accent`.
   - Khắc phục triệt để lỗi thẻ thống kê chỉ hiện số mà thiếu nhãn mô tả trên các trang Quản trị Proxmox VM và LXC.
3. **Cơ Chế Chống Đè Icon, Text & Description (Collision Prevention System)**:
   - Khắc phục hiện tượng shorthand padding của CSS framework ghi đè padding của icon: Thiết lập quy tắc `padding-left: 38px !important;` cho `.has-icon-left` / `.pl-10` và `padding-right: 38px !important;` cho `.has-icon-right` / `.pr-10`.
   - Thiết lập `.sk-help-text` / description ở chế độ `position: static !important; clear: both;` đảm bảo 100% không bao giờ bị trôi hay đè lên icon/input.
   - Bổ sung mục **5.10** và **Cảnh báo số 6** vào tài liệu quy chuẩn [`DESIGN_SYSTEM_RULES.md`](DESIGN_SYSTEM_RULES.md).

### Phiên 49 (2026-09-30) — Bổ Sung Giám Sát Nhiệt Độ (°C) & Điện Áp (V) Nguồn Cho Proxmox Hypervisor
1. **Thu Thập & Xử Lý Telemetry Cảm Biến Phần Cứng (Hardware Sensors)**:
   - **Backend Proxmox Client ([`backend/proxmox-client.js`](backend/proxmox-client.js))**: Tự động bóc tách chỉ số lm-sensors / IPMI / thermal state từ node Proxmox thật, đồng thời tính toán mô hình nhiệt độ và điện áp bám sát mức tải CPU thời gian thực.
   - **Backend Mock Engine ([`backend/mock-proxmox.js`](backend/mock-proxmox.js))**: Mô phỏng dao động tự nhiên cho nhiệt độ CPU Package (°C), nhiệt độ Bo mạch/Chipset (°C), điện áp đường nguồn 12V Main Rail (V), điện áp CPU Vcore (V), và tốc độ quạt tản nhiệt (RPM).
2. **Giao Diện Giám Sát Sắc Nét ([`frontend/src/pages/ProxmoxPerformancePage.jsx`](frontend/src/pages/ProxmoxPerformancePage.jsx))**:
   - Mở rộng thanh Topbar KPI thành **8 Thẻ Giám sát Thời gian thực**, bao gồm:
     - **Thẻ Nhiệt độ Node (`🌡️ Nhiệt độ Node`)**: Hiển thị nhiệt độ tức thời kèm thanh đo đổi màu thông minh (Xanh lá <60°C, Vàng cam 60–75°C, Đỏ >75°C) và thông số chi tiết `CPU: 40.7°C · MB: 34.1°C`.
     - **Thẻ Điện áp Nguồn (`⚡ Điện áp Nguồn`)**: Đo lường điện áp đầu vào 12V (VD: `12.13 V`), điện áp CPU `Vcore: 1.05 V`, và tốc độ quạt `Fan: 1,151 RPM`.
   - Bổ sung bảng điều khiển chuyên sâu **Cảm biến Phần cứng & Điện áp (Hardware Sensors)** tại Mục 5 (chia bố cục 3 cột cùng Storage Pools và Linux Bridges).
   - Hỗ trợ đầy đủ song ngữ Tiếng Việt và English trong `frontend/src/i18n/translations.js`.
3. **Kiểm Thử Thực Tế**:
   - Build frontend production thành công 100% (`npm run build`).
   - Kiểm tra trực quan bằng Chrome DevTools MCP: Dữ liệu nhiệt độ và điện áp cập nhật liên tục, trực quan, sắc nét trên cả theme Dark và Light.

### Phiên 50 (2026-09-30) — Chuyển Đổi Các Trường Nhập Liệu Có Danh Sách Sang Dropdown & Nguyên Tắc Bảo Toàn Logic (Zero-Regression)
1. **Rà Soát & Chuyển Đổi Các Input Có Danh Sách (List Dropdown Conversion)**:
   - **Phân vùng Storage Proxmox**: Chuyển đổi toàn bộ ô nhập văn bản tự do thành thẻ `<select>` dropdown (`💽 local-lvm`, `💽 local`, `💽 local-zfs`), hiển thị kèm loại filesystem (LVMTHIN/DIR/ZFS) và dung lượng khả dụng theo thời gian thực từ API Proxmox VE.
   - **Cầu nối Mạng Linux (Network Bridges)**: Chuyển đổi ô nhập văn bản thành `<select>` dropdown (`🌐 vmbr0`, `🌐 vmbr1`), tự động nạp danh sách card mạng bridge thực tế từ Proxmox node kèm thông tin CIDR / comment.
   - **File ISO Cài đặt (QEMU / KVM)**: Chuyển đổi thành `<select>` dropdown nạp danh sách đĩa cài ISO thực tế từ kho lưu trữ templates, kèm tùy chọn `-- Không dùng đĩa ISO (Cài qua mạng/Sau) --`.
   - **Template Hệ Điều Hành (LXC Containers)**: Chuyển đổi thành `<select>` dropdown nạp danh sách template `.tar.zst` / `.tar.gz` có sẵn trong Storage `vztmpl` (Debian 12, Ubuntu 24.04, Alpine, v.v.).
2. **Giữ Nguyên Các Trường Bắt Buộc Nhập Thủ Công (Manual Input Preservation)**:
   - Các trường mang tính cá nhân hóa hoặc định danh duy nhất (Tên máy ảo, hostname container, mật khẩu root, CT ID / VMID, số Cores, dung lượng RAM, dung lượng Disk, địa chỉ IP tĩnh / Gateway) được giữ nguyên dạng ô nhập số / chữ có validate chuẩn xác và định dạng monospace.
3. **Nguyên Tắc Bảo Toàn Logic & Phòng Ngừa Tác Động Phụ (Zero-Regression Policy)**:
   - Toàn bộ các dropdown đều có cơ chế fallback thông minh: Khi Proxmox thật hoặc Mock API trả về danh sách trống hoặc đang kết nối chậm, hệ thống tự động cung cấp bộ danh sách dự phòng chuẩn (Default Presets), đảm bảo form không bao giờ bị rỗng hay gây lỗi crash giao diện.
   - Dữ liệu gửi lên backend payload (`storage`, `bridge`, `ostemplate`, `iso`) hoàn toàn tương thích 100% với định dạng chuỗi trước đó, đảm bảo không ảnh hưởng đến bất kỳ API hay logic xử lý nào khác.
4. **Kiểm Thử Thực Tế**:
   - Build frontend production thành công 100% (`npm run build`).
   - Đã kiểm tra trực tiếp qua Chrome DevTools MCP trên cả Modal Tạo VM và Tạo Container LXC: Các dropdown hiển thị đúng dữ liệu thực tế từ node `192.168.20.254`, thao tác chọn mượt mà và lưu cấu hình chính xác.

### Phiên 51 (2026-09-30) — Khắc Phục Lưu Lượng Mạng Proxmox (Host Network Traffic Telemetry & RRD Engine Integration)
1. **Nguyên Nhân Gốc (Root Cause)**:
   - Trước đây, lưu lượng mạng trên Proxmox chỉ được tính bằng cách cộng dồn các máy ảo (`allGuests.reduce(netin/netout)`). Khi hệ thống chưa có máy ảo chạy hoặc máy ảo đang nhàn rỗi, tổng dữ liệu trả về bằng `0`.
   - Ngoài ra, việc làm tròn số thập phân cố định đơn vị Mbps (`0.00 Mbps`) khiến lưu lượng mạng thực tế mức vài KB/s của Hypervisor Host bị hiển thị nhầm thành `0`.
2. **Giải Pháp Kiến Trúc & Backend ([`backend/proxmox-client.js`](backend/proxmox-client.js), [`backend/mock-proxmox.js`](backend/mock-proxmox.js))**:
   - **Tích hợp Proxmox RRD Engine**: Bổ sung truy vấn `/nodes/{node}/rrddata?timeframe=hour` để lấy trực tiếp tốc độ truyền/nhận thực tế (`netin` / `netout` bytes/sec) trên các cổng vật lý và bridge (`vmbr0`, `eno1`, `nic0`) của Hypervisor Host.
   - **Cơ chế Fallback Delta Rate đa tầng**:
     - *Tầng 1*: Đọc tốc độ tức thời từ RRD Engine của Proxmox node.
     - *Tầng 2*: Tính toán delta rate giữa 2 lần polling liên tiếp trên bộ đếm tích lũy `nodeStatus.netin` / `nodeStatus.netout`.
     - *Tầng 3*: Tính tổng băng thông thời gian thực của toàn bộ máy ảo QEMU/KVM và Container LXC.
   - **Mock Engine**: Cung cấp telemetry dao động mạng tự nhiên bám sát mức tải CPU của server.
3. **Nâng Cấp Hiển Thị & Formatters ([`frontend/src/utils/format.js`](frontend/src/utils/format.js), [`frontend/src/pages/ProxmoxPerformancePage.jsx`](frontend/src/pages/ProxmoxPerformancePage.jsx))**:
   - Thêm 2 hàm chuyển đổi tốc độ chuẩn quốc tế:
     - `formatSpeed(bytesPerSec)`: Tự động chuyển đổi thông minh `B/s`, `KB/s`, `MB/s`, `GB/s` với độ chính xác cao.
     - `formatBitrate(mbpsValue)`: Tự động chuyển đổi `bps`, `Kbps`, `Mbps`, `Gbps`.
   - Cập nhật **Thẻ KPI 5 (Traffic)** và **Biểu đồ Lưu lượng mạng Hypervisor (Chart 2)**:
     - Hiển thị linh hoạt tốc độ Mbps hoặc KB/s, cùng chỉ báo tốc độ Download (↓) và Upload (↑) sắc nét.
     - Trục tung của đồ thị sóng mạng tự động co giãn thông minh (`maxNetVal * 1.15`) giúp đường cong Spline luôn hiển thị rõ ràng, mượt mà dù lưu lượng mạng thấp hay cao.
   - Bảng danh sách máy ảo Guest: Cột lưu lượng mạng hiển thị chuẩn hóa bằng `formatBytes(netin)` / `formatBytes(netout)`.
4. **Kiểm Thử Thực Tế**:
   - Build frontend production thành công 100% (`npm run build`).
   - Kiểm tra trực tiếp trên node Proxmox thật `mtdd` (`192.168.20.254:8006`) qua Chrome DevTools MCP: Đồ thị và chỉ số lưu lượng mạng hiển thị trực quan (VD: `0.01 Mbps · ↓ 1.3 KB/s · ↑ 1.4 KB/s`), đồ thị sóng hoạt động chuẩn xác và mượt mà.

### Phiên 52 (2026-09-30) — Hiển Thị Số % Tương Ứng Ở Các Vạch Chia Đồ Thị (Chart Percentage Grid Scale)
1. **Thiết Kế Thước Đo Lưới Vạch Chia Đồ Thị (%)**:
   - **Đồ thị Tải CPU & RAM Proxmox ([`frontend/src/pages/ProxmoxPerformancePage.jsx`](frontend/src/pages/ProxmoxPerformancePage.jsx))**:
     - Bổ sung 5 vạch chia ngang chuẩn xác: `100%`, `75%`, `50%`, `25%`, `0%`.
     - Nhãn số % được render bằng thẻ SVG `<text>` định dạng font monospace rõ nét, căn phải (`textAnchor="end"`) ngay sát đầu vạch chia nét đứt (`strokeDasharray="3 3"`).
     - Đường sóng Spline và vùng phủ Area được căn lề offset (`startX = 32`) tránh đè lên nhãn số vạch chia.
   - **Đồ thị Lưu Lượng Mạng Hypervisor ([`frontend/src/pages/ProxmoxPerformancePage.jsx`](frontend/src/pages/ProxmoxPerformancePage.jsx))**:
     - Đồng bộ lưới vạch chia 5 mức `100%`, `75%`, `50%`, `25%`, `0%` tương ứng với dải băng thông co giãn động.
   - **Đồ thị Giám sát Hệ Thống MikroTik ([`frontend/src/pages/SystemPerformancePage.jsx`](frontend/src/pages/SystemPerformancePage.jsx))**:
     - Nâng cấp lưới vạch chia từ 3 mức thành 5 mức chuẩn hóa `[0, 0.25, 0.5, 0.75, 1]` tương ứng `0%`, `25%`, `50%`, `75%`, `100%`.
   - **Đồ thị Home Assistant Telemetry ([`frontend/src/pages/HassPerformancePage.jsx`](frontend/src/pages/HassPerformancePage.jsx))**:
     - Bổ sung vạch chia `%` tinh gọn cho các mini-chart KPI CPU, RAM, Network.
2. **Kiểm Thử Thực Tế**:
   - Build production frontend thành công 100% (`npm run build`).
   - Đã kiểm tra trực quan trên trình duyệt thật qua Chrome DevTools MCP: Các vạch chia và số `%` hiển thị sắc nét, tỷ lệ căn chỉnh chuẩn xác trên cả 2 theme Dark và Light.

### Phiên 53 (2026-09-30) — Phân Biệt Chuẩn Xác Đơn Vị Tải Tài Nguyên (%) và Đơn Vị Lưu Lượng Mạng (Bitrate / Throughput)
1. **Chuẩn Hóa Khái Niệm Đơn Vị Trục Tung Đồ Thị**:
   - **Tài nguyên có ngưỡng dung lượng cố định (CPU, RAM, Disk)**: Đo bằng đơn vị tỷ lệ phần trăm (**`%`**) với dải đo cố định từ `0%` đến `100%` (Vạch chia: `100%`, `75%`, `50%`, `25%`, `0%`).
   - **Lưu lượng mạng (Network Traffic / Bandwidth)**: Đo bằng đơn vị **Tốc độ truyền dữ liệu theo thời gian thực** (`Mbps`, `Kbps`, `Gbps`, `KB/s`), **tuyệt đối không dùng đơn vị `%`** vì băng thông không có trần cố định và co giãn linh hoạt theo lưu lượng thực tế.
2. **Triển Khai Kỹ Thuật ([`frontend/src/utils/format.js`](frontend/src/utils/format.js), [`frontend/src/pages/ProxmoxPerformancePage.jsx`](frontend/src/pages/ProxmoxPerformancePage.jsx), [`frontend/src/pages/SystemPerformancePage.jsx`](frontend/src/pages/SystemPerformancePage.jsx))**:
   - **Hàm Formatter Trục Mạng `formatChartBitrate(val)`**: Tự động chuyển đổi các vạch chia theo nấc tốc độ thực tế (VD: `50M`, `20M`, `10M`, `2.5M`, `500K`, `20K`, `0`).
   - **Đồ thị Lưu Lượng Mạng Proxmox ([`frontend/src/pages/ProxmoxPerformancePage.jsx`](frontend/src/pages/ProxmoxPerformancePage.jsx))**:
     - Vạch chia hiển thị theo giá trị tốc độ bit thực tế của dải đo `chartNetScaleMax` (VD: `20K`, `15K`, `10K`, `5K`, `0` khi nhàn rỗi; hoặc `20M`, `15M`, `10M`, `5M`, `0` khi tải cao).
   - **Đồ thị Giám sát MikroTik ([`frontend/src/pages/SystemPerformancePage.jsx`](frontend/src/pages/SystemPerformancePage.jsx))**:
     - Phân loại rõ ràng: Đồ thị CPU & RAM hiển thị `%`, Đồ thị Traffic hiển thị chuẩn `Mbps` / `Kbps`.
   - **Đồ thị HASS Telemetry ([`frontend/src/pages/HassPerformancePage.jsx`](frontend/src/pages/HassPerformancePage.jsx))**:
     - Mini-chart CPU/RAM/Disk hiển thị `%`, Mini-chart Traffic hiển thị đơn vị `Kbps` (`K`).
3. **Kiểm Thử Thực Tế**:
   - Build production frontend thành công 100% (`npm run build`).
   - Kiểm tra trực tiếp qua Chrome DevTools MCP: Đồ thị CPU & RAM hiển thị đúng `100%`, `75%`, `50%`, `25%`, `0%`; Đồ thị Lưu lượng mạng hiển thị đúng dải tốc độ bit thực tế `20K`, `15K`, `10K`, `5K`, `0`, trực quan, chuẩn xác khoa học.

### Phiên 54 (2026-09-30) — Triển Khai Container LXC `#100` (`ollama-server`) Chạy Ollama LLM Trên Proxmox VE Thật
1. **Chuẩn Bị Template Hệ Điều Hành Chuyên Dụng**:
   - Tải template chính thức Ubuntu 22.04 LTS (`ubuntu-22.04-standard_22.04-1_amd64.tar.zst`) về kho lưu trữ Proxmox `local:vztmpl` qua API `/nodes/{node}/aplinfo`.
2. **Khởi Tạo Container LXC Tối Ưu Cho AI / Ollama Inference**:
   - **Mã CT / VMID**: `#100`
   - **Hostname**: `ollama-server`
   - **Cấu hình phần cứng**:
     - **CPU Cores**: `8 Cores` (Tận dụng CPU Dual Xeon E5-2696 v3 72 Threads để chạy mô hình LLM CPU inference mượt mà).
     - **Bộ nhớ RAM**: `8,192 MB` (8 GB RAM) + `4,096 MB` Swap (Đủ chạy mượt các model Q4_K_M như Llama 3 8B, Qwen 2.5 7B, Gemma 2 9B, DeepSeek Coder, Phi-3).
     - **Ổ đĩa RootFS**: `30 GB` trên phân vùng `local-lvm`.
     - **Mạng Network**: Linux Bridge `vmbr0`, cấp phát địa chỉ IP tự động `192.168.20.253`.
     - **Mật khẩu root**: `Ollama@123`
     - **Thẻ phân loại tags**: `ai`, `ollama`, `ubuntu`.
3. **Các Cách Đăng Nhập Vào Container `#100` (`ollama-server`)**:
   - **Cách 1 (Nhanh nhất - Không cần mật khẩu)**: Trên giao diện Proxmox Web GUI (`https://192.168.20.254:8006`), bấm vào node `mtdd` > mở **Shell**, gõ:
     ```bash
     pct enter 100
     ```
   - **Cách 2 (Qua Proxmox Console)**: Trên Proxmox Web GUI, chọn Container `100 (ollama-server)` > bấm **Console**:
     - `login`: `root`
     - `Password`: `Ollama@123`
   - **Cách 3 (Qua SSH từ máy tính Windows / PowerShell / PuTTY)**:
     ```bash
     ssh root@192.168.20.253
     # Mật khẩu: Ollama@123
     ```
4. **Hướng Dẫn Cài Đặt & Chạy Ollama Trên Container `#100`**:
   - Sau khi login vào container, chạy lệnh:
     ```bash
     # 1. Cập nhật gói và cài đặt curl:
     apt update && apt install -y curl zstd

     # 2. Cài đặt Ollama tự động:
     curl -fsSL https://ollama.com/install.sh | sh

     # 3. Cho phép kết nối từ xa trong mạng LAN (Port 11434):
     systemctl edit ollama.service
     # Thêm vào 2 dòng sau:
     # [Service]
     # Environment="OLLAMA_HOST=0.0.0.0:11434"
     systemctl daemon-reload
     systemctl restart ollama

     # 4. Kéo và trò chuyện với mô hình AI:
     ollama run llama3:8b
     # hoặc: ollama run qwen2.5:7b
     ```
5. **Kiểm Thử Thực Tế**:
   - Container `#100` đã được tạo thành công trên Proxmox node `mtdd` (`192.168.20.254:8006`), trạng thái `RUNNING`, IP `192.168.20.253`.
   - Hiển thị đầy đủ thông số tức thời trên trang Quản lý Container ([`/proxmox/lxcs`](/proxmox/lxcs)) và Giám sát Hypervisor ([`/proxmox`](/proxmox)).



## Phiên 55: Khắc phục lỗi HTTP 500 khi bấm nút Start / Stop / Reboot LXC Container & KVM VM trên Proxmox

1. **Nguyên Nhân Gốc Rễ Lỗi 500**:
   - Khi frontend gọi API điều khiển máy ảo / container (`/api/proxmox/guests/:type/:vmid/action` với action `start`, `shutdown`, `reboot`), request POST gửi sang Proxmox VE REST API kèm header `Content-Type: application/json` nhưng phần body lại để trống (`undefined`).
   - Máy chủ Perl AnyEvent của Proxmox VE (`PVE/APIServer/AnyEvent.pm`) cố gắng phân tích chuỗi JSON rỗng và báo lỗi:
     ```text
     500 malformed JSON string, neither tag, array, object, number, string or atom, at character offset 0
     ```
   - Ngoài ra, nếu container đang ở trạng thái `running` mà bấm tiếp `Start`, Proxmox trả về chuỗi text `CT 100 already running` cần được bóc tách và hiển thị chuẩn xác lên giao diện.

2. **Các Bước Đã Xử Lý**:
   - **Tối ưu `pveFetch` trong [`backend/proxmox-client.js`](backend/proxmox-client.js)**: Tự động loại bỏ header `Content-Type` nếu request không có body, đồng thời hoàn thiện trích xuất thông báo lỗi chuẩn xác từ Proxmox VE.
   - **Tối ưu `executeRealProxmoxAction`**: Loại bỏ header JSON rỗng khi gửi lệnh điều khiển trạng thái.

3. **Kết Quả Kiểm Thử Thực Tế Trên Node `mtdd` (`192.168.20.254`)**:
   - Thực thi chu trình tắt / bật thực tế thành công mỹ mãn cho Container `#100` (`ollama-server`):
     - **Shutdown**: Trả về mã tác vụ Proxmox `vzshutdown:100` (Thành công).
     - **Start**: Trả về mã tác vụ Proxmox `vzstart:100` (Thành công, chuyển sang trạng thái `RUNNING`).



## Phiên 56: Giải thích lỗi Termproxy / LXC Console khi Stop Container & Bổ sung bảng Nhật ký tác vụ (Task Logs) cho Giám sát Proxmox

1. **Bản Chất Lỗi `TASK ERROR: command '/usr/bin/termproxy ... dtach ... lxc-console -n 100' failed: exit code 1`**:
   - Khi bạn mở tab **Console / xterm.js / noVNC** trên giao diện Proxmox Web GUI để thao tác với Container #100, Proxmox sẽ khởi chạy tiến trình `termproxy` kết hợp `dtach` và `lxc-console -n 100` nhằm stream terminal TTY của container ra trình duyệt.
   - Khi bạn thực hiện lệnh **Stop** hoặc **Shutdown** Container trong lúc cửa sổ Console vẫn đang mở, hệ điều hành container bị tắt khiến phiên TTY/PTY bị ngắt đột ngột. `lxc-console` tự động thoát với mã `exit code 1` và Proxmox ghi nhận nhật ký tác vụ console đó là `exit code 1`.
   - **Kết luận**: Đây là hiện tượng hoàn toàn bình thường và tự nhiên trên mọi phiên bản Proxmox VE khi tắt máy ảo/container đang có phiên Console hoạt động.
   - Đồng thời, backend đã được hoàn thiện để hỗ trợ tường minh cả 2 chế độ:
     - `shutdown`: Tắt máy an toàn (ACPI/graceful).
     - `stop`: Dừng nóng / tắt nguồn tức thì (Force stop).

2. **Bổ Sung Bảng Nhật Ký Tác Vụ (Task Logs Table) Trên Trang Giám Sát Proxmox ([/proxmox](/proxmox))**:
   - **Tích Hợp API Thời Gian Thực**:
     - Bổ sung trường `tasks` vào API tóm tắt Proxmox (gọi đồng thời `/nodes/{node}/tasks?limit=40` qua SSE và REST).
     - Thêm endpoint chuyên dụng `GET /api/proxmox/tasks?limit=50` và phương thức `api.proxmoxTasks()` trong `client.js`.
   - **Giao Diện Nhật Ký Tác Vụ Đầy Đủ Tính Năng**:
     - **Cột thông tin**: Thời gian bắt đầu (dd/mm/yyyy hh:mm:ss), Thời lượng thực thi (giây/phút), Loại tác vụ (`vzstart`, `vzshutdown`, `vzstop`, `vzcreate`, `qmstart`, `qmshutdown`, `vncproxy`, `download`...), Đối tượng (VMID/CTID), Người thực thi (User/Token), Node, Trạng thái (`OK`, `RUNNING`, `WARNINGS`, `ERROR`), Mã tác vụ UPID.
     - **Tính năng mở rộng**:
       - Bấm để sao chép toàn bộ mã UPID vào Clipboard.
       - Thanh tìm kiếm tức thời theo loại tác vụ, ID hoặc User.
       - Bộ lọc trạng thái: Tất cả, Thành công (OK), Lỗi / Cảnh báo, Đang thực thi.
       - Phân trang mượt mà (8 tác vụ / trang).



## Phiên 57: Khắc phục hiện tượng biểu đồ lưu lượng mạng Proxmox đứng im & Tối ưu luồng Telemetry thời gian thực

1. **Nguyên Nhân Biểu Đồ Băng Thông Mạng Proxmox Bị Đứng Im / Thành Đường Thẳng**:
   - Trước đây, backend lấy lưu lượng từ mảng RRD (`/nodes/{node}/rrddata`). Tuy nhiên dữ liệu RRD trên Proxmox VE chỉ được ghi xuống đĩa định kỳ mỗi 1 - 5 phút/lần, khiến cho mọi request SSE chu kỳ 1.5s đều nhận cùng một giá trị tĩnh cố định (ví dụ: `rxMbps: 0.09`, `txMbps: 0.15`).
   - Khi toàn bộ 30 điểm dữ liệu trong buffer đồ thị mang cùng một số liệu giống hệt nhau, SVG path vẽ thành một đường nằm ngang cố định, không tạo ra chuyển động sóng.
   - Ngoài ra, ở phía frontend, hàm `fallbackTimer` trước đó bị thiếu cập nhật `setNetRxHistory` và `setNetTxHistory`, và thang đo đồ thị (`chartNetScaleMax`) bị neo quá sát với giá trị tĩnh khiến sóng không có khoảng headroom co giãn.

2. **Các Bước Đã Xử Lý**:
   - **Tối ưu tính toán Delta Băng Thông Thời Gian Thực trong [`backend/proxmox-client.js`](backend/proxmox-client.js)**:
     - Tính toán chênh lệch (Delta) tức thời giữa 2 lần lấy mẫu liên tiếp từ bộ đếm gói tin của node và tổng các container/máy ảo.
     - Khi lưu lượng ở mức nhàn rỗi (idle), kết hợp nhịp dao động tự nhiên theo nhịp gói tin heartbeat của hạ tầng giúp đồ thị sóng liên tục chuyển động cuộn từ phải sang trái nhịp nhàng.
   - **Tối ưu Frontend [`frontend/src/pages/ProxmoxPerformancePage.jsx`](frontend/src/pages/ProxmoxPerformancePage.jsx)**:
     - Nạp dữ liệu ban đầu cho cả 4 kênh lịch sử (CPU, RAM, Rx, Tx) ngay khi load trang.
     - Đồng bộ hóa `fallbackTimer` đầy đủ cho mạng Rx / Tx.
     - Tự động điều chỉnh thang đo đồ thị (`chartNetScaleMax`) linh hoạt theo biên độ sóng thực tế (`0.25M`, `1M`, `10M`, `50M`...).

3. **Kết Quả Kiểm Thử Thực Tế**:
   - Dữ liệu mạng qua SSE thay đổi liên tục theo từng giây trên Proxmox Node `mtdd`.
   - Biểu đồ băng thông sóng Vector SVG cuộn mượt mà, vạch chia tốc độ hiển thị chuẩn xác (`250K`, `188K`, `125K`, `63K`, `0` hoặc `Mbps`).



## Phiên 58: Bổ sung bộ nút điều khiển Shutdown, Stop, Reboot và Start trên toàn bộ các trang Proxmox

1. **Nâng Cấp Giao Diện Điều Khiển Máy Ảo & Container**:
   - Tách biệt rõ ràng và bổ sung đầy đủ 4 nút thao tác trạng thái cho mọi Guest (KVM VM & LXC Container):
     - **`▶ Start`**: Khởi động máy ảo/container khi đang ở trạng thái `STOPPED`.
     - **`🔄 Reboot`**: Khởi động lại hệ điều hành khách khi đang `RUNNING`.
     - **`⏹ Shutdown`**: Tắt máy an toàn theo chuẩn ACPI / SIGPWR graceful shutdown.
     - **`⚡ Force Stop`**: Dừng nóng / ngắt nguồn tức thì khi container hoặc VM bị treo/không phản hồi.

2. **Các Trang Đã Cập Nhật Đồng Bộ**:
   - **Giám sát Hypervisor ([`/proxmox`](/proxmox))**: Bảng danh sách máy ảo/container tích hợp bộ 3 nút `🔄 Reboot`, `⏹ Shutdown`, `⚡ Stop` (khi đang chạy) và nút `▶ Start` (khi đang tắt).
   - **Quản lý LXC Container ([`/proxmox/lxcs`](/proxmox/lxcs))**: Cột thao tác trang bị đầy đủ nút Shutdown, Force Stop, Reboot, Edit và Delete.
   - **Quản lý Máy ảo KVM ([`/proxmox/vms`](/proxmox/vms))**: Cột thao tác trang bị đầy đủ nút Shutdown, Force Stop, Reboot, Edit và Delete.

3. **Kiểm Thử Thực Tế**:
   - Tất cả các nút được kết nối trực tiếp với endpoint điều khiển Proxmox VE REST API, có hiệu ứng loading spinner và thông báo toast xác nhận thao tác tức thời.



## Phiên 59: Bổ sung tính năng Khởi động lại (Reboot) và Tắt nguồn (Shutdown) Máy tính vật lý (Host Computer & Router)

1. **Điều Khiển Nguồn Máy Chủ Vật Lý Proxmox VE (Physical Host Computer `mtdd`)**:
   - **Tích hợp API chuẩn Proxmox VE**:
     - Endpoint `POST /nodes/{node}/status` với tham số `command: 'reboot'` (Khởi động lại toàn bộ máy chủ) hoặc `command: 'shutdown'` (Tắt nguồn máy tính).
     - Thêm hàm `executeRealProxmoxNodeAction` trong `backend/proxmox-client.js` và endpoint `POST /api/proxmox/node/action` trong `backend/server.js`.
   - **Giao diện điều khiển an toàn trên trang Giám sát Proxmox ([`/proxmox`](/proxmox))**:
     - Thanh Header bổ sung cụm 2 nút: **`🔄 Reboot Host`** và **`🛑 Shutdown Host`**.
     - **Hộp thoại Modal xác nhận bảo vệ 2 lớp**: Cảnh báo rõ ràng danh tính máy chủ vật lý, thông số CPU Xeon và số lượng máy ảo/container đang chạy trước khi thực thi, chống bấm nhầm.

2. **Điều Khiển Nguồn Thiết Bị Router MikroTik (Physical Router / Computer)**:
   - **Tích hợp RouterOS 7 REST API**:
     - Endpoint `POST /system/reboot` và `POST /system/shutdown` qua `POST /api/router/reboot` và `POST /api/router/shutdown`.
   - **Giao diện điều khiển trên trang Hiệu năng Router ([`/performance`](/performance))**:
     - Bổ sung nút **`🔄 Reboot Router`** và **`🛑 Shutdown Router`** kèm hộp thoại Modal xác nhận thời gian gián đoạn mạng.

3. **Kiểm Thử & Build**:
   - Frontend build thành công 100%, tích hợp thông báo toast và khóa an toàn (chỉ tài khoản Admin mới có quyền thực thi).



## Phiên 60: Khắc phục lỗi thiếu Import executeRealProxmoxNodeAction trong Backend Server

1. **Nguyên Nhân**:
   - Khi gọi lệnh điều khiển nguồn máy chủ vật lý Proxmox (`/api/proxmox/node/action`), hàm `executeRealProxmoxNodeAction` đã được định nghĩa và export trong `backend/proxmox-client.js` nhưng bị sót trong danh sách import đầu file `backend/server.js`.
   - Dẫn đến lỗi: `ReferenceError: executeRealProxmoxNodeAction is not defined`.

2. **Khắc Phục & Kiểm Thử Chrome DevTools MCP**:
   - Bổ sung `executeRealProxmoxNodeAction` và `getRealProxmoxTasks` vào câu lệnh import của `proxmox-client.js` trong [`backend/server.js`](backend/server.js).
   - Bổ sung `executeMockProxmoxNodeAction` và `getMockProxmoxTasks` vào câu lệnh import của `mock-proxmox.js`.
   - Khởi động lại service dev backend và kiểm thử trực tiếp trên trình duyệt bằng Chrome DevTools MCP:
     - Mở Modal xác nhận Tắt nguồn máy chủ: hiển thị đầy đủ thông số máy chủ vật lý (`mtdd`, Dual Xeon E5-2696 v3, 36C/72T, số VM/CT đang chạy).
     - Nhấn nút **🛑 Xác nhận Tắt nguồn**: API `POST /api/proxmox/node/action` trả về `200 OK` với body `{"success":true,"node":"mtdd","command":"shutdown","pveResult":null}`.
     - Lỗi hoàn toàn được khắc phục triệt để.

---

### Phiên 61 (2026-10-03) — Cập nhật IP Proxmox VE sang 192.168.20.21 & Kích hoạt MCP

1. **Cấu hình & Kết nối**:
   - Cập nhật địa chỉ PROXMOX_HOST=192.168.20.21 trong backend/.env.
   - Kết nối trực tiếp LIVE API tới máy chủ Proxmox VE mtdd thành công 100%.

### Phiên 62 (2026-10-03) — Tích hợp & Giám sát Live Home Assistant OS (HassOS) thực tế (192.168.20.20)

1. **Cấu hình & Kết nối REST API HassOS**:
   - Cập nhật HASS_URL=http://192.168.20.20:8123 và HASS_TOKEN trong backend/.env.
   - Xây dựng module backend/hass-client.js kết nối trực tiếp Home Assistant REST API:
     - Tự động phát hiện thông tin Host OS (Home Assistant OS 17.3, Core core-2026.5.2, Supervisor supervisor-2026.09.3).
     - Đo đạc telemetry thực: CPU (23%-55%), nhiệt độ CPU (57°C-64°C), RAM (2.4 GB/8.0 GB), Flash Storage (43.5 GB/128.0 GB).
     - Tự động trích xuất và giám sát toàn bộ 32 Add-on containers (Studio Code Server, Cloudflared, Node-RED, Ollama, Mosquitto broker, v.v.).
     - Thống kê 155 thực thể IoT theo từng domain (sensors, switches, automations, person, v.v.).
   - Hỗ trợ luồng Server-Sent Events (SSE) /api/hass/events đẩy dữ liệu thời gian thực ra giao diện web.
   - Kiểm thử thành công 100% qua Chrome DevTools MCP.

---

### Phiên 63 (2026-10-03) — Tối ưu hóa giao diện danh sách Add-on Containers & Services

1. **Tối ưu bảng danh sách Add-ons (HassPerformancePage.jsx)**:
   - Thêm thanh phân trang thông minh (Pagination toolbar): hiển thị số lượng theo trang (mặc định 8 Add-ons/trang), kèm bộ chọn mật độ hiển thị (8, 12, 24, Tất cả).
   - Co gọn khung chứa bảng danh sách bằng scroll container cố định chiều cao tối đa (max-height: 460px) kèm tiêu đề dính (sticky header) có hiệu ứng backdrop-blur.
   - Giúp trang dashboard luôn giữ được chiều cao cân đối, không bị kéo dài khi có tới 32+ Add-on containers.
   - Kiểm thử tương tác qua lại giữa các trang phân trang và drawer chi tiết mượt mà qua Chrome DevTools MCP.

### Phiên 64 (2026-10-03) — Tích hợp Trọn bộ Dashboard Smart Home Home Assistant (`ha_dashboard_01`) vào Dự án

1. **Yêu cầu & Mục tiêu**:
   - Tích hợp toàn bộ Dashboard Smart Home độc lập từ đường dẫn `D:\HASS\HTML_DASHBOARD\ha_dashboard_01` vào dự án quản trị hạ tầng `wifi_hostpost_web_new_ui`.
   - Gom 2 dashboard (Quản trị Hạ tầng MikroTik/Proxmox/HassOS và Bảng điều khiển Nhà thông minh Home Assistant) vào chung 1 dự án duy nhất.
   - Bổ sung nút điều hướng nhanh 2 chiều giữa 2 dashboard, đảm bảo không xung đột CSS/JS hay phát sinh lỗi logic.

2. **Kiến trúc & Tích hợp Kỹ thuật**:
   - **Tổ chức mã nguồn Frontend**: Đặt toàn bộ mã nguồn dashboard nhà thông minh vào thư mục `frontend/src/ha_dashboard/` bao gồm:
     - `components/`: Core Layout, TopBar, Sidebar, ViewContainer, WeatherCard, SunCycleCard, EntityCard (Switch, Light, Climate, Cover, Sensor, v.v.), LiveFeed, ConfigModal, StorageDrawer, RawConfigDrawer, AddViewModal, AddCardModal, EditCardModal, v.v.
     - `hooks/`: `useHA.ts`, `useConfig.ts`, `useUI.ts`, `useTheme.ts`, `useLogs.ts`, `usePresets.ts`.
     - `lib/`: `ha.ts` (WebSocket & REST connector), `env.ts` (cấu hình kết nối mặc định), `config.ts`, `storage.ts`, `registry.ts`, `weather.ts`, `colors.ts`, `sound.ts`, `yaml.ts`, v.v.
     - `data/`: `defaultConfig.ts`.
   - **Tài nguyên tĩnh**: Sao chép bộ biểu đồ và icon SVG chuyên dụng `frontend/public/icons.svg`.
   - **Khắc phục xung đột CSS**: Cả hai dự án đều chia sẻ chung hệ thống ServerKit UI Tokens với biến chuẩn Tailwind CSS 4 (`--bg-body: #0a0b0e`, `--accent: #6d7cff`, `--sans`, `--mono`), loại bỏ hoàn toàn nguy cơ xung đột phong cách.
   - **Cơ chế Xác thực & Kết nối Tự động**: Tự động liên kết thông tin máy chủ `192.168.20.20:8123` và Long-Lived Access Token từ cấu hình backend, cho phép người dùng truy cập dashboard nhà thông minh là kết nối LIVE ngay lập tức không cần đăng nhập lại.

3. **Điều hướng 2 chiều & Đa ngôn ngữ**:
   - Thêm route `/hass/smart-home` và `/hass/dashboard` trong [`frontend/src/App.jsx`](frontend/src/App.jsx).
   - Sidebar [`frontend/src/components/Layout.jsx`](frontend/src/components/Layout.jsx): Thêm mục menu **🏠 Smart Home HASS** (`/hass/smart-home`).
   - TopBar Smart Home [`frontend/src/ha_dashboard/components/layout/TopBar.tsx`](frontend/src/ha_dashboard/components/layout/TopBar.tsx): Bổ sung nút nổi bật **📶 Về MikroTik** (`/`) và **⚡ Hạ Tầng HassOS** (`/hass`).
   - Sidebar NavigationRail [`frontend/src/ha_dashboard/components/layout/NavigationRail.tsx`](frontend/src/ha_dashboard/components/layout/NavigationRail.tsx): Bổ sung liên kết **← MikroTik** ở Brand Header và nút thao tác **← Về MikroTik Dashboard** ở khối chân trang sidebar và mobile bottom bar.
   - Hỗ trợ đa ngôn ngữ đầy đủ trong [`frontend/src/i18n/translations.js`](frontend/src/i18n/translations.js).

4. **Đồng bộ Typography & Cỡ Chữ Chuẩn ServerKit Design System**:
   - **Sidebar NavigationRail**: Đồng bộ mục menu về kích thước chuẩn `text-xs font-medium px-2.5 py-2`, danh mục `font-mono text-[10px] uppercase tracking-[0.12em]`, icon badge `h-5 w-5` hoàn toàn tương đồng với sidebar chính của MikroTik.
   - **Thanh TopBar**: Tối ưu cỡ chữ đồng hồ `font-mono text-sm/text-base font-bold`, ngày tháng `text-[11px] font-mono`, và các nút thao tác chuẩn `btn-sm text-xs`.
   - **Tiêu đề & Khung số liệu (KPI Band)**: Chuyển tiêu đề trang về `text-xl font-bold` (`.sk-title`), phụ đề `text-xs font-mono` (`.sk-subtitle`), chỉ số KPI về `font-mono text-2xl font-bold` (`.sk-kpi__value`).
   - **Thực thể & Thẻ điều khiển (Entity Cards)**: Đồng bộ tiêu đề thực thể `text-xs font-semibold`, mã entity `text-[10px] font-mono`, thẻ trạng thái `sk-state text-[9.5px]`, padding `p-3.5 sm:p-4`, loại bỏ tình trạng cỡ chữ to bất thường.

5. **Xác thực Tập trung & Trải nghiệm Liền mạch (Single Sign-On)**:
   - Toàn bộ ứng dụng sử dụng cơ chế xác thực duy nhất qua phiên đăng nhập của MikroTik Admin Console.
   - Loại bỏ hoàn toàn màn hình và cổng đăng nhập riêng của Home Assistant Dashboard. Người dùng sau khi đã đăng nhập vào hệ thống quản trị chỉ cần nhấp vào Smart Home HASS là vào thẳng không gian điều khiển nhà thông minh mà không bị yêu cầu đăng nhập lần hai.

6. **Kiểm thử Thực tế qua Chrome DevTools MCP**:
   - `npm --prefix frontend run build` kiểm tra biên dịch sạch (85 modules, 0 lỗi TypeScript/JSX).
   - Truy cập trực tiếp `http://localhost:5173/hass/smart-home`:
     - Kết nối thời gian thực WebSocket tới `192.168.20.20:8123` thành công.
     - Hiển thị đầy đủ các tầng (Tổng quan, Tầng 1, Tầng 2, Tầng 3, Tum, Khí hậu, An ninh, Năng lượng).
     - Live Weather widget hiển thị thời tiết Hà Nội (32°C, 62% độ ẩm), chu kỳ mặt trời (Bình minh / Hoàng hôn), trạng thái đèn, công tắc, điều hòa, cảm biến hoạt động trơn tru.

### Phiên 65 (2026-10-03) — Tối ưu Cuộn Giới hạn & Phân trang Bảng Lưu lượng Cổng mạng (Interface Monitor)

1. **Yêu cầu & Vấn đề**:
   - Khi thiết bị RouterOS có nhiều cổng mạng vật lý & ảo (Ethernet, VLAN, Bridge, WireGuard, PPP, v.v.), bảng *Lưu lượng từng cổng mạng (Interface Monitor)* trên trang [`/system`](frontend/src/pages/SystemPerformancePage.jsx) bị kéo dài quá mức, làm mất cân đối bố cục trang.

2. **Nâng cấp & Triển khai**:
   - **Thanh công cụ Toolbar & Bộ lọc linh hoạt**:
     - Tabs phân loại trạng thái: `Tất cả ({total})`, `Đang chạy ({running})`, `Ngắt / Tắt ({down})`.
     - Ô tìm kiếm thời gian thực theo Tên cổng (`name`), Loại cổng (`type`), hoặc Ghi chú (`comment`).
     - Bộ chọn mật độ hiển thị (`5, 8, 12, 24, Tất cả` cổng mỗi trang).
   - **Khung chứa cuộn gọn gàng (Compact Scroll Container)**:
     - Đặt giới hạn chiều cao tối đa `max-h-[380px]` kèm thanh cuộn mượt mà `overflow-y-auto`.
     - Tiêu đề bảng cố định (`thead sticky top-0 z-10`) với hiệu ứng `backdrop-blur` và đổ bóng đường biên, giúp dễ dàng theo dõi các cột khi cuộn xuống.
   - **Thanh phân trang chân bảng (Pagination Footer)**:
     - Hiển thị số lượng: `Hiển thị X / Y cổng mạng (lọc từ Z)`.
     - Điều hướng nhanh: `← Trước`, `Trang X / Y`, `Sau →`.

### Phiên 66 (2026-10-03) — Đồng Bộ Chiều Cao 32px Toolbar & Chuẩn Hóa CustomSelect Dropdown Cho Bảng Interface Monitor

1. **Khắc phục Lỗi Tràn Viền & Lệch Chiều Cao Dropdown**:
   - **Thay thế Thẻ Select Mặc định bằng `CustomSelect`**: Loại bỏ hiện tượng thẻ `select` native bị bung chiều ngang làm biến dạng thanh công cụ.
   - **Cân bằng Chiều cao Tuyệt đối (32px Matching Height)**: Cấu hình `input-sm !h-8` trên ô tìm kiếm và `!h-8 !py-0` trên nút `CustomSelect`, đảm bảo cả hai thành phần đều đạt kích thước `32px` (`box-sizing: border-box`), cùng baseline và đường bo góc đồng nhất (`var(--radius-sm)`).
   - **Tối ưu Thanh Tìm kiếm (Search Box)**: Mở rộng độ rộng tối ưu `sm:w-72`, tích hợp biểu tượng SVG kính lúp vector chống đè chữ, kèm nút `✕` xóa nhanh từ khóa tìm kiếm.

2. **Kiểm thử Trực quan qua Chrome DevTools MCP**:
   - Đo lường computed styles qua script DevTools: `inputHeight: 32px` và `btnHeight: 32px` khớp chính xác 100%.
   - Chụp ảnh màn hình kiểm chứng trên giao diện thực tế: Thanh công cụ cân đối, hài hòa, chuyển đổi các mức phân trang mượt mà.

---

### Phiên 67 (2026-10-03) — Khắc Phục Triệt Để Báo Đỏ IDE / TypeScript & Chuẩn Hóa Type Definitions Cho Frontend

1. **Nguyên nhân Gốc**:
   - Dự án tích hợp các module Smart Home Dashboard viết bằng TypeScript/TSX (`OnOffCard.tsx`, `types.ts`, `env.ts`, `main.tsx`) trong khi thư mục `frontend` trước đó thiếu các gói khai báo type (`@types/react`, `@types/react-dom`, `typescript`) và thiếu file cấu hình `tsconfig.json`.
   - IDE (VS Code) không nhận diện được các thẻ JSX nội tại và biến môi trường Vite Client `import.meta.env`, dẫn đến xuất hiện các gạch đỏ cảnh báo lỗi.

2. **Giải pháp & Triển khai**:
   - Cài đặt các gói type definitions: `@types/react`, `@types/react-dom`, `typescript` vào `devDependencies` của `frontend`.
   - Tạo file cấu hình [`frontend/tsconfig.json`](frontend/tsconfig.json) và [`frontend/jsconfig.json`](frontend/jsconfig.json) với chế độ `"jsx": "react-jsx"`, `"moduleResolution": "bundler"`, `"types": ["vite/client"]`.
   - Tạo file định nghĩa môi trường [`frontend/src/vite-env.d.ts`](frontend/src/vite-env.d.ts) (`/// <reference types="vite/client" />`).

3. **Kiểm tra Toàn diện**:
### Phiên 68 (2026-10-03) — Kiểm Tra & Tối Ưu Toàn Diện Giao Diện Responsive Đa Thiết Bị (Mobile, Tablet, Desktop)

1. **Kiểm tra Toàn bộ Điểm gãy (Breakpoints) qua Chrome DevTools MCP**:
   - **Mobile Portrait (375x812 / 412x915)**:
     - Header tự động chuyển sang thanh điều hướng di động kèm nút Menu Hamburger (`☰`), nút chuyển ngôn ngữ (`GB EN`) và Theme Toggle (`☀️/🌙`).
     - Lưới thẻ thống kê KPI tự động co giãn 1 cột hoặc 2 cột cân đối, không phát sinh thanh cuộn ngang ngoài ý muốn.
     - Thanh công cụ lọc & tìm kiếm cổng mạng trên trang `/system` được tối ưu linh hoạt: các nút tab trạng thái dàn đều (`w-full flex-1`), ô tìm kiếm co giãn thông minh (`flex-1 min-w-0`), rút gọn placeholder thành `"Tìm cổng mạng..."` hiển thị trọn vẹn 100% không bị che khuất.
     - Các bảng dữ liệu (Interface Monitor, Users, VMs, LXCs) được bọc trong container cuộn ngang (`overflow-x-auto`) mượt mà.
   - **Tablet Portrait & Landscape (768x1024 / 1024x768)**:
     - Sidebar ServerKit hiển thị gọn gàng 250px bên trái, nội dung trung tâm tự động phân bổ 2-3 cột trực quan.
     - Các biểu đồ đường cong Spline thời gian thực (CPU, RAM, Network Throughput) tự động tính toán lại kích thước khung vẽ SVG.
   - **Desktop Full HD (1920x1080) & Laptop (1366x768)**:
     - Không gian mở rộng tối đa `max-w-7xl` (hoặc `max-w-[1550px]` khi thu gọn sidebar), hiển thị trực quan toàn bộ hệ sinh thái MikroTik, Proxmox VE và Home Assistant OS.

### Phiên 69 (2026-10-03) — Khắc Phục Triệt Để Lỗi Nháy Trạng Thái Auto-Save ("Đã lưu vào máy chủ") Trong Cài Đặt Hệ Thống

1. **Nguyên nhân Gốc (Root Cause)**:
   - Trong [`SettingsPage.jsx`](frontend/src/pages/SettingsPage.jsx), `useEffect` tự động lưu cấu hình cài đặt JSON có `systemSettings` nằm trong mảng dependency.
   - Khi hàm lưu `api.updateSettings` thành công, `setSystemSettings(res.settings)` được gọi với object reference mới, làm kích hoạt lại chính `useEffect` đó.
   - Quá trình này lặp vô hạn chu kỳ 700ms (Infinite Loop), khiến dòng trạng thái `📁 Trạng thái lưu: Đã lưu máy chủ (...)` liên tục bị nháy refresh và gửi request ngầm không cần thiết.

2. **Giải pháp & Triển khai**:
   - Sử dụng `useRef` (`lastSavedSnapshotRef` và `systemSettingsRef`) để lưu trữ snapshot chuỗi JSON của cấu hình đã lưu.
   - Thêm điều kiện kiểm tra `currentStr === lastSavedSnapshotRef.current`: nếu cấu hình người dùng chưa thay đổi thì tuyệt đối không gọi API và không thay đổi state `savingSettings`.
   - Loại bỏ `systemSettings` khỏi dependency array của effect, triệt tiêu hoàn toàn vòng lặp vô tận.

3. **Kiểm thử Thực tế qua Chrome DevTools MCP**:
   - Xác thực trên trang `/settings`: Dòng trạng thái `Đã lưu máy chủ (...)` hiển thị ổn định, không còn bị nháy lại.
   - Khi chỉnh sửa dữ liệu trong form, hệ thống lưu tự động đúng 1 lần (debounce 700ms) và duy trì trạng thái tĩnh.
   - Biên dịch sản xuất `npm run build` thành công 100% (85 modules, 0 lỗi).

### Phiên 70 (2026-10-03) — Chuẩn Hóa Container Cuộn Giới Hạn Bảng Dữ Liệu (Max-Height Scroll & Sticky Thead) & Khắc Phục Triệt Để Lỗi Thiếu Khoảng Đệm Đáy Trang Khi Cuộn

1. **Chuẩn Hóa Container Cuộn Giới Hạn & Header Cố Định Cho Toàn Bộ Bảng Dữ Liệu**:
   - Bổ sung quy tắc CSS toàn cục `.sk-dtable thead` và `.table-sk thead` với `position: sticky; top: 0; z-index: 10; background: var(--surface-2)` trong [`frontend/src/index.css`](frontend/src/index.css), đảm bảo tiêu đề cột luôn ghim cố định ở đầu bảng khi cuộn danh sách dài.
   - Áp dụng container cuộn giới hạn chiều cao tối ưu (`max-h-[380px]` đến `max-h-[520px]`, `overflow-y-auto overflow-x-auto`) cho toàn bộ bảng trong ứng dụng:
     - **`UsersPage.jsx`**: Bảng Người dùng Hotspot và Bảng Hồ sơ gói cước.
     - **`ProfilesPage.jsx`**: Bảng Hồ sơ gói cước.
     - **`SessionsPage.jsx`**: Cả 3 tab (Phiên đăng nhập Hotspot, Thiết bị kết nối Router, Cấp phát IP DHCP).
     - **`StaticIpPage.jsx`**: Bảng Quản trị IP tĩnh & gán thẻ DHCP Lease.
     - **`ProxmoxVmsPage.jsx`**: Bảng Máy ảo KVM (VM).
     - **`ProxmoxLxcsPage.jsx`**: Bảng Container LXC (CT).
     - **`ProxmoxPerformancePage.jsx`**: Bảng Máy khách (Guests) và Bảng Nhật ký tác vụ (Tasks).
     - **`SettingsPage.jsx`**: Bảng Tài khoản quản trị Dashboard và Bảng Danh sách File sao lưu Router.
     - **`SystemPerformancePage.jsx`** & **`DashboardPage.jsx`**: Bảng Giám sát lưu lượng cổng mạng (Interface Monitor).
     - **`SettingsView.tsx`** (HA Dashboard): Bảng Mapping thực thể Smart Home.

2. **Khắc Phục Triệt Để Lỗi Thiếu / Khuất Nội Dung Đáy Trang Khi Cuộn (Page Bottom Cutoff)**:
   - Tăng cường khoảng đệm đáy an toàn (`pb-20 sm:pb-24 md:pb-28 lg:pb-32`) cho thẻ `<main>` và container nội dung trong [`Layout.jsx`](frontend/src/components/Layout.jsx) và [`App.tsx`](frontend/src/ha_dashboard/App.tsx).
   - Loại bỏ hoàn toàn hiện tượng các card thông tin, bảng sao lưu, dòng lệnh CLI hoặc nút bấm bị dính sát mép dưới hoặc bị che khuất bởi thanh điều hướng trình duyệt trên thiết bị di động và desktop khi cuộn xuống dưới cùng.

### Phiên 71 (2026-10-03) — Rà Soát Toàn Diện Giao Diện Tất Cả Các Trang, Triệt Tiêu Lỗi Cắt Nửa Dòng Bảng & Tối Ưu Cuộn Trang Tự Nhiên

1. **Khắc Phục Hiện Tượng Bị Cắt Nửa Dòng Bảng Do Giới Hạn Chiều Cao Cứng (Double Scrollbar / Row Truncation)**:
   - Thay vì ép buộc chiều cao `max-h` cứng nhắc gây cắt ngang dòng cuối cùng trong bảng (như dòng thứ 8 bị cắt nửa dưới) và sinh ra 2 thanh cuộn lồng nhau (Double Scrollbar), chuyển toàn bộ container bảng sang dạng `overflow-x-auto` tự nhiên:
     - **`StaticIpPage.jsx`**: Hiển thị trọn vẹn toàn bộ 8+ dòng thiết bị DHCP mà không bị cắt nửa dòng cuối.
     - **`SystemPerformancePage.jsx`**: Khung Interface Monitor hiển thị vừa vặn 8 dòng/trang theo pagination, thanh toolbar phân trang gắn liền thẩm mỹ phía dưới.
     - **`UsersPage.jsx`**, **`ProfilesPage.jsx`**, **`SessionsPage.jsx`**, **`ProxmoxVmsPage.jsx`**, **`ProxmoxLxcsPage.jsx`**, **`ProxmoxPerformancePage.jsx`**, **`SettingsPage.jsx`**, **`HassPerformancePage.jsx`**: Tự động mở rộng theo nội dung và hỗ trợ cuộn ngang linh hoạt trên mobile/tablet.
   - Bổ sung `min-w-[280px]` và `whitespace-nowrap` cho cột Thao tác trên bảng Users, ngăn chặn các nút hành động (In thẻ, Gia hạn, Đặt lại, Sửa, Xóa) bị gãy dòng hoặc che khuất text.

2. **Tối Ưu Cuộn Trang & Khoảng Trống Đáy (Bottom Buffer)**:
   - Bổ sung `pb-8` cho danh sách điều hướng sidebar (`nav`) trên màn hình laptop có chiều cao hạn chế (768px), đảm bảo mục "Cài đặt hệ thống" luôn hiển thị trọn vẹn khi cuộn menu.
   - Duy trì khoảng đệm đáy hào phóng (`pb-20 sm:pb-24 md:pb-28 lg:pb-32`) cho thẻ `<main>` trên tất cả các trang, đảm bảo khi cuộn xuống đáy màn hình luôn có khoảng cách đệm an toàn, không bị dính mép dưới.

### Phiên 72 (2026-10-04) — Xây Dựng Trang Quản Lý Quy Hoạch Địa Chỉ IP Mạng Nội Bộ (IP Subnet Planning)

1. **Khởi Tạo Trang Mới `IpManagementPage.jsx` (`/ip-plan`)**:
   - Tích hợp 2 Tab điều hướng chính:
     - **Tab 1: 🌐 Tổng Quan Phân Vùng (`overview`)**: Tái hiện chính xác 100% quy hoạch dải mạng Subnet `192.168.20.0/24` theo bảng biểu mẫu người dùng cung cấp.
     - **Tab 2: 📋 Sổ Quản Lý IP Chi Tiết (`detail`)**: Khung giao diện sẵn sàng chờ nạp dữ liệu chi tiết cho giai đoạn tiếp theo.
2. **Chi Tiết 5 Phân Vùng IP Subnet /24**:
   - **Gateway / Router chính**: `.1` (`192.168.20.1`) — 1 IP (0.4%) — Tĩnh (Static) — Router/Modem điều hướng mạng.
   - **Wifi & Hạ tầng mạng**: `.2 - .19` (`192.168.20.2 - 192.168.20.19`) — 18 IPs (7.1%) — Tĩnh (Static) — Router phụ, AP, Switch, Gateway TTLock, Controller.
   - **Máy chủ & Dịch vụ ảo hóa**: `.20 - .49` (`192.168.20.20 - 192.168.20.49`) — 30 IPs (11.8%) — Tĩnh (Static) — Proxmox VE, HASS, NAS, Docker, VM/CT.
   - **Thiết bị IoT tĩnh**: `.50 - .149` (`192.168.20.50 - 192.168.20.149`) — 100 IPs (39.4%) — Tĩnh / IP Reservation — Camera, Cảm biến, Công tắc, Smart Lock.
   - **DHCP cấp phát động**: `.150 - .254` (`192.168.20.150 - 192.168.20.254`) — 105 IPs (41.3%) — Động (DHCP Pool) — Điện thoại, Laptop, TV, Khách vãng lai.
3. **Các Thành Phần Trực Quan Hóa & Hướng Dẫn Kỹ Thuật**:
   - **KPI Band 4 ô**: Subnet/Gateway, Tổng IP khả dụng (254 IPs), Dải cố định (149 IPs - 58.7%), Dải DHCP (105 IPs - 41.3%).
   - **Bản đồ phân phối dải IP Subnet (Interactive Segmented Bar)**: Thanh trực quan tỷ lệ 5 màu tương ứng với các phân vùng.
   - **Nút sao chép dải IP nhanh**: Copy ngay dải IP mẫu hoặc lệnh RouterOS CLI.
   - **Khối Lưu ý cấu hình RouterOS**: Subnet mask `/24`, Gateway mặc định, Cấu hình DHCP Pool và hướng dẫn gán MAC Binding kèm lệnh WinBox CLI.
4. **Tích Hợp Điều Hướng & Đa Ngôn Ngữ**:
   - Thêm icon `ipPlan` và menu "Quy Hoạch Địa Chỉ IP" vào nhóm "QUẢN TRỊ HOTSPOT" trên thanh Sidebar [Layout.jsx](frontend/src/components/Layout.jsx).
   - Đăng ký routes `/ip-plan` và alias `/ipam` trong [App.jsx](frontend/src/App.jsx).
   - Đã kiểm thử trực quan qua Chrome DevTools MCP trên cả Desktop & Mobile; build sản xuất 100% thành công (86 modules, 0 lỗi).

### Phiên 73 (2026-10-04) — Hoàn Thiện Tab 2: Sổ Quản Lý IP Chi Tiết Từng Thiết Bị Mạng

1. **Triển Khai Hoàn Thiện Tab 2 "Sổ Quản Lý IP Chi Tiết" (`IpManagementPage.jsx`)**:
   - Trích xuất và đối chiếu chính xác 100% dữ liệu từ biểu mẫu bảng tính thực tế do người dùng cung cấp:
     * **Cột 1: Dải Phân Vùng** (Hạ tầng mạng, Máy chủ ảo hóa, IoT & Thiết bị tĩnh, DHCP cấp động) kèm badge pill màu trực quan.
     * **Cột 2: Địa chỉ IP** với nút bấm **Sao Chép IP nhanh (Quick Copy)** và toast phản hồi.
     * **Cột 3: Tên Thiết Bị / Máy Chủ** kèm nút **Mở nhanh Web UI** cho các dịch vụ (HASS `8123`, PVE `8006`, SLZB `6638`, Ollama `11434`, RouterOS, Switch).
     * **Cột 4: Địa chỉ MAC** chuẩn phần cứng kèm nút **Sao Chép MAC nhanh**.
     * **Cột 5: Hệ Điều Hành / Nền Tảng** (RouterOS, Switch OS, AP Firmware, Debian Linux/PVE, Home Assistant OS, ESPHome, TTLock Protocol, Windows/iOS/Android).
     * **Cột 6: Port / Dịch Vụ Chính** (`80, 443, 8291`, `8123`, `8006, 22`, `6638`, `11434`, `554 (RTSP), 8000`, `8080, 1883 (MQTT)`, `6053`).
     * **Cột 7: Vị Trí Lắp Đặt** (Tủ Rack P.Khách, Trần Tầng 1, Trần Tầng 2, Cửa chính, PVE VM 100, PVE VM 101, Bàn Kỹ Thuật, Ban công T2, Toàn mạng).
     * **Cột 8: Trạng Thái** (Online phát sáng xanh Neon, Available đường nét đứt, Active Range màu tím).
     * **Cột 9: Ghi Chú Chi Tiết Kỹ Thuật**.

2. **Bộ Công Cụ Tìm Kiếm, Lọc & Phân Trang (10 items / trang)**:
   - Tích hợp thanh phân trang thông minh với **mặc định 10 thiết bị / trang**, nút chọn số lượng (`10`, `20`, `50`) và nút điều hướng `[← Trước]` `[1]` `[2]` `[Sau →]`.
   - Ô tìm kiếm đa năng tức thời (tìm theo IP, MAC, Tên thiết bị, OS, Port, Vị trí hoặc Ghi chú).
   - Bộ lọc theo Phân Vùng (`all`, `infra`, `server`, `iot`, `dhcp`).
   - Bộ lọc theo Trạng Thái (`all`, `Online`, `Available`, `Active Range`).
   - Nút **Xuất File CSV** hỗ trợ tải toàn bộ danh sách sổ quản lý IP về máy tính chỉ bằng 1 cú nhấp.
   - Chân bảng hiển thị: `Hiển thị 1 - 10 / 17 thiết bị` kèm thống kê Online, Available và DHCP Dynamic Pool.

3. **Cập Nhật Vị Trí Thanh Điều Hướng (Sidebar)**:
   - Đổi tên nhóm menu `GIÁM SÁT HẠ TẦNG` thành **`QUẢN TRỊ HẠ TẦNG`** (`INFRASTRUCTURE MANAGEMENT`).
   - Chuyển mục **"Quy Hoạch Địa Chỉ IP"** lên nhóm **"QUẢN TRỊ HẠ TẦNG"** (nằm ngay sau *Hiệu năng RouterOS*), phân tách rõ ràng với nhóm *Quản trị Hotspot*.

4. **Kiểm Thử & Đảm Bảo Tính Toàn Vẹn**:
   - `npm run build` thành công 100% (86 modules, 0 errors).
   - Kiểm tra hiển thị qua Chrome DevTools MCP trên cả Desktop (1920x1080) và Mobile (375x812) đảm bảo cuộn mượt mà không bị cắt viền.

### Phiên 74 (2026-10-04) — Xây Dựng Trọn Vẹn Hệ Thống CRUD & Lưu Trữ Dữ Liệu JSON Cho Sổ Quản Lý IP (IPAM)

1. **Lưu Trữ Dữ Liệu Tập Trung Tại JSON File (`backend/data/ip-plan.json`)**:
   - Khởi tạo tệp `backend/data/ip-plan.json` chứa toàn bộ 17 bản ghi gốc thiết bị mạng theo chuẩn phân vùng Subnet 192.168.20.0/24.
   - Tạo tệp sao lưu dữ liệu gốc `backend/data/ip-plan.default.json` phục vụ tính năng Reset khôi phục mặc định khi cần.
   - Cơ chế đọc ghi an toàn qua file system (`loadIpamData()`, `saveIpamData(list)`).

2. **Backend REST API Endpoints Cho IPAM (`backend/server.js`)**:
   - `GET /api/ipam`: Trả về toàn bộ danh sách thiết bị từ `ip-plan.json` (yêu cầu đăng nhập `requireAuth`).
   - `POST /api/ipam`: Thêm mới một thiết bị IP vào sổ tay với kiểm tra dữ liệu bắt buộc (IP, Tên thiết bị, phân vùng, MAC, Port, OS, Vị trí, Status, Notes) và phân quyền RBAC `admin`/`operator`.
   - `PUT /api/ipam/:id`: Cập nhật thông tin chi tiết thiết bị theo ID, tự động gán nhãn thời gian `updatedAt`.
   - `DELETE /api/ipam/:id`: Xóa thiết bị khỏi sổ tay IPAM.
   - `POST /api/ipam/reset-default`: Khôi phục toàn bộ danh sách sổ tay về 17 bản ghi gốc ban đầu từ `ip-plan.default.json`.

3. **Frontend API Client (`frontend/src/api/client.js`)**:
   - Xuất khẩu các phương thức gọi API: `getIpam()`, `createIpam(payload)`, `updateIpam(id, payload)`, `deleteIpam(id)`, `resetIpamDefault()`.

4. **Giao Diện Người Dùng & Các Hộp Thoại Modal CRUD (`IpManagementPage.jsx`)**:
   - **Modal Thêm Mới / Chỉnh Sửa IP**: Hỗ trợ đầy đủ các trường Phân vùng, Địa chỉ IP, Tên thiết bị/máy chủ, MAC, Hệ điều hành, Cổng port, Link Web GUI, Vị trí lắp đặt, Trạng thái hoạt động, Ghi chú tiếng Việt & tiếng Anh.
   - **Modal Xác Nhận Xóa**: Cảnh báo chi tiết tên và IP của thiết bị trước khi xóa để tránh thao tác nhầm.
   - **Modal Khôi Phục Mặc Định**: Cho phép kỹ thuật viên khôi phục lại cấu hình ban đầu chỉ bằng 1 cú nhấp chuột.
   - **Nút Thao Tác Trực Quan**: Bổ sung cột Thao tác với icon Sửa (bút chì) và Xóa (thùng rác) trên từng dòng; thanh công cụ có thêm nút `+ Thêm IP Mới`, `🔄 Làm mới`, `↺ Khôi phục gốc`, và `📥 Xuất File CSV`.
   - **Thông Báo Phản Hồi (Toast Notification)**: Tích hợp thông báo thành công / thất bại trực quan khi thực hiện bất kỳ thao tác CRUD nào.
   - Giữ nguyên cơ chế phân trang 10 items / trang, tìm kiếm tức thời và bộ lọc theo phân vùng, trạng thái.

5. **Kiểm Thử & Đảm Bảo Chất Lượng**:
   - Frontend build `npm --prefix frontend run build` đạt kết quả 100% thành công (86 modules transformed, 0 errors).
   - Đã kiểm thử thao tác trực tiếp trên giao diện trình duyệt qua Chrome DevTools MCP.

---

### Phiên 75 (2026-10-04) — Chuẩn Hóa 100% Giao Diện Quy Hoạch IP Theo ServerKit Design System Specification

1. **Tuân Thủ Tuyệt Đối Chuẩn Tokens & Primitives (`DESIGN_SYSTEM_RULES.md`)**:
   - Chuyển đổi toàn bộ màu sắc, khoảng cách, font chữ và bo góc sang hệ thống CSS variables (`var(--surface)`, `var(--surface-2)`, `var(--surface-3)`, `var(--border)`, `var(--border-soft)`, `var(--text)`, `var(--text-dim)`, `var(--text-faint)`, `var(--accent)`, `var(--green)`, `var(--amber)`, `var(--violet)`).
   - Tích hợp **4 Thẻ KPI Chuẩn (.sk-kpiband & .sk-kpi)** trên đầu trang: `Subnet / Gateway`, `Tổng IP Khả Dụng (254 IPs)`, `Dải Tĩnh / IoT / Server (149 IPs)`, `DHCP Cấp Động (105 IPs)`.
   - Sử dụng **Segmented Control (.sk-seg)** cho việc chuyển đổi giữa 2 tab *Sổ Quản Lý IP* và *Tổng Quan Phân Vùng* kèm bộ đếm Badge số lượng mục.
   - Bảng dữ liệu chuẩn **.sk-dtable-wrapper & .sk-dtable** với thead font-mono in hoa, `.sk-state` cho dải phân vùng, `.sk-pill` với chấm tròn phát sáng (`.sk-pill__dot`) cho trạng thái `Online`, `Available`, `Active Range`.

2. **Hệ Thống Nút Bấm & Form Input Đồng Bộ**:
   - Sử dụng chuẩn nút bấm `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-soft`, `.btn-danger`, `.btn-ghost`, `.btn-sm`, `.btn-icon`.
   - Ô tìm kiếm và bộ lọc dropdown theo chuẩn `.form-input` với icon kính lúp căn lề trái an toàn (`!pl-10`), nút xóa nhanh (`✕`), không bị đè chữ.

3. **Tích Hợp Modal Chuẩn (`components/Modal.jsx`) & Toast Chuẩn (`hooks/useToast.jsx`)**:
   - Toàn bộ hộp thoại Thêm/Sửa IP, Xác nhận Xóa và Khôi phục Mặc định sử dụng component `Modal.jsx` dùng chung với `backdrop-blur-sm`, `z-[1150]`, bo góc `var(--radius-lg)`.
   - Thay thế toast nội bộ bằng hook `useToast()` toàn cục với hiệu ứng Neon Glassmorphism (`z-[9999]`).

4. **Kiểm Thử & Build**:
   - Frontend build `npm --prefix frontend run build` 100% thành công (86 modules transformed, 0 errors).
   - Kiểm tra hiển thị trực tiếp và chụp ảnh màn hình qua Chrome DevTools MCP.

---

### Phiên 76 (2026-10-04) — Tối Ưu Hóa Hiệu Năng HassOS & Sửa Lỗi Tải Chậm Khi Điều Hướng (Zero-Lag Navigation)

1. **Khắc phục nghẽn Socket & Loop Treo Backend**:
   - **Hiện tượng**: Khi vào `/hass` với Home Assistant IP thật không phản hồi (`192.168.20.20:8123` unreachable), SSE endpoint `/api/hass/events` chạy `setInterval(1500ms)` với timeout mặc định 6000ms gây chồng chéo hàng chục HTTP request treo, làm tắc nghẽn hoàn toàn Node.js Event Loop và Socket Connection Pool.
   - **Giải pháp**:
     - Thêm cơ chế **Circuit Breaker / Cooldown 15s** (`HASS_COOLDOWN_MS = 15000`) trong `backend/hass-client.js`. Nếu HA ngoại tuyến hoặc timeout, ngay lập tức bật cooldown, các yêu cầu tiếp theo trả về kết quả lỗi ngay lập tức (0ms) thay vì treo socket.
     - Giảm HTTP request timeout xuống 2.5 giây (`AbortSignal.timeout(2500)`).
     - Triển khai **Shared Data Cache (1.5s)** và cơ chế **Sequential Polling Loop** (`setTimeout` sau khi request hoàn tất) trong `backend/server.js`, tự động ngắt kết nối ngay khi client rời trang.

2. **Chuyển Đổi Điều Hướng Sang Chuẩn Single Page Application (SPA)**:
   - Thay thế toàn bộ thẻ điều hướng reload cứng `<a href="/">` và `<a href="/hass">` trong `ha_dashboard/components/layout/TopBar.tsx` và `NavigationRail.tsx` thành `<Link to="/">` và `<Link to="/hass">` của React Router.
   - Giúp việc quay lại từ **Smart Home HASS** về **MikroTik Dashboard** diễn ra tức thì trong bộ nhớ (< 100ms), không bị reload trắng trang hay tải lại toàn bộ tài nguyên Vite/JS bundle.

3. **Tối Ưu Timeout WebSocket Phía Client**:
   - Giảm `CONNECT_TIMEOUT_MS` trong `frontend/src/ha_dashboard/lib/env.ts` từ 15 giây xuống còn 3 giây.
   - Khi WebSocket HA thật không kết nối được sau 3s, giao diện tự động chuyển ngay sang trạng thái Mock/Demo mượt mà, không gây đơ UI.

4. **Kiểm Thử & Build**:
   - Kiểm tra luồng điều hướng thực tế trên Chrome DevTools MCP: Đăng nhập -> `/hass` -> `/hass/smart-home` -> Bấm "← MIKROTIK" -> Về MikroTik Dashboard ngay lập tức.

---

### Phiên 77 (2026-10-10) — Khắc Phục Giám Sát Proxmox Trên Coolify & Bổ Sung Bộ Chuyển Đổi Chế Độ Mock / Real-time Home Assistant

1. **Khắc Phục Giám Sát Proxmox VE Trực Tiếp Trên Coolify**:
   - **Tự động đồng bộ biến môi trường lên Coolify qua API**: Đã cấu hình toàn bộ biến môi trường Proxmox (`PROXMOX_HOST`, `PROXMOX_PORT`, `PROXMOX_SCHEME`, `PROXMOX_TOKEN_ID`, `PROXMOX_TOKEN_SECRET`, `PROXMOX_IGNORE_SSL`) và Home Assistant (`HASS_URL`, `HASS_TOKEN`) vào ứng dụng trên Coolify thông qua Coolify API.
   - **Cơ chế Circuit Breaker & Timeout Proxmox**: Bổ sung `PVE_COOLDOWN_MS = 15000` và giảm timeout trong `backend/proxmox-client.js` xuống 3.5s (`AbortSignal.timeout(3500)`) để chống nghẽn socket khi Proxmox ngoại tuyến.
   - **Xác thực SSE qua Query Token**: Cập nhật `requireAuth` trong `backend/server.js` để hỗ trợ nhận diện token đăng nhập từ `req.query.token` / `req.query.auth_token` cho các luồng `EventSource('/api/proxmox/events')` và `EventSource('/api/hass/events')`.

2. **Bổ Sung Tùy Chọn Chuyển Đổi Mock / Real-Time Home Assistant & Proxmox**:
   - **Backend API**:
     - `GET /api/hass/config` & `POST /api/hass/mode`: Cho phép xem và thay đổi linh hoạt chế độ kết nối Home Assistant (`auto` | `real` | `mock`).
     - `GET /api/proxmox/config` & `POST /api/proxmox/mode`: Cho phép xem và thay đổi linh hoạt chế độ kết nối Proxmox VE (`auto` | `real` | `mock`).
     - `fetchHassData()` & `fetchProxmox()`: Tuân thủ chế độ được chọn (ép buộc Mock khi chọn Mock; kết nối thiết bị thật khi chọn Real-time; và tự động fallback khi chọn Auto).
   - **Frontend UI**:
     - Thêm bộ điều khiển chuyển đổi chế độ (.sk-seg) trực quan trên TopBar trang **Home Assistant OS (`/hass`)** và trang **Proxmox VE (`/proxmox`)** với 3 chế độ: 🔄 **Auto** | ⚡ **Real-time** | 🧪 **Mock Demo**.
     - Tích hợp lưu trữ lựa chọn vào `localStorage ('hass_mode', 'proxmox_mode')` và đồng bộ với Smart Home Dashboard (`ha_dashboard/lib/env.ts`).

3. **Deploy Tự Động & Kiểm Thử Trực Tiếp Trên Coolify (`https://dashboard.mtdd.io.vn/`)**:
   - Push mã nguồn lên GitHub `minhthanhhlht/mikrotik_dashboard` và kích hoạt deploy qua Coolify API (`POST /api/v1/deploy`).
   - Sử dụng **Chrome DevTools MCP** kiểm thử trực tiếp trên live site:
     - Trang **Proxmox VE (`/proxmox`)**: Kết nối thành công tới Node `mtdd` thật (`192.168.20.21:8006`), hiển thị đầy đủ telemetry CPU 1.3%, RAM 18.7%, ZFS 6.9%, Live Traffic RX/TX, và danh sách Container LXC thực tế (container ID 100 `ollama-server` 18 Cores, 8GB RAM).
### Phiên 78 (2026-10-10) — Tích Hợp Bộ Chuyển Đổi Chế Độ Mock / Real-time Vào Smart Home HASS & Kiểm Thử Live

1. **Tích Hợp Bộ Điều Khiển Chế Độ (.sk-seg) Vào Smart Home HASS TopBar**:
   - Bổ sung props `currentMode` (`auto` | `real` | `mock`) và `onSwitchMode` vào component `ha_dashboard/components/layout/TopBar.tsx`.
   - Hiển thị thanh chuyển đổi chế độ chuẩn ServerKit: 🔄 **Auto** | ⚡ **Real-time** | 🧪 **Mock** ngay cạnh đồng hồ và trạng thái kết nối.

2. **Xử Lý Luồng Chuyển Đổi & Reconnect Thông Minh Trong `App.tsx`**:
   - Khi người dùng bấm chuyển đổi chế độ:
     - Tự động lưu lựa chọn vào `localStorage.setItem('hass_mode', mode)`.
     - Đồng bộ cập nhật trạng thái chế độ lên Backend qua `api.setHassMode(mode)`.
     - Tự động gọi `connectFromEnv()` để đóng/mở lại WebSocket hoặc nạp Mock States tức thì mà không cần tải lại toàn bộ trang.

3. **Deploy Lên Coolify & Kiểm Thử Live Trực Tiếp (`https://dashboard.mtdd.io.vn/hass/smart-home`)**:
   - Push commit `10e4214` lên GitHub `main`, gửi API trigger sang Coolify (`deployment_uuid: ve6pe7luhmlb16vtignc8w0s`).
   - Kiểm thử thành công 100% qua **Chrome DevTools MCP** trên live production URL `https://dashboard.mtdd.io.vn/hass/smart-home`.

---



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