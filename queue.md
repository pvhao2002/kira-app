# Setup EC2 worker — `kira-queue` (Amazon Linux)

Hướng dẫn từ đầu cho **1 EC2 instance** chạy **1 container `kira-queue`**. Lặp lại trên nhiều instance (vd. 3 worker) — mỗi máy đổi `INSTANCE_ID` và giữ cùng cấu hình DB/Rabbit.

## Yêu cầu

| Hạng mục | Khuyến nghị |
|---|---|
| AMI | **Amazon Linux 2023** |
| Instance type | `t3.small` trở lên (**4 GB RAM** nếu chạy thêm Portainer) |
| Disk | ≥ 20 GB |
| Network | Outbound tới **MySQL** và **RabbitMQ** (Security Group) |
| Image | `kira2308/kira-queue:latest` (`linux/amd64` trên EC2 x86) |

> `kira-queue` dùng Playwright + Chromium — cần RAM. Máy 2 GB chỉ nên chạy mỗi `kira-queue`, không kèm Portainer.

---

## 1. Tạo EC2

1. Chọn AMI **Amazon Linux 2023**.
2. Gán key pair SSH.
3. Security Group (tối thiểu):
   - **Inbound**: SSH `22` từ IP của bạn.
   - **Inbound** (tuỳ chọn): `2323` chỉ khi cần health/debug từ ngoài — production nên để nội bộ.
   - **Outbound**: cho phép tới DB (`3306`) và Rabbit (`5672`).
4. SSH vào máy:

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

---

## 2. Cài Docker (Amazon Linux 2023)

Kiểm tra AMI trước:

```bash
cat /etc/os-release | grep -E '^(NAME|VERSION)='
```

Chạy lần lượt trên EC2 (user `ec2-user`). **Phải cài package `docker` thành công** rồi mới `systemctl` — nếu không sẽ báo `Unit file docker.service does not exist`.

```bash
# Đợi RPM lock (SSM/cloud-init đang update) — chạy nếu dnf báo lock
while sudo fuser /var/lib/rpm/.rpm.lock >/dev/null 2>&1; do
  echo "waiting for rpm lock..."
  sleep 2
done

sudo dnf update -y
sudo dnf install -y docker 
sudo dnf install -y git 
# sudo dnf install -y curl

# Xác nhận đã cài — phải thấy package + file service
dnf list installed docker
ls -l /usr/lib/systemd/system/docker.service

sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Nếu `dnf install docker` **fail** hoặc `docker.service` vẫn không có:

```bash
sudo dnf install -y docker --best
# hoặc cài lại sạch
sudo dnf remove -y docker 2>/dev/null || true
sudo dnf clean all
sudo dnf install -y docker
ls -l /usr/lib/systemd/system/docker.service
sudo systemctl enable --now docker
```

**Amazon Linux 2** (không phải 2023) — dùng `yum` / extras:

```bash
sudo yum update -y
sudo amazon-linux-extras install docker -y
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Cài **Docker Compose plugin**:

```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

Đăng xuất SSH rồi vào lại (hoặc `newgrp docker`) để group `docker` có hiệu lực:

```bash
exit
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

Kiểm tra:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

### (Tuỳ chọn) Thêm swap 2 GB

Hữu ích nếu instance chỉ có 2 GB RAM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Chuẩn bị thư mục deploy

```bash
sudo mkdir -p /opt/kira-queue/logs
sudo chown -R ec2-user:ec2-user /opt/kira-queue
cd /opt/kira-queue
```

### 3.1 File `.env`

```bash
cat > .env <<'EOF'
# --- Platform (EC2 x86) ---
DOCKER_PLATFORM=linux/amd64

# --- Identity (đổi trên mỗi EC2) ---
INSTANCE_ID=worker-1
KIRA_CRAWL_INSTANCE_ID=worker-1

# --- Database ---
DB_NAME=kira
DB_APP_USER=your_db_user
DB_APP_PASSWORD=your_db_password
DB_PRIMARY_HOST=your-db-host
DB_PRIMARY_PORT=3306

# --- RabbitMQ ---
RABBIT_HOST=your-rabbit-host
RABBIT_PORT=5672
RABBIT_USERNAME=your_rabbit_user
RABBIT_PASSWORD=your_rabbit_password
RABBIT_VHOST=/

# --- Playwright / crawl ---
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_TEST_API_ENABLED=false
AISCORE_COOKIE=

# --- Optional upstream (nếu không dùng crawl in-process) ---
APP_KIRA_CRAWL_BASE_URL=http://host.docker.internal:4000
APP_GATEWAY_BASE_URL=http://host.docker.internal:6868/gateway
EOF
```

Điền giá trị thật. Trên **worker-2**, **worker-3** chỉ đổi:

```env
INSTANCE_ID=worker-2
KIRA_CRAWL_INSTANCE_ID=worker-2
```

