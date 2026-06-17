# Setup EC2 — Portainer + RabbitMQ + kira-producer (Amazon Linux)

Hướng dẫn từ đầu cho **1 EC2 instance** chạy **Portainer CE**, **RabbitMQ** và **kira-producer** trên cùng máy. Hai stack Docker dùng chung network `kira-app`. MySQL chạy trên **RDS** (bên ngoài EC2).

## Yêu cầu

| Hạng mục | Khuyến nghị |
|---|---|
| AMI | **Amazon Linux 2023** |
| Instance type | `t3.small` trở lên (**≥ 4 GB RAM**) |
| Disk | ≥ 20 GB |
| Database | **RDS MySQL** — Security Group cho phép EC2 inbound `3306` |
| Image | `kira2308/kira-producer:latest` (`linux/amd64` trên EC2 x86) |

> Portainer + RabbitMQ + producer cần RAM. Máy 2 GB dễ OOM — không khuyến nghị.

---

## Kiến trúc

```text
EC2 (Amazon Linux 2023)
├── Nginx (host)          :80 → portainer.kira.id.vn, rabbit.kira.id.vn
├── Portainer CE          :9443 (localhost)
├── Stack rabbitmq
│   └── rabbitmq          :5672 AMQP, :15672 Management UI
└── Stack kira-producer
    └── kira-producer     :2311 HTTP (/producer/actuator/health)
         ├── JDBC ──────► RDS MySQL :3306
         └── AMQP ──────► rabbitmq (DNS trên network kira-app)
```

---

## 1. Tạo EC2

1. Chọn AMI **Amazon Linux 2023**.
2. Gán key pair SSH.
3. Security Group (tối thiểu):

| Hướng | Port | Ghi chú |
|---|---|---|
| Inbound | `22` | SSH — chỉ IP của bạn |
| Inbound | `80` | Nginx — Cloudflare hoặc IP admin (proxy `portainer.kira.id.vn`, `rabbit.kira.id.vn`) |
| Inbound | `9443` | Portainer trực tiếp (tuỳ chọn nếu không dùng Nginx subdomain) |
| Inbound | `15672` | RabbitMQ UI trực tiếp (tuỳ chọn) |
| Inbound | `2311` | Producer health (tuỳ chọn) — có thể bỏ nếu chỉ debug qua SSH |
| Outbound | `3306` | Tới RDS |
| Outbound | `443` | Pull Docker image |

4. RDS Security Group: inbound `3306` từ Security Group của EC2 (hoặc IP private EC2).

5. SSH vào máy:

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
sudo dnf install -y docker git

# Xác nhận đã cài — phải thấy package + file service
dnf list installed docker
ls -l /usr/lib/systemd/system/docker.service

sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Nếu `dnf install docker` **fail** hoặc `docker.service` vẫn không có:

```bash
sudo dnf install -y docker --best
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

### (Tuỳ chọn) Bootstrap từ repo

```bash
git clone https://github.com/YOUR_ORG/kira-app.git /opt/kira-app
cd /opt/kira-app
chmod +x scripts/ec2-bootstrap.sh
./scripts/ec2-bootstrap.sh
```

---

## 3. Cài Portainer CE

```bash
docker volume create portainer_data

docker run -d \
  -p 8000:8000 \
  -p 9443:9443 \
  --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

1. Mở trình duyệt: `https://<EC2_PUBLIC_IP>:9443` (chấp nhận self-signed cert lần đầu).
2. Tạo tài khoản admin.
3. Chọn environment **local** (Docker socket trên máy EC2).

Kiểm tra container:

```bash
docker ps --filter name=portainer
```

---

## 4. Tạo Docker network chung

Hai stack Portainer **không tự chia sẻ network** nếu mỗi stack tạo network riêng (`rabbitmq_kira-app` vs `kira-producer_kira-app`). Tạo network **một lần** trước khi deploy stack:

```bash
docker network create kira-app
docker network ls | grep kira-app
```

Cả hai file stack trong repo khai báo:

```yaml
networks:
  kira-app:
    external: true
    name: kira-app
```

---

## 5. Deploy stack RabbitMQ (stack 1 — deploy trước)

### 5.1 Trong Portainer UI

