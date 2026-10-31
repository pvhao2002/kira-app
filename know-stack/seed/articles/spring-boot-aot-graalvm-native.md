---
title: Spring Boot 3.2 AOT Native Images & GraalVM Compilation Architecture
summary: Reachability metadata, the closed-world assumption, dynamic proxy constraints, and trimming startup to milliseconds.
category: java-and-spring-boot
difficulty: mid
tags: Spring Boot, GraalVM, JVM Internals
views: 41200
daysAgo: 21
---
## 01 What AOT changes

A native image is compiled ahead of time under a **closed-world assumption**: every class, method and resource reachable at runtime must be known at build time. Spring Boot's AOT engine runs your application context during the build and generates plain Java code for bean definitions, so no classpath scanning happens at startup.

```bash
./mvnw -Pnative native:compile
./target/demo   # starts in ~50 ms
```

## 02 Reachability metadata

Reflection, resources, proxies and serialization need hints. Libraries ship them via the GraalVM reachability metadata repository; your own code registers them with `RuntimeHintsRegistrar`.

```java
class MyHints implements RuntimeHintsRegistrar {
    public void registerHints(RuntimeHints hints, ClassLoader cl) {
        hints.reflection().registerType(Invoice.class, MemberCategory.INVOKE_PUBLIC_METHODS);
        hints.resources().registerPattern("templates/*.html");
    }
}
```

> [!CAUTION]
> `@ConditionalOnProperty` is evaluated at **build time** in AOT. Profiles and conditions cannot change which beans exist at runtime.

## 03 When native is worth it

Native images win for scale-to-zero, CLIs and serverless: fast startup and low RSS. Long-running services often get better peak throughput from the JIT.

## Interview Q&A

**Q: Why do dynamic proxies need hints?** Proxy classes are generated at runtime on the JVM; in native they must be generated at build time.

**Q: What is the trade-off vs JIT?** Startup and memory vs peak throughput and build time.

**Q: How do you find missing hints?** Run tests with the tracing agent (`-agentlib:native-image-agent`).
