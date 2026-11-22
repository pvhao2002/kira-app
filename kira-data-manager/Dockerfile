FROM maven:3.9.8-eclipse-temurin-21 AS build
# Pin the actual JVM independently of the Maven image: patched Amazon Corretto, checksum-verified.
ARG TARGETARCH
RUN set -eu; case "${TARGETARCH:-amd64}" in \
      amd64) arch=x64; checksum=2aaa2a9a43143b20ff0b28c8d0da27407b97dc40b160d9a2f60a26965815e948 ;; \
      arm64) arch=aarch64; checksum=55751c47c7e3be3b33af43ccdcf3a6f4814d308390b7400477594d421bd16a53 ;; \
      *) echo "Unsupported JDK architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL --retry 3 "https://corretto.aws/downloads/resources/21.0.13.1.2/amazon-corretto-21.0.13.1.2-linux-$arch.tar.gz" -o /tmp/jdk.tar.gz; \
    echo "$checksum  /tmp/jdk.tar.gz" | sha256sum -c -; \
    mkdir -p /opt/java/patched; \
    tar -xzf /tmp/jdk.tar.gz --strip-components=1 -C /opt/java/patched; \
    rm /tmp/jdk.tar.gz
ENV JAVA_HOME=/opt/java/patched
ENV PATH="/opt/java/patched/bin:$PATH"
ENV JAVA_TOOL_OPTIONS="-XX:-UseBASE64Intrinsics"
RUN java -version 2>&1 | grep '21.0.13.1'

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
ENV JAVA_TOOL_OPTIONS="-XX:-UseBASE64Intrinsics"
ENV SERVER_PORT=7777

RUN useradd -m spring && chown -R spring:spring /app
USER spring

EXPOSE ${SERVER_PORT}

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
