# ===========================
# STAGE 1: Build & JLink
# ===========================
FROM maven:3.9.8-eclipse-temurin-21 AS build

WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src src
RUN mvn clean package -DskipTests
# Extract Spring Boot layers
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

# Copy minimal JRE
COPY --from=build /javaruntime /opt/jre-min

# Cài Firefox + dependencies cần thiết cho Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    firefox-esr \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libatspi2.0-0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm-dev libgtk-3-0 \
    libasound2 libx11-xcb1 libxshmfence1 libxkbcommon0 \
    fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Thiết lập PATH cho JRE
ENV PATH="/opt/jre-min/bin:$PATH"
# 🔧 disable sandbox for firefox
ENV MOZ_DISABLE_CONTENT_SANDBOX=1

# Non-root user để tránh sandbox lỗi
RUN useradd -m spring && chown -R spring:spring /app

USER spring

EXPOSE 2323

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