### 3.2 File `docker-compose.yml`

```bash
cat > docker-compose.yml <<'EOF'
services:
  kira-queue:
    image: kira2308/kira-queue:latest
    platform: ${DOCKER_PLATFORM:-linux/amd64}
    container_name: kira-queue
    ipc: host
    ports:
      - "2323:2323"
    env_file:
      - .env
    environment:
      LOG_DIR: /app/logs
      DB_NAME: ${DB_NAME}
      DB_APP_USER: ${DB_APP_USER}
      DB_APP_PASSWORD: ${DB_APP_PASSWORD}
      DB_PRIMARY_HOST: ${DB_PRIMARY_HOST}
      DB_PRIMARY_PORT: ${DB_PRIMARY_PORT}
      RABBIT_HOST: ${RABBIT_HOST}
      RABBIT_PORT: ${RABBIT_PORT}
      RABBIT_USERNAME: ${RABBIT_USERNAME}
      RABBIT_PASSWORD: ${RABBIT_PASSWORD}
      RABBIT_VHOST: ${RABBIT_VHOST}
    volumes:
      - ./logs:/app/logs
    extra_hosts:
      - "host.docker.internal:host-gateway"
    deploy:
      resources:
        limits:
          memory: 1.5G
    restart: unless-stopped
EOF
```

> `ipc: host` giúp Chromium/Playwright ổn định hơn trong container.

---

## 4. Chạy image với Docker Compose

```bash
cd /opt/kira-queue

# Kéo image mới nhất
docker compose pull
docker compose up -d
docker compose ps
docker logs -f kira-queue
```

Health check trên EC2:

```bash
curl -fsS http://127.0.0.1:2323/queue/actuator/health
```

Kỳ vọng HTTP 200 với `"status":"UP"`.

---

## 5. Vận hành hàng ngày

### Cập nhật image

```bash
cd /opt/kira-queue
docker compose pull
docker compose up -d
docker image prune -f
```

### Restart

```bash
docker compose restart
```

### Dừng / gỡ

```bash
docker compose down
```

### Xem log

```bash
docker logs -f --tail 200 kira-queue
# hoặc file trên host
tail -f /opt/kira-queue/logs/kira-queue-<INSTANCE_ID>.log
```

---

## 6. Nhiều EC2 worker (3 instance)

Mỗi máy làm **bước 1–4** giống nhau, chỉ khác:

| EC2 | `INSTANCE_ID` | Ghi chú |
|---|---|---|
| worker-1 | `worker-1` | consume cùng Rabbit queue |
| worker-2 | `worker-2` | prefetch=1 → không duplicate job |
| worker-3 | `worker-3` | scale ngang |

Cùng `.env` DB/Rabbit; **không** cần mở port `2323` ra internet nếu chỉ consume queue.

Quản lý SSH nhiều máy từ 1 terminal local — dùng `tmux` 3 pane hoặc 3 tab.

---

## 7. (Tuỳ chọn) Bootstrap từ repo

Nếu đã clone monorepo lên EC2:

```bash
# Trên EC2, sau khi clone repo vào /opt/kira-app
cd /opt/kira-app
chmod +x scripts/ec2-bootstrap.sh
./scripts/ec2-bootstrap.sh
```

Script `scripts/ec2-bootstrap.sh` cài Docker + Compose cho Amazon Linux 2023. Stack producer+queue đầy đủ nằm ở `scripts/stack-producer-queue.yml` (1 máy chạy cả producer + 2 queue — chỉ dùng khi RAM đủ lớn).

Build/push image `linux/amd64` từ máy dev:

```bash
PLATFORM=linux/amd64 PUSH=true ./scripts/build-producer-queue.sh
```

---

## 8. Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| `Unit file docker.service does not exist` | Chưa cài `docker` — chạy `sudo dnf install -y docker`, kiểm tra `ls /usr/lib/systemd/system/docker.service` |
| `permission denied` khi chạy docker | `newgrp docker` hoặc SSH lại sau `usermod` |
| Container restart liên tục | Kiểm tra RAM (`free -h`), tăng instance hoặc thêm swap |
| Không connect DB/Rabbit | Kiểm tra SG outbound + host/port trong `.env` |
| `platform mismatch` | Đặt `DOCKER_PLATFORM=linux/amd64` |
| Playwright crash | Đảm bảo `ipc: host`, `PLAYWRIGHT_HEADLESS=true` |
| OOM killed | Giảm service khác trên máy; tối thiểu 4 GB nếu có Portainer |

---

## Tham chiếu trong repo

- Compose mẫu producer + queue: `scripts/stack-producer-queue.yml`
- Bootstrap EC2: `scripts/ec2-bootstrap.sh`
- Build image AMD64: `scripts/build-producer-queue.sh`
- Env production chung: `.env.ec2.example`