1. **Stacks** → **Add stack**
2. Tên stack: `rabbitmq`
3. Build method: **Web editor**
4. Paste nội dung file [`scripts/stack-rabbitmq.yml`](../scripts/stack-rabbitmq.yml)
5. Mở **Environment variables** (hoặc **Advanced mode** → env), thêm:

```env
RABBITMQ_DEFAULT_USER=kira_rabbit
RABBITMQ_DEFAULT_PASS=your-strong-password
RABBITMQ_DEFAULT_VHOST=/
```

> Không dùng `guest/guest` trên production. Lưu lại user/password — stack producer cần cùng giá trị.

6. **Deploy the stack**

### 5.2 Kiểm tra

```bash
docker ps --filter name=rabbitmq
curl -fsS -u kira_rabbit:your-strong-password http://127.0.0.1:15672/api/overview
```

RabbitMQ Management UI: `http://<EC2_IP>:15672`

---

## 6. Deploy stack kira-producer (stack 2 — deploy sau RabbitMQ)

### 6.1 Trong Portainer UI

1. **Stacks** → **Add stack**
2. Tên stack: `kira-producer`
3. Paste nội dung file [`scripts/stack-kira-producer.yml`](../scripts/stack-kira-producer.yml)
4. Environment variables:

```env
DOCKER_PLATFORM=linux/amd64

DB_NAME=kira
DB_APP_USER=your_db_user
DB_APP_PASSWORD=your_db_password
DB_PRIMARY_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PRIMARY_PORT=3306

RABBIT_HOST=rabbitmq
RABBIT_PORT=5672
RABBIT_USERNAME=kira_rabbit
RABBIT_PASSWORD=your-strong-password
RABBIT_VHOST=/

KIRA_PRODUCER_CRAWL_SCHEDULE_ENABLED=true
```

| Biến | Ghi chú |
|---|---|
| `RABBIT_HOST=rabbitmq` | Trỏ tới `container_name` trong stack RabbitMQ — DNS nội bộ trên `kira-app` |
| `RABBIT_USERNAME` / `RABBIT_PASSWORD` | Phải khớp `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` stack RabbitMQ |
| `DB_PRIMARY_HOST` | Endpoint RDS, không phải `localhost` |

5. **Deploy the stack**

### 6.2 Kiểm tra

```bash
docker ps --filter name=kira-producer
curl -fsS http://127.0.0.1:2311/producer/actuator/health
```

Kỳ vọng HTTP 200 với `"status":"UP"`.

Kiểm tra producer resolve được RabbitMQ trên network chung:

```bash
docker exec kira-producer getent hosts rabbitmq
```

---

## 7. Nginx reverse proxy (portainer.kira.id.vn, rabbit.kira.id.vn)

Khi dùng **Cloudflare** (SSL Flexible), Nginx trên EC2 listen `:80` và proxy tới Portainer/RabbitMQ trên localhost. Không cần mở `9443` / `15672` ra internet.

### 7.1 DNS (Cloudflare)

| Type | Name | Content |
|---|---|---|
| A | `portainer` | `<EC2_PUBLIC_IP>` (Proxy ON — orange cloud) |
| A | `rabbit` | `<EC2_PUBLIC_IP>` (Proxy ON) |

SSL/TLS mode: **Flexible** (Cloudflare ↔ visitor HTTPS; Cloudflare ↔ EC2 HTTP).

### 7.2 Cài Nginx trên EC2

```bash
sudo dnf install -y nginx
sudo systemctl enable --now nginx

# Xoá default site — nếu không, curl /healthz trả 404 và Cloudflare có thể 522
sudo rm -f /etc/nginx/conf.d/default.conf
```

Copy config từ repo (sau khi clone hoặc scp):

```bash
sudo cp /opt/kira-app/scripts/nginx-infra.conf /etc/nginx/conf.d/kira-infra.conf
sudo nginx -t
sudo systemctl reload nginx
```

> **Lưu ý:** Package `nginx` trên Amazon Linux tạo sẵn `/etc/nginx/conf.d/default.conf`. File này thường là `default_server` và **không có** `/healthz` → `curl http://127.0.0.1/healthz` trả **404** dù `kira-infra.conf` đã copy. Phải xoá `default.conf` trước khi reload.

Xác nhận server block đang active:

