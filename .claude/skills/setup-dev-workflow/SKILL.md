---
name: setup-dev-workflow
description: Install everything the dev-workflow skill depends on (Superpowers and Ponytail plugins, GitNexus CLI, MCP server, index, and gitnexus-* skills) on a new machine or for a new teammate. Use when the user says "setup dev-workflow", "install the workflow skills", "cài skill cho dev-workflow", or when dev-workflow reports a missing skill or GitNexus tool.
---

# Setup dev-workflow

Installs the providers that `dev-workflow` routes through.
Idempotent: check first, install only what is missing.

## What gets installed

| Provider | Install | Gives |
|---|---|---|
| Superpowers | plugin `superpowers@claude-plugins-official` (marketplace `anthropics/claude-plugins-official`) | brainstorming, writing-plans, executing-plans, subagent-driven-development, TDD, systematic-debugging, code review, verification, finishing-a-development-branch |
| Ponytail | plugin `ponytail@ponytail` (marketplace `DietrichGebert/ponytail`) | ponytail, ponytail-review, ponytail-debt |
| GitNexus | npm package `gitnexus` | CLI, MCP server, `.gitnexus/` index, `gitnexus-*` skills, `gitnexus-review` |
| Caveman (optional) | plugin `caveman@caveman` (marketplace `JuliusBrussee/caveman`) | investigate-first (only used for intermittent bugs) |

Plugins and the npm package are third-party code downloaded from GitHub/npm.
Show the user this table and get one confirmation before installing.
Ask whether to include the optional Caveman plugin.

## Step 1: Prerequisites

Run and check:
- `claude --version`
- `node --version` (Node 18+)
- `git rev-parse --show-toplevel` (must be inside the target repo)

Stop and report if any is missing.

## Step 2: Check current state

- `claude plugin list`
- `claude mcp list`
- `gitnexus --version`
- `node .gitnexus/run.cjs status` (from the repo root)

Skip every item below that is already installed and enabled.

## Step 3: Plugins

For each missing plugin, add its marketplace, then install it (user scope):

```
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install superpowers@claude-plugins-official

claude plugin marketplace add DietrichGebert/ponytail
claude plugin install ponytail@ponytail

# optional
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman
```

If a marketplace already exists, `marketplace add` fails harmlessly: continue.
If a plugin is installed but disabled: `claude plugin enable <plugin>`.

## Step 4: GitNexus CLI and MCP

```
npm i -g gitnexus
gitnexus setup
```

`gitnexus setup` configures MCP, skills, and hooks for every detected
editor, not only Claude Code. Tell the user before running it.
To limit it: `gitnexus setup --coding-agent <agent>` (see `gitnexus setup --help`).

npm 11 `npx` may crash (`node.target is null`); the global install avoids it.
Bun-only machine: use `bunx gitnexus@latest` instead of `gitnexus`.

## Step 5: Index the repo

From the repo root:

```
gitnexus analyze
```

This creates `.gitnexus/` (index + `run.cjs` runner), installs the
project `gitnexus-*` skills under `.claude/skills/`, and injects the
GitNexus section into `CLAUDE.md` / `AGENTS.md`.
Large repos take several minutes: run it in the background.

## Step 6: Verify

- `claude plugin list`: superpowers, ponytail enabled.
- `claude mcp list`: `gitnexus` connected.
- `node .gitnexus/run.cjs status`: index up to date.
- `.claude/skills/` contains `dev-workflow` and `gitnexus-*`.

Report what was installed, what was skipped, and any failure with
its exact error. Do not claim success for a step that was not run.

## Step 7: Restart

Plugins, skills, and MCP servers load at session start.
Tell the user to restart Claude Code, then run `/dev-workflow`.
