# Build context is the parent of deploy/ (on the VPS: /opt/kira-tool), so app/ holds the service source.
FROM node:24-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app
COPY app/package.json app/package-lock.json ./
COPY deploy/patch-chrome-installer.mjs /tmp/patch-chrome-installer.mjs
RUN npm ci --omit=dev \
 && node /tmp/patch-chrome-installer.mjs \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates xvfb xauth \
 && npx --no-install patchright install chrome \
 && rm /tmp/patch-chrome-installer.mjs \
 && rm -rf /var/lib/apt/lists/* /root/.npm

COPY app/src ./src

# UID/GID 1001 matches the existing owner of /opt/kira-tool/data and /opt/kira-tool/storage (mode 750).
RUN groupadd --gid 1001 tool && useradd --uid 1001 --gid 1001 --create-home --shell /usr/sbin/nologin tool
USER tool

EXPOSE 1407
# Headed Chrome on a virtual display: headless Chrome is easier for bot detection to flag.
ENTRYPOINT ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24", "node", "src/server.ts"]