```bash
ls /etc/nginx/conf.d/
sudo nginx -T 2>/dev/null | grep -E 'listen 80|server_name|healthz'
```

File [`scripts/nginx-infra.conf`](../scripts/nginx-infra.conf) gồm 2 `server` block:

| Domain | Upstream |
|---|---|
| `portainer.kira.id.vn` | `https://127.0.0.1:9443` (WebSocket, `proxy_ssl_verify off`) |
| `rabbit.kira.id.vn` | `http://127.0.0.1:15672` |

### 7.3 Kiểm tra

```bash
# Bắt buộc — phải OK trước khi test qua Cloudflare (tránh nhầm 522)
curl -fsS http://127.0.0.1/healthz

curl -fsS -H 'Host: portainer.kira.id.vn' http://127.0.0.1/ -o /dev/null -w '%{http_code}\n'
curl -fsS -H 'Host: rabbit.kira.id.vn' http://127.0.0.1/ -o /dev/null -w '%{http_code}\n'

# Từ máy local — nếu timeout ở đây thì sửa Security Group inbound :80
curl -fsS http://<EC2_PUBLIC_IP>/healthz
```

Trình duyệt:

- `https://portainer.kira.id.vn`
- `https://rabbit.kira.id.vn`

> Portainer backend dùng cert self-signed — Nginx bỏ qua verify (`proxy_ssl_verify off`). Visitor vẫn thấy HTTPS qua Cloudflare.

---

## 8. Vận hành hàng ngày

### Cập nhật image qua Portainer

1. **Stacks** → chọn stack → **Editor** hoặc **Pull and redeploy**
2. Hoặc trên SSH:

```bash
docker pull kira2308/kira-producer:latest
# Trong Portainer: Stack kira-producer → Update the stack
```

### Cập nhật image từ máy dev

```bash
PLATFORM=linux/amd64 PUSH=true ./scripts/build-producer-queue.sh
```

### Restart stack

Portainer → **Stacks** → chọn stack → **Stop** / **Start**, hoặc:

```bash
docker restart rabbitmq
docker restart kira-producer
```

### Xem log

```bash
docker logs -f --tail 200 rabbitmq
docker logs -f --tail 200 kira-producer
```

### Gỡ stack (giữ network)

Portainer → **Stacks** → **Delete** (không xoá network `kira-app` nếu còn stack khác dùng).

```bash
docker network rm kira-app   # chỉ khi không còn container nào attach
```

---

## 9. Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| `network kira-app declared as external, but could not be found` | Chạy `docker network create kira-app` trước khi deploy stack |
| `Unit file docker.service does not exist` | Chưa cài `docker` — `sudo dnf install -y docker` |
| `permission denied` khi chạy docker | `newgrp docker` hoặc SSH lại sau `usermod` |
| Producer không connect RabbitMQ | Kiểm tra `RABBIT_HOST=rabbitmq`, cả hai container cùng `docker network inspect kira-app` |
| Producer không connect RDS | RDS SG cho phép EC2; đúng `DB_PRIMARY_HOST` / credentials |
| `platform mismatch` | Đặt `DOCKER_PLATFORM=linux/amd64` |
| Container restart liên tục | `docker logs kira-producer`; kiểm tra RAM (`free -h`) |
| OOM killed | Tăng instance hoặc thêm swap; tối thiểu 4 GB RAM |
| Portainer không mở được :9443 | Kiểm tra EC2 SG inbound `9443`; hoặc dùng `https://portainer.kira.id.vn` qua Nginx (:80) |
| `502` trên portainer/rabbit subdomain | `docker ps` — container đang chạy; `curl` upstream localhost (`9443` / `15672`) |
| Nginx `duplicate map` khi reload | Chỉ copy `nginx-infra.conf` (một file), không copy thêm `nginx-rabbit.conf` cũ |
| **Cloudflare 522** (Connection timed out) | Xem mục **9.1** bên dưới |
| `curl /healthz` trả **404** | Chưa copy `kira-infra.conf` hoặc còn `default.conf` — xoá `default.conf`, copy lại config, reload nginx |

### 9.1 Cloudflare Error 522 — Connection timed out

**522** = Cloudflare **không kết nối được TCP tới EC2 cổng 80**. Lỗi này xảy ra *trước* khi Nginx proxy tới Portainer/Rabbit — không phải lỗi `9443`/`15672`.

