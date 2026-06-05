# syntax=docker/dockerfile:1

# ===========================
# STAGE 1: Build Angular app
# ===========================
FROM node:22-alpine AS build

WORKDIR /app

ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json ./
COPY postcss.config.js tailwind.config.js .postcssrc.json proxy.conf.js ./
COPY public ./public
COPY src ./src

ENV NODE_ENV=production
RUN npm run build -- --configuration=production

# ===========================
# STAGE 2: Nginx runtime
# ===========================
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist/kira-ui/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

ENTRYPOINT ["nginx", "-g", "daemon off;"]
