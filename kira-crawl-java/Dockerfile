# ===========================
# STAGE 1: Build, JLink & Playwright Chromium
# ===========================
FROM maven:3.9.8-eclipse-temurin-21 AS build

WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src src
RUN mvn clean package -DskipTests

# Bake Chromium into a fixed path for the runtime stage (version must match pom.xml).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN mkdir -p /ms-playwright && \
    mvn exec:java -e \
        -Dexec.mainClass=com.microsoft.playwright.CLI \
        -Dexec.args="install chromium" \
        -B --no-transfer-progress

RUN java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination ./layers
RUN jdeps \
    --ignore-missing-deps \
    --multi-release 21 \
    --print-module-deps \
    --class-path 'layers/dependencies/BOOT-INF/lib/*' \
    target/*.jar > modules.txt
RUN jlink \
    --add-modules $(cat modules.txt),jdk.crypto.ec,jdk.charsets,jdk.zipfs \
    --strip-debug \
    --no-man-pages \
    --no-header-files \
    --compress=2 \
    --output /javaruntime

# ===========================
# STAGE 2: Runtime
# ===========================
FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

COPY --from=build /javaruntime /opt/jre-min
COPY --from=build /ms-playwright /ms-playwright

# Chromium system libraries required by Playwright on Debian bookworm.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/* \
    && chmod -R 777 /ms-playwright

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

ENV PATH="/opt/jre-min/bin:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV KIRA_CRAWL_PORT=4000
ENV PLAYWRIGHT_HEADLESS=true
ENV PLAYWRIGHT_TEST_API_ENABLED=false

RUN useradd -m spring && chown -R spring:spring /app
USER spring

EXPOSE 4000

# Recommended at runtime: docker run --ipc=host ...
ENTRYPOINT ["java", \
    "-XX:MaxRAMPercentage=75", \
    "-XX:+ExitOnOutOfMemoryError", \
    "-jar", "app.jar"]
