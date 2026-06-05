#!/usr/bin/env bash
set -euo pipefail

# First-time EC2 setup (Amazon Linux 2023).
# Run as ec2-user with sudo.

APP_DIR="${APP_DIR:-/opt/kira-app}"
REPO_URL="${REPO_URL:-https://github.com/YOUR_ORG/kira-app.git}"
BRANCH="${BRANCH:-master}"

echo "==> Install Docker"
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo "==> Install Docker Compose plugin"
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "==> Clone app"
sudo mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo git clone "$REPO_URL" "$APP_DIR"
  sudo chown -R "$USER:$USER" "$APP_DIR"
fi

cd "$APP_DIR"
git checkout "$BRANCH" || true
git pull --ff-only origin "$BRANCH" || true

if [[ ! -f .env.ec2 ]]; then
  cp .env.ec2.example .env.ec2
  echo "Created .env.ec2 — edit DB/Rabbit secrets before first deploy"
fi

chmod +x scripts/deploy-ec2.sh

echo "==> Bootstrap done"
echo "Next: edit $APP_DIR/.env.ec2 then run:"
echo "  docker compose --env-file .env.ec2 -f docker-compose.prod.yml up -d"
echo "  # or: ./scripts/deploy-ec2.sh"
