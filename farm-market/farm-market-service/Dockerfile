FROM maven:3.9.11-eclipse-temurin-25 AS build
# Pin the actual JVM independently of the Maven image: patched Amazon Corretto, checksum-verified.
ARG TARGETARCH
RUN set -eu; case "${TARGETARCH:-amd64}" in \
      amd64) arch=x64; checksum=8d2be3f035dbdb7f7475e2f7009b7dc20683bfc351ad41064218c8de596c9644 ;; \
      arm64) arch=aarch64; checksum=9370d3e5bcf0d165e6be4a78c3f6b57160af16d3033319af583800251eb91df2 ;; \
      *) echo "Unsupported JDK architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL --retry 3 "https://corretto.aws/downloads/resources/25.0.5.1.2/amazon-corretto-25.0.5.1.2-linux-$arch.tar.gz" -o /tmp/jdk.tar.gz; \
    echo "$checksum  /tmp/jdk.tar.gz" | sha256sum -c -; \
    mkdir -p /opt/java/patched; \
    tar -xzf /tmp/jdk.tar.gz --strip-components=1 -C /opt/java/patched; \
    rm /tmp/jdk.tar.gz
ENV JAVA_HOME=/opt/java/patched
ENV PATH="/opt/java/patched/bin:$PATH"
ENV JAVA_TOOL_OPTIONS="-XX:-UseBASE64Intrinsics"
RUN java -version 2>&1 | grep '25.0.5.1'
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src src
RUN mvn -B -DskipTests package
FROM ubuntu:24.04
COPY --from=build /opt/java/patched /opt/java/patched
ENV JAVA_HOME=/opt/java/patched
ENV PATH="/opt/java/patched/bin:$PATH"
ENV JAVA_TOOL_OPTIONS="-XX:-UseBASE64Intrinsics"
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget ca-certificates libstdc++6 zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 farm
WORKDIR /app
COPY --from=build /workspace/target/farm-market-service-*.jar app.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-jar","app.jar"]
