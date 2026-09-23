# Contributing to Kira App

Thanks for taking the time to contribute. This document covers how to propose a change, how the
repository is organised, and the rules a pull request has to satisfy.

## Table of Contents

- [Ground Rules](#ground-rules)
- [Getting Set Up](#getting-set-up)
- [How the Repository Is Organised](#how-the-repository-is-organised)
- [Making a Change](#making-a-change)
- [Verification](#verification)
- [Coding Style](#coding-style)
- [Non-Negotiables](#non-negotiables)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Reporting Bugs](#reporting-bugs)
- [Security Issues](#security-issues)

## Ground Rules

- Be respectful and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Open an issue before starting large or architectural work, so effort is not wasted.
- One concern per pull request. A refactor bundled with a feature is two pull requests.
- Never commit secrets, real credentials, production data, or personal information.

## Getting Set Up

Follow [Getting Started](README.md#getting-started) in the README. The short version:

```bash
git clone https://github.com/pvhao2002/kira-app.git
cd kira-app
cp .env.example .env          # Windows: copy .env.example .env
docker compose up -d          # MySQL + RabbitMQ + nginx
```

Then run only the module you are working on.

## How the Repository Is Organised

This is a monorepo of independent, separately versioned services and apps. **There is no root
build** — each module builds and is verified on its own.

Instructions are layered:

| File | Scope |
| --- | --- |
| `AGENTS.md` | General rules for the whole repository |
| `<module>/AGENTS.override.md` | Module-specific scope, change rules, and exact verification command — **takes precedence** for that module |
| `CLAUDE.md` | The same guidance, for Claude Code |

Read the override for whatever module you are touching before you change anything.

`kira-bank/` is a **nested, independently git-tracked repository** for a separate product. Commits,
branches and pull requests for it are made from inside that directory, and it has its own
`AGENTS.override.md` chain.

## Making a Change

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/short-description
   ```
2. Read the target module's `AGENTS.override.md`.
3. Make the change, keeping it scoped to one concern.
4. Verify it (below).
5. Open a pull request.

### Cross-module contracts

Some changes span two modules that cannot both be built in one step. These **must** be inspected on
both sides in the same change, even when you can only compile one:

- Any queue name, routing key, or message DTO between `kira-producer` and `kira-queue`.
- Any API contract shared with `kira-ui`, `mobile-app`, or other gateway consumers.

## Verification

The repository rule is: **verify only the module you changed, and only by the method its override
specifies.** Do not run tests, packaging, other modules, Docker, or full-stack builds unless the
change actually calls for it.

| Module type | Command |
| --- | --- |
| Any Java module | `cd <module>` then `./mvnw.cmd compile` (Windows) or `./mvnw compile` |
| `kira-crawl-java` | `mvn compile` — this module ships no Maven wrapper |
| `kira-ui`, `mobile-app`, `kira-bank-ui` | No build/lint/test by default; a build is not proof of correct UI behaviour — check the rendered page or screen |

Compile success is the required verification for backend changes. If you add tests, run that
module's suite and say so in the pull request.

## Coding Style

**Java**

- Standard Spring layering: `Controller` / `rest`, `Service`, `Repository`, `Config`, and DTO
  suffixes. Test classes end in `Test`.
- Follow the existing package and folder conventions of the module you are in.
- `kira-schema` owns shared entities — depend on it rather than redefining entities locally.

**TypeScript / Angular**

- Two-space indentation, single quotes. `kira-ui/.editorconfig` and the Prettier settings are
  authoritative.
- Angular files use lowercase-hyphenated names, e.g. `match-detail.ts`.
- Standalone components and Signals; avoid adding modules where a standalone component fits.

**React Native**

- Routes in `mobile-app/app`, presentation in `components`, screens in `screens`, state in
  `contexts` and hooks.

## Non-Negotiables

These apply everywhere in the repository and will block a pull request:

- **Money** is always `BigDecimal`, never floating point. Ledgers stay append-only, settlement
  stays idempotent, and ownership checks stay in place.
- **Logging**: never log tokens, passwords, secrets, JWTs, cookies, financial payloads, document
  contents, or full third-party responses. Return domain-specific errors — not stack traces, SQL,
  or internal paths.
- **Schema changes** are additive migrations. Never edit a migration that has already been applied
  (`kira-schema/src/main/resources/database/migrate`;
  `kira-bank-service/src/main/resources/db/migration` for Flyway).
- **Queue consumers** must be redelivery-safe: ack only after success, no duplicate side effects,
  and no slow browser or database work on the RabbitMQ listener thread.
- **Playwright** pages, contexts and streams are released on every path, within the configured pool
  and timeout limits.
- **Configuration** lives in environment variables and `application.yml` placeholders, never
  hard-coded. Use the `.env*.example` files as the shape reference and never commit a real one.

## Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/), with an optional module scope:

```
feat(kira-gateway): add statement export endpoint
fix(kira-queue): release Playwright context on timeout
docs: document the crawl exchange routing keys
chore(deps): bump Angular to 21.0.6
refactor(kira-producer): extract schedule configuration
```

Prefixes in use: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`.

## Pull Requests

A pull request should:

- Describe **what** changed and **why**.
- List the affected modules.
- State how it was verified, with the command output.
- Link the related issue, if there is one.
- Include screenshots or a short recording for visible UI changes.
- Call out any contract change (queue, DTO, API) explicitly.

Keep the diff focused. Unrelated formatting churn makes review slower and is usually rejected.

## Reporting Bugs

Open a [GitHub issue](https://github.com/pvhao2002/kira-app/issues) with:

- The module involved and the version or commit.
- What you expected, and what happened instead.
- Minimal steps to reproduce.
- Relevant logs — **with tokens, passwords and personal data removed**.
- Your environment: OS, JDK, Node, Docker versions.

## Security Issues

Do **not** open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
