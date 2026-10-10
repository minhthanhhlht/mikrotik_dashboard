# HƯỚNG DẪN TRIỂN KHAI MIKROTIK HOTSPOT DASHBOARD TRÊN PROXMOX

Tài liệu này hướng dẫn chi tiết từng bước cách triển khai toàn bộ hệ thống **MikroTik Hotspot Management Dashboard** trên nền tảng ảo hóa **Proxmox VE** theo 2 giải pháp phổ biến và tối ưu nhất:

1. **Hướng 1: Proxmox LXC Container + Docker + Portainer CE** (Giải pháp nhẹ, quản lý trực quan qua giao diện web Portainer).
2. **Hướng 2: Self-hosted PaaS với Coolify hoặc Dokku trên Proxmox** (Giải pháp tự động hóa hiện đại, tự động build từ Git, tự cấp chứng chỉ SSL HTTPS).

---

## 📌 PHẦN 0: CHUẨN BỊ TRÊN ROUTER MIKROTIK (ROUTEROS 7.X)

Trước khi triển khai trên Proxmox, mở Winbox hoặc Terminal SSH vào MikroTik và chạy các lệnh sau:

### 1. Bật dịch vụ REST API (WWW) & FTP
```routeros
# Bật REST API (mặc định cổng 80)
/ip service enable www
/ip service set www port=80

# Bật FTP (cổng 21 - dùng để tải/xuất file sao lưu .backup)
/ip service enable ftp
/ip service set ftp port=21
```

### 2. Tạo User API chuyên dụng
```routeros
/user add name=user_api group=full password="MatKhauCuaBan123" comment="API Dashboard User"
```

---

## 🚀 HƯỚNG 1: TRIỂN KHAI TRÊN PROXMOX LXC + DOCKER + PORTAINER

Đây là phương pháp tiết kiệm RAM & CPU nhất trên Proxmox (LXC chỉ tốn ~100MB RAM).

```
[ Proxmox VE Host ]
       │
       └──► [ LXC Container (Debian 12 / Ubuntu 24.04 - Bật Nesting) ]
                 ├── [ Docker Engine ]
                 ├── [ Portainer CE (Port 9443 / 9000) ]
                 └──► [ Container: mikrotik-dashboard (Port 3000) ]
                           ├── React 19 UI
                           └── Express 5 Proxy ──► [ MikroTik 192.168.20.1 ]
```

---

### Bước 1.1: Tạo LXC Container trên Proxmox VE

1. Đăng nhập vào giao diện **Proxmox VE Web UI** (`https://<IP_PROXMOX>:8006`).
2. Bấm nút **Create CT** (góc trên bên phải):
   - **General**:
     - *CT ID*: Ví dụ `105`
     - *Hostname*: `docker-apps` (hoặc `mikrotik-dashboard`)
     - *Password*: Đặt mật khẩu root cho LXC.
     - *Unprivileged container*: Đánh dấu chọn (hoặc bỏ chọn nếu muốn chạy Privileged).
   - **Template**: Chọn template `debian-12-standard` hoặc `ubuntu-24.04-standard`.
   - **Disks**: Dung lượng tối thiểu **10 GB** (khuyến nghị 20 GB).
   - **CPU**: 1 hoặc 2 Cores.
   - **Memory**: RAM **1024 MB** (1 GB), Swap **512 MB**.
   - **Network**:
     - *Bridge*: `vmbr0`
     - *IPv4*: Chọn **Static** (ví dụ `192.168.20.50/24`) và *Gateway* là IP MikroTik (ví dụ `192.168.20.1`).
   - **DNS**: Để mặc định hoặc trỏ về `1.1.1.1, 8.8.8.8`.
3. ⚠️ **CẤU HÌNH BẮT BUỘC ĐỂ DOCKER CHẠY TRONG LXC**:
   - Sau khi tạo xong, **chưa khởi động LXC vội**.
   - Chọn LXC vừa tạo $\rightarrow$ **Options** $\rightarrow$ chọn **Features** $\rightarrow$ bấm **Edit**.
   - Tích chọn:
     - ✅ **Nesting** (Bắt buộc để chạy Docker bên trong LXC).
     - ✅ **keyctl** (Nếu dùng Unprivileged container).
   - Bấm **OK**.

---

### Bước 1.2: Cài đặt Docker & Portainer trong LXC

Khởi động LXC và mở **Console** (hoặc SSH vào LXC với user `root`):

