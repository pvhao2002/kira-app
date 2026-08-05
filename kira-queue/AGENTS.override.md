# Kira Queue Guidelines

## Scope

This service consumes RabbitMQ crawl, prediction, and settlement jobs. It also coordinates Playwright crawling, gateway claim/callback calls, database persistence, and prediction engines.

## Change Rules

- Keep queue names, exchanges, routing keys, and message DTOs compatible with `kira-producer`. Trace both publisher and consumer before changing a message contract.
- Design consumers for redelivery: avoid duplicate side effects, acknowledge only after successful processing, and preserve the established retry/dead-letter behavior.
- Do not move slow browser or persistence work onto Rabbit listener threads. Respect the bounded executor and backpressure configuration.
- Close Playwright pages, contexts, streams, and other external resources on every path. Preserve timeouts and distinguish provider failures from permanent data errors.
- Keep prediction algorithms deterministic. When changing a prediction engine, trace registry selection, stored prediction fields, and settlement behavior together.
- Use parameterized JDBC and existing batch helpers; do not log SQL, credentials, or full third-party responses.

## Verification

Run `./mvnw.cmd compile` from this directory after Java changes. Do not start RabbitMQ, browsers, Docker, tests, or package builds unless explicitly requested. Document any publisher/consumer or runtime behavior that was checked only by inspection.
