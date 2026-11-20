FROM node:22-bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

# Remote display stack, same packages as kira-queue (Xvfb + openbox + x11vnc + noVNC).
# Chrome's own system libraries are installed by `patchright install --with-deps` below.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    novnc \
    openbox \
    websockify \
    x11vnc \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Real Chrome (patchright is built for the "chrome" channel). Google ships no Linux arm64 Chrome,
# so arm64 gets bundled Chromium in /ms-playwright; the entrypoint then defaults PLAYWRIGHT_CHANNEL=chromium.
ARG TARGETARCH
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN case "${TARGETARCH:-$(dpkg --print-architecture)}" in \
        arm64) npx patchright install --with-deps chromium ;; \
        *) npx patchright install --with-deps chrome ;; \
    esac \
    && rm -rf /var/lib/apt/lists/*

COPY src src
COPY docker-entrypoint.sh /usr/local/bin/kira-queue-entrypoint.sh
RUN mkdir -p /run/secrets && chmod +x /usr/local/bin/kira-queue-entrypoint.sh

ENV PLAYWRIGHT_HEADLESS=true
ENV KIRA_QUEUE_REMOTE_DISPLAY_ENABLED=false
ENV KIRA_QUEUE_NOVNC_PORT=6081
ENV KIRA_QUEUE_VNC_PORT=5901
ENV KIRA_QUEUE_VNC_PASSWORD_FILE=/run/secrets/kira_queue_vnc_password
ENV LOG_DIR=/app/logs

# Pre-create runtime dirs so a fresh named volume on /app/.playwright inherits node ownership.
RUN mkdir -p /app/.playwright /app/logs && chown -R node:node /app
USER node

EXPOSE 2323 6081 6082

# Recommended at runtime: docker run --ipc=host ...
ENTRYPOINT ["/usr/local/bin/kira-queue-entrypoint.sh"]
