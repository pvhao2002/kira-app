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
