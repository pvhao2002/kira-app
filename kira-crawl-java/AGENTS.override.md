# Kira Crawl Java Guidelines

## Scope

This service fetches and maps AiScore match/odds data, manages Playwright browser lanes, runs scheduled odds crawling, and reports crawl results to the gateway.

## Change Rules

- Keep provider transport, protobuf/JSON decoding, mapping, scheduling, and gateway callbacks separated across client, mapper, service, and schedule packages.
- Preserve provider field meanings and tolerate optional/missing upstream fields. Do not silently turn parse failures into valid empty results.
- Acquire and release Playwright lanes, pages, contexts, streams, and permits in exception-safe blocks. Respect configured pool sizes, timeouts, and Cloudflare handling.
- Keep scheduled work bounded and prevent overlapping jobs from exhausting browser resources.
- Keep gateway URLs, browser options, and crawl schedules configuration-driven. Never log cookies, tokens, proxy credentials, or complete provider payloads.
- Update `protobuf.json` only with evidence from the upstream contract and review mapper impact at the same time.

## Verification

This module has no Maven wrapper; run `mvn compile` from this directory after Java changes. Do not launch browsers, schedules, tests, or package builds unless explicitly requested. Treat compilation as different from live provider verification.
