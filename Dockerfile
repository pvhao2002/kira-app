# ===== Stage 1: Build the Spring Boot fat JAR with layers =====
FROM maven:3.9.11-amazoncorretto-21 AS build
RUN yum install -y binutils \
 && yum clean all

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
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
    --add-modules $(cat modules.txt),jdk.crypto.ec \
    --strip-debug \
    --no-man-pages \
    --no-header-files \
    --compress=2 \
    --output /javaruntime

# ===== Stage 2: Runtime =====
FROM amazonlinux:2023
# Cài công cụ để tạo user/group
RUN dnf install -y shadow-utils \
 && dnf clean all

# Tạo user non-root
RUN groupadd spring \
 && useradd -r -g spring spring \
 && mkdir -p /app/logs \
 && chown spring:spring /app/logs

WORKDIR /app
COPY --from=build /javaruntime /opt/java/jre
COPY --chown=spring:spring --from=build /app/layers/dependencies/ /app/layers/snapshot-dependencies/ /app/layers/spring-boot-loader/ ./
COPY --chown=spring:spring --from=build /app/layers/application/ ./

ENV PATH="/opt/java/jre/bin:${PATH}"

USER spring:spring

EXPOSE 2308
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "org.springframework.boot.loader.launch.JarLauncher"]