```bash
# 1. Cập nhật hệ thống
apt update && apt upgrade -y
apt install -y curl wget git sudo ca-certificates gnupg

# 2. Cài đặt Docker tự động chính hãng
curl -fsSL https://get.docker.com | bash

# 3. Kích hoạt dịch vụ Docker
systemctl enable --now docker

# 4. Cài đặt Portainer Community Edition (CE)
docker volume create portainer_data
docker run -d -p 8000:8000 -p 9443:9443 -p 9000:9000 \
  --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

> Mở trình duyệt truy cập: `https://<IP_LXC>:9443` (hoặc `http://<IP_LXC>:9000`) để tạo tài khoản admin Portainer ban đầu.

---

### Bước 1.3: Triển khai Dashboard bằng Portainer Stack (Docker Compose)

1. Đăng nhập vào **Portainer** $\rightarrow$ Chọn môi trường **local** (hoặc Primary).
2. Ở menu bên trái, chọn **Stacks** $\rightarrow$ Bấm **+ Add stack**.
3. Đặt tên stack: `mikrotik-dashboard`.
4. Chọn tab **Web editor** và dán nội dung sau:

```yaml
services:
  mikrotik-dashboard:
    image: node:20-alpine
    container_name: mikrotik-dashboard
    restart: always
    working_dir: /app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MTIK_SCHEME=http
      - MTIK_HOST=192.168.20.1          # IP Router MikroTik của bạn
      - MTIK_PORT=80                    # Cổng www của MikroTik
      - MTIK_USER=user_api              # Tài khoản API MikroTik
      - MTIK_PASS=MatKhauCuaBan123      # Mật khẩu API MikroTik
    volumes:
      - mikrotik_data:/app/backend/data
    # Nếu clone source code trực tiếp hoặc build từ Git:
    # build:
    #   context: https://github.com/your-username/mikrotik_dashboard.git
    #   dockerfile: Dockerfile

volumes:
  mikrotik_data:
    name: mikrotik_dashboard_data
```

*(Nếu bạn đã clone mã nguồn về thư mục `/opt/mikrotik-dashboard` trong LXC, bạn có thể build trực tiếp bằng Dockerfile)*:

```bash
# Trong console của LXC:
cd /opt
git clone <URL_REPO_CUA_BAN> mikrotik-dashboard
cd mikrotik-dashboard

# Khởi chạy bằng docker compose
docker compose up -d --build
```

5. Bấm **Deploy the stack** trong Portainer.
6. Mở trình duyệt và truy cập: `http://<IP_LXC>:3000` để sử dụng Dashboard!

---

## 🌐 HƯỚNG 2: TRIỂN KHAI VỚI COOLIFY HOẶC DOKKU TRÊN PROXMOX

Phương pháp này dành cho môi trường PaaS chuyên nghiệp, tự động hóa toàn bộ quy trình CI/CD và quản lý SSL HTTPS tự động.

---

### GIẢI PHÁP A: Triển khai với COOLIFY (Khuyến nghị số 1)

**Coolify** là nền tảng Self-hosted tương tự Vercel / Netlify / Heroku chạy trực tiếp trên Proxmox.

```
[ Git Repository / GitHub / GitLab ]
        │ (Webhook Push)
        ▼
   [ Coolify trên Proxmox ]
        ├── Tự động đọc Dockerfile
        ├── Multi-stage build (React + Node.js)
        ├── Tự động gắn Reverse Proxy (Traefik)
        └── Tự động cấp SSL Let's Encrypt HTTPS
```

#### Bước 2.1: Cài đặt Coolify trên Proxmox (Nếu chưa có)
Trong một LXC hoặc VM Ubuntu 22.04/24.04:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
Truy cập Coolify tại `http://<IP_PROXMOX_COOLIFY>:8000`.

#### Bước 2.2: Thêm dự án vào Coolify
1. Trong giao diện Coolify, chọn **Projects** $\rightarrow$ Chọn **Default** (hoặc tạo Project mới) $\rightarrow$ Chọn **Production** environment.
2. Bấm **+ New Resource** $\rightarrow$ Chọn **Public/Private Repository** (GitHub, GitLab hoặc Git URL).
3. Điền URL Repository của dự án `wifi_hostpost_web_new_ui`.
4. Coolify sẽ tự động nhận diện file `Dockerfile` có sẵn trong thư mục gốc của dự án.

