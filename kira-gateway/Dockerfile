FROM maven:3.9.8-eclipse-temurin-21 AS build

WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
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

FROM debian:bookworm-slim

COPY --from=build /javaruntime /opt/jre-min
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

ENV PATH="/opt/jre-min/bin:$PATH"
ENV SERVER_PORT=6868

RUN useradd -m spring && chown -R spring:spring /app
USER spring

EXPOSE ${SERVER_PORT}

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
