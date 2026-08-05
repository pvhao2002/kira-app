# Kira WebSocket Guidelines

## Scope

This is a small Spring WebSocket transport service. Keep it focused on connection setup, destinations, subscriptions, and message delivery.

## Change Rules

- Do not place database access or core business workflows in this module; obtain domain events through an explicit service boundary.
- Keep destination names and payloads backward compatible with current clients. Inspect subscribers before renaming an endpoint or changing a message shape.
- Configure origins, heartbeats, frame/message limits, and broker settings explicitly. Do not use unrestricted origins with credentialed connections.
- Treat connection identity and authorization as security-sensitive. Never trust a user identifier supplied only by the client payload.
- Avoid per-session unbounded buffers, blocking work on WebSocket threads, and logs for every heartbeat/message. Log connection summaries and actionable delivery failures only.

## Verification

Run `./mvnw.cmd compile` from this directory after Java changes. Do not start a broker, clients, tests, or package builds unless explicitly requested. Compilation does not verify handshake, reconnect, or delivery behavior.
