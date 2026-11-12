#!/usr/bin/env bash
set -euo pipefail
backup=/opt/kira-tool/caddy-backup
mkdir -p "$backup" /etc/nginx/tls /var/www/letsencrypt
chmod 700 "$backup" /etc/nginx/tls
python3 - <<'PY'
import ipaddress
import json
import urllib.request
from pathlib import Path
with urllib.request.urlopen('https://api.cloudflare.com/client/v4/ips', timeout=30) as response:
    payload = json.load(response)
assert payload['success']
networks = [str(ipaddress.ip_network(cidr)) for key in ('ipv4_cidrs', 'ipv6_cidrs') for cidr in payload['result'][key]]
assert len(networks) >= 2
Path('/etc/nginx/conf.d/cloudflare-real-ip.conf').write_text(
    '\n'.join('set_real_ip_from ' + network + ';' for network in networks)
    + '\nreal_ip_header CF-Connecting-IP;\n')
PY
cp -a /etc/caddy/Caddyfile "$backup/"
certdir=/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/kira.id.vn
install -m 644 "$certdir/kira.id.vn.crt" /etc/nginx/tls/kira.id.vn.crt
install -m 600 "$certdir/kira.id.vn.key" /etc/nginx/tls/kira.id.vn.key
cp -a /etc/nginx/sites-enabled "$backup/nginx-sites-enabled"
python3 - <<'PY'
from pathlib import Path
config = Path('/opt/kira-tool/deploy/nginx.conf').read_text()
tool = 'server {\n    listen 443 ssl http2;\n    server_name tool.kira.id.vn;'
assert config.count(tool) == 1
Path('/etc/nginx/sites-available/kira').write_text(config.split(tool)[0])
PY
if [ -L /etc/nginx/sites-enabled/default ]; then unlink /etc/nginx/sites-enabled/default; fi
ln -sfn /etc/nginx/sites-available/kira /etc/nginx/sites-enabled/kira
nginx -t
systemctl stop caddy
if ! systemctl start nginx; then
    systemctl start caddy
    exit 1
fi
if ! curl --fail --silent --resolve kira.id.vn:443:127.0.0.1 https://kira.id.vn/ -o /dev/null; then
    systemctl stop nginx
    systemctl start caddy
    exit 1
fi
systemctl enable nginx
systemctl disable caddy
certbot certonly --webroot -w /var/www/letsencrypt -d kira.id.vn --non-interactive --agree-tos --register-unsafely-without-email
certbot certonly --webroot -w /var/www/letsencrypt -d tool.kira.id.vn --non-interactive --agree-tos --register-unsafely-without-email
python3 - <<'PY'
from pathlib import Path
config = Path('/opt/kira-tool/deploy/nginx.conf').read_text()
config = config.replace('/etc/nginx/tls/kira.id.vn.crt', '/etc/letsencrypt/live/kira.id.vn/fullchain.pem')
config = config.replace('/etc/nginx/tls/kira.id.vn.key', '/etc/letsencrypt/live/kira.id.vn/privkey.pem')
Path('/etc/nginx/sites-available/kira').write_text(config)
PY
nginx -t
systemctl reload nginx
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nnginx -t && systemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/nginx-reload
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/nginx-reload
systemctl enable --now certbot.timer
curl --fail --silent --resolve kira.id.vn:443:127.0.0.1 https://kira.id.vn/ -o /dev/null
curl --fail --silent --resolve tool.kira.id.vn:443:127.0.0.1 https://tool.kira.id.vn/ -o /dev/null
apt-get remove -y caddy