#### Bước 2.3: Cấu hình Biến môi trường (Environment Variables) trong Coolify
Vào tab **Environment Variables** của ứng dụng và thêm:
| Key | Value | Ghi chú |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Chế độ chạy tối ưu |
| `PORT` | `3000` | Port ứng dụng |
| `MTIK_SCHEME` | `http` | Giao thức kết nối MikroTik |
| `MTIK_HOST` | `192.168.20.1` | IP của Router MikroTik |
| `MTIK_PORT` | `80` | Port WWW MikroTik |
| `MTIK_USER` | `user_api` | User quản trị API MikroTik |
| `MTIK_PASS` | `MatKhauCuaBan123` | Mật khẩu API MikroTik |
| `AUTH_SOURCE` | `routeros` | Nguồn xác thực: `routeros` (mặc định), `env` hoặc `both` |
| `ADMIN_USER` | `admin` | Tài khoản Admin (nếu dùng AUTH_SOURCE=env hoặc both) |
| `ADMIN_PASS` | `Admin@123` | Mật khẩu Admin (nếu dùng AUTH_SOURCE=env hoặc both) |

#### Bước 2.4: Gán tên miền & Triển khai (Deploy)
1. Ở mục **Domains**, nhập tên miền mong muốn: `https://wifi.yourdomain.com` (Coolify sẽ tự động tạo chứng chỉ SSL Let's Encrypt qua Traefik).
2. Ở mục **Ports Exposes**, điền `3000`.
3. Bấm **Deploy**. Coolify sẽ tự động tải mã nguồn, build Frontend React, đóng gói Backend Express và kích hoạt container.

> 💡 **Mẹo cấu hình SSE Realtime trên Coolify/Traefik**:
> Coolify sử dụng Traefik làm proxy mặc định đã hỗ trợ truyền dữ liệu SSE và WebSocket mượt mà, không cần cấu hình thêm.

---

### GIẢI PHÁP B: Triển khai với DOKKU

**Dokku** là giải pháp PaaS mini điều khiển hoàn toàn bằng dòng lệnh CLI:

#### Bước 2.5: Các bước triển khai trên Dokku:
```bash
# 1. SSH vào máy chủ Dokku trên Proxmox
ssh root@dokku.local

# 2. Tạo ứng dụng mới
dokku apps:create mikrotik-dashboard

# 3. Cấu hình biến môi trường kết nối MikroTik
dokku config:set mikrotik-dashboard \
  NODE_ENV=production \
  PORT=3000 \
  MTIK_SCHEME=http \
  MTIK_HOST=192.168.20.1 \
  MTIK_PORT=80 \
  MTIK_USER=user_api \
  MTIK_PASS=MatKhauCuaBan123

# 4. Gán cổng port proxy (Proxy port 80/443 về 3000 của container)
dokku ports:set mikrotik-dashboard http:80:3000 https:443:3000

# 5. Gán tên miền
dokku domains:set mikrotik-dashboard wifi.yourdomain.com

# 6. Triển khai ứng dụng (từ máy dev deploy lên Dokku)
# Hoặc dùng git sync plugin:
dokku git:sync mikrotik-dashboard https://github.com/your-username/mikrotik_dashboard.git main --build

# 7. Bật chứng chỉ SSL Let's Encrypt tự động
dokku letsencrypt:enable mikrotik-dashboard
```

---

## ⚙️ CẤU HÌNH MẠNG & TƯỜNG LỬA TRÊN PROXMOX (NETWORK TIPS)

1. **Giao tiếp giữa LXC/VM và Router MikroTik**:
   - Đảm bảo card mạng của LXC/VM được gắn vào bridge `vmbr0` (cùng subnet với dải mạng LAN MikroTik `192.168.20.0/24`).
   - Kiểm tra kết nối từ bên trong LXC tới Router:
     ```bash
     ping 192.168.20.1
     curl -I http://192.168.20.1/rest/system/resource
     ```
2. **Persistent Data (Lưu trữ dữ liệu phiên đăng nhập & cài đặt)**:
   - File cấu hình và phiên người dùng nằm tại `/app/backend/data`.
   - `Dockerfile` và `docker-compose.yml` đã được định nghĩa sẵn Volume `mikrotik_data` để dữ liệu không bị mất khi cập nhật hoặc restart container.

---

## 🔄 QUY TRÌNH NÂNG CẤP KHI CÓ PHIÊN BẢN MỚI

- **Với Portainer**:
  - Vào **Stacks** $\rightarrow$ chọn `mikrotik-dashboard` $\rightarrow$ bấm **Editor** $\rightarrow$ bấm **Update the stack** (tích chọn *Re-pull image / Rebuild*).
- **Với Coolify**:
  - Bấm nút **Redeploy** trên giao diện Web (hoặc tự động kích hoạt qua GitHub Webhook khi push code mới).
- **Với Dokku**:
  - Chạy lại lệnh: `dokku git:sync mikrotik-dashboard ... --build`.
