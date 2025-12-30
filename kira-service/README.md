## install docker in aws Linux ##
# Cập nhật hệ thống
sudo dnf update -y
# Cài Docker từ repo Amazon Linux Extras
sudo dnf install -y docker
# Khởi động Docker và bật chạy cùng hệ thống
sudo systemctl start docker
sudo systemctl enable docker
# Kiểm tra Docker đã cài chưa
docker --version
## install network
docker network create kira-net


# Ubuntu 22.04 LTS
# 🧩 1️⃣ Cập nhật hệ thống
sudo apt update -y
# 🧲 3️⃣ Cài gói hỗ trợ HTTPS và repo
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
# 🧾 4️⃣ Thêm GPG key chính thức của Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 🪣 5️⃣ Thêm repository Docker vào apt
echo \
"deb [arch=$(dpkg --print-architecture) \
signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(lsb_release -cs) stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 🧱 6️⃣ Cài Docker Engine + CLI + Compose
sudo apt update -y
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# ✅ 7️⃣ Kiểm tra Docker hoạt động
sudo systemctl status docker



# Tạo portainer
🧱 2️⃣ Tạo volume để Portainer lưu dữ liệu
sudo docker volume create portainer_data

🚀 3️⃣ Chạy Portainer container
sudo docker run -d \
-p 8000:8000 \
-p 9443:9443 \
--name portainer \
--restart=always \
-v /var/run/docker.sock:/var/run/docker.sock \
-v portainer_data:/data \
portainer/portainer-ce:latest




[//]: # (docker run -d --name kira-service --network kira-net -p 8080:8080 kira-service-image)
[//]: # (docker run -d --name kira-ui --network kira-net -p 4200:80 kira-ui-image)


docker run -d -p 4200:4200 --name kira-ui-local --network kira-net kira2308/kira-ui

### build docker ##
mvn clean install
docker build --progress=plain --no-cache -t kira-service .
docker tag kira-service kira2308/kira-service
docker login
docker push kira2308/kira-service



### deploy aws ###
sudo docker pull kira2308/kira-service
sudo docker run -d -p 2308:2308 -e DB_HOST=... -e --name kira-be-aws --hostname kira-be-aws kira2308/kira-service
