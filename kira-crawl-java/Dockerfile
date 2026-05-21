# ===========================
# STAGE 1: Build & JLink
# ===========================
FROM maven:3.9.8-eclipse-temurin-21 AS build

WORKDIR /app
COPY pom.xml .
COPY protobuf.json .
RUN mvn dependency:go-offline -B
COPY scripts scripts
COPY src src
RUN mvn clean package -DskipTests
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

COPY --from=build /javaruntime /opt/jre-min

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libatspi2.0-0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm-dev libgtk-3-0 \
    libasound2 libx11-xcb1 libxshmfence1 libxkbcommon0 \
    libpangocairo-1.0-0 libpango-1.0-0 libcairo2 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
COPY --from=build /app/protobuf.json protobuf.json

ENV PATH="/opt/jre-min/bin:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV KIRA_CRAWL_PORT=3000

RUN useradd -m spring && chown -R spring:spring /app /ms-playwright
USER spring

EXPOSE 3000
ENTRYPOINT ["java", "-jar", "app.jar"]