```text
Browser ──HTTPS──► Cloudflare ──HTTP :80──► EC2 Nginx ──► Portainer/Rabbit
                              ▲
                         522 = fail tại đây
```

Chạy lần lượt **trên EC2** (SSH):

```bash
# 1) Nginx đang chạy và listen :80?
sudo systemctl status nginx --no-pager
sudo ss -tlnp | grep ':80 '

# 2) Config hợp lệ?
sudo nginx -t

# 3) Test local (phải trả 200)
curl -fsS http://127.0.0.1/healthz
curl -fsS -H 'Host: portainer.kira.id.vn' http://127.0.0.1/ -o /dev/null -w '%{http_code}\n'

# 4) Có container Docker chiếm :80? (xung đột với nginx host)
docker ps --format '{{.Names}}\t{{.Ports}}' | grep ':80->' || true

# 5) IP public của máy này (so với DNS Cloudflare)
curl -s http://169.254.169.254/latest/meta-data/public-ipv4; echo
```

Chạy **từ máy local** (ngoài EC2):

```bash
# Thay <EC2_PUBLIC_IP> — phải trả "nginx ok"
curl -v --max-time 10 http://<EC2_PUBLIC_IP>/healthz
```

| Kết quả | Nguyên nhân | Cách sửa |
|---|---|---|
| Local `curl 127.0.0.1/healthz` OK, **curl IP public timeout** | **Security Group** chưa mở inbound TCP **80** | AWS Console → EC2 → Security Group → Inbound: `HTTP 80` từ `0.0.0.0/0` |
| `curl IP` timeout, nginx **không** listen `:80` | Nginx chưa cài / failed start | `sudo dnf install -y nginx`; `sudo nginx -t`; `sudo systemctl enable --now nginx` |
| `nginx -t` fail `duplicate map` | Copy trùng file conf | Xoá file cũ trong `/etc/nginx/conf.d/`, chỉ giữ `kira-infra.conf` |
| Docker container bind `:80` | Xung đột với nginx host | `docker stop kira-nginx` hoặc đổi port container — **chỉ một** process listen `:80` |
| DNS A record ≠ IP bước 5 | Cloudflare trỏ sai máy | Cloudflare → DNS → `portainer` / `rabbit` A record = IP EC2 đúng |
| EC2 không có public IP | Subnet private, không route | Gán Elastic IP hoặc dùng instance có public IP |

**Cloudflare checklist:**

1. DNS record `portainer` / `rabbit`: type **A**, content = **EC2 public IP**, proxy **ON** (orange cloud).
2. SSL/TLS mode: **Flexible** (Cloudflare → origin dùng HTTP `:80`).
3. Sau khi sửa SG/nginx: Cloudflare → **Caching → Purge Everything** (tuỳ chọn).

**Phân biệt mã lỗi:**

| Mã | Ý nghĩa |
|---|---|
| **522** | Cloudflare không connect được EC2 `:80` (SG / nginx down / sai IP) |
| **502** | Nginx nhận request nhưng upstream (`9443`/`15672`) lỗi — kiểm tra `docker ps`, `curl localhost:9443` |
| **525/526** | Lỗi SSL giữa Cloudflare ↔ origin — đổi SSL mode sang **Flexible** nếu origin chỉ HTTP |

---

## Tham chiếu trong repo

- Stack RabbitMQ: [`scripts/stack-rabbitmq.yml`](../scripts/stack-rabbitmq.yml)
- Stack kira-producer: [`scripts/stack-kira-producer.yml`](../scripts/stack-kira-producer.yml)
- Stack producer + queue (1 máy): [`scripts/stack-producer-queue.yml`](../scripts/stack-producer-queue.yml)
- Setup EC2 worker kira-queue: [`queue.md`](../queue.md)
- Bootstrap EC2: [`scripts/ec2-bootstrap.sh`](../scripts/ec2-bootstrap.sh)
- Build image AMD64: [`scripts/build-producer-queue.sh`](../scripts/build-producer-queue.sh)
- Env production chung: [`.env.ec2.example`](../.env.ec2.example)
- Nginx infra (Portainer + RabbitMQ): [`scripts/nginx-infra.conf`](../scripts/nginx-infra.conf)
