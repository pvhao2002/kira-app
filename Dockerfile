# ===== Stage 1: Build the Spring Boot fat JAR with layers =====
FROM maven:3-eclipse-temurin-21-alpine AS build
RUN apk add --no-cache binutils

WORKDIR /app

# Copy Maven config first for dependency caching
COPY pom.xml ./

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src src
RUN mvn package -DskipTests

# Extract Spring Boot layers
RUN java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination ./layers

RUN jdeps \
    --ignore-missing-deps \
    --multi-release 21 \
    --print-module-deps \
    --class-path 'layers/dependencies/BOOT-INF/lib/*' \
    target/*.jar > modules.txt

RUN jlink \
    --add-modules $(cat modules.txt),jdk.crypto.ec \
    --strip-debug \
    --no-man-pages \
    --no-header-files \
    --compress=2 \
    --output /javaruntime

    # ===== Stage 2: Runtime image =====
FROM alpine:3 AS runtime
# Optional libs
RUN apk --no-cache add bash ca-certificates openssl update-ca-certificates \
    && addgroup -S spring \
    && adduser -S spring -G spring \
    && mkdir -p /app/logs \
    && chown spring:spring /app/logs


WORKDIR /app
# Add custom JRE
COPY --from=build /javaruntime /opt/java/jre
# Add application layers
COPY --chown=spring:spring --from=build /app/layers/dependencies/ /app/layers/snapshot-dependencies/ /app/layers/spring-boot-loader/ ./
COPY --chown=spring:spring --from=build /app/layers/application/ ./


ENV PATH="/opt/java/jre/bin:${PATH}"

USER spring:spring

EXPOSE 2308
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "org.springframework.boot.loader.launch.JarLauncher"]
