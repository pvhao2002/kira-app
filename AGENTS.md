# Repository Guidelines

## Project Structure & Module Organization

This monorepo contains independent backend services and frontend apps. Java 21 Spring Boot services live in `kira-gateway`, `kira-queue`, `kira-producer`, `kira-data-manager`, `kira-crawl-java`, `kira-tool-service`, `kira-websocket`, and shared entities/schema code in `kira-schema`. Each Java service owns its own `pom.xml`, `src/main`, and `src/test` tree. The Angular web app is in `kira-ui`, with source under `kira-ui/src` and assets under `kira-ui/src/assets`. The Expo/React Native app is in `mobile-app`, with routes in `mobile-app/app`, shared UI in `mobile-app/components`, and assets in `mobile-app/assets`. Infrastructure and operations files live in `docker-compose*.yml`, `nginx`, `monitoring`, `mysql`, `scripts`, and `docs`.

## Build, Test, and Development Commands

For backend changes, compile only the affected Maven project and treat compile success as the required verification. Run commands inside the changed service directory, for example `cd kira-gateway` then `.\mvnw compile`. Do not run tests, package builds, Angular compilation, mobile linting, or unrelated module checks unless the user explicitly asks. Use `docker compose up -d` only when local infrastructure is needed for manual runtime checks.

## Coding Style & Naming Conventions

Use existing package and folder conventions. Java code follows standard Spring layering with `Controller`, `Service`, `Repository`, `Config`, and DTO suffixes. Test classes should end in `Test`. TypeScript uses two-space indentation and single quotes where configured; `kira-ui/.editorconfig` and Prettier settings define frontend formatting. Angular component files use lowercase hyphenated names, such as `match-detail.ts`.

## Commit & Pull Request Guidelines

Git history uses Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `chore:`, and `refactor:`. Keep commits scoped to one concern. Pull requests should describe the change, list affected modules, include test results, link related issues when available, and add screenshots for visible UI changes.

## Security & Configuration Tips

Do not commit real secrets. Use `.env.example`, `.env.host-dev.example`, `.env.compose-apps.example`, and `.env.ec2.example` as templates. Keep generated logs, uploads, build output, and dependency folders out of review unless the change explicitly concerns them.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **kira-app** (22582 symbols, 44895 relationships, 836 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "master"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "master" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/kira-app/context` | Codebase overview, check index freshness |
| `gitnexus://repo/kira-app/clusters` | All functional areas |
| `gitnexus://repo/kira-app/processes` | All execution flows |
| `gitnexus://repo/kira-app/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
