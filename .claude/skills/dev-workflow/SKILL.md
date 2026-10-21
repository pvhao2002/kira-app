---
name: dev-workflow
description: Entry point for implementation, bug fixing, refactoring, or feature/improvement work. Classifies the task, then routes through Superpowers process skills, GitNexus graph analysis, and Ponytail minimalism (debug or brainstorm, plan, TDD execution, correctness + over-engineering review, graph-verified completion, branch finishing).
---

# Automated Development Workflow

You are the workflow orchestrator.

The user provides a task or requirement. You coordinate the
installed skills and tools below. Invoke each skill with the
Skill tool. Do not pretend to run a skill.

Each toolset has one role:
- **Superpowers**: process (debug, design, plan, execute, review, finish).
- **GitNexus**: code understanding and blast radius (graph before grep).
- **Ponytail**: minimal solution and over-engineering check.

Use `superpowers:writing-plans` / `executing-plans` for plans.
Do not also run `gitnexus-plan` / `gitnexus-work` / `gitnexus-lfg`:
they duplicate this pipeline.

## General Rules

- Do not ask questions whose answers are available in the repository.
- Ask one focused clarification question at a time.
- Continue automatically when requirements are sufficiently clear.
- Never skip critical security or verification steps.
- Preserve user changes and existing project conventions.
- Respect mandatory approval gates of installed skills.
- Stop for destructive or production-sensitive actions.
- Keep all user-facing clarification and approvals in the main conversation.

## Step 0: Index Check

Read `gitnexus://repo/kira-app/context`, or run
`node .gitnexus/run.cjs status`. If the index is stale,
refresh it with `gitnexus-cli` before relying on the graph.

## Step 1: Classify the Task

Classify the task as **bug**, **feature**, **improvement**, or **refactor**.
If the request makes the type clear, do not ask.
Otherwise ask the user one question.

Gate: Task type is known.

## Step 2: Understand

Read before deciding. Ponytail shortens the solution, never the reading.

- **Bug**: `superpowers:systematic-debugging` for the process;
  `gitnexus-debugging` to trace the failing flow. For intermittent
  failures or performance regressions, add `investigate-first`.
- **Feature / Improvement**: `gitnexus-exploring` to map the
  related modules, flows, and existing helpers to reuse.
- **Refactor**: `gitnexus-refactoring`. Renames go through the
  GitNexus `rename` tool, never find-and-replace.

For every symbol you plan to edit, run `gitnexus-impact-analysis`
(`impact` upstream). Report callers, processes, and risk.
- Warn the user on HIGH/CRITICAL risk.
- Treat UNKNOWN as unresolved: confirm with a text search.

Gate: Root cause known (bug), or affected code paths and
impact known (feature/improvement/refactor).

## Step 3: Design and Plan

Apply `ponytail:ponytail` while designing. Climb the ladder:
need it at all → already in codebase → stdlib → native platform
→ installed dependency → one line → minimum code.

- **Bug, small fix** (root cause clear, 1-2 files): skip planning.
  Fix at the shared function where all callers route through.
- **Bug, otherwise**: `superpowers:writing-plans`.
- **Feature / Improvement**: `superpowers:brainstorming` (design
  approval), then `superpowers:writing-plans`.
- **Refactor**: `superpowers:writing-plans` with the GitNexus impact
  results; keep behavior identical.

Each plan task lists the symbols it edits and their impact risk.

Gate: Plan approved (or small fix confirmed).

## Step 4: Execute

Choose one execution skill:
- `superpowers:subagent-driven-development`: the plan has
  independent tasks and a subagent tool is available.
- `superpowers:executing-plans`: tasks are sequential, share state,
  the user chose inline execution, or no subagent tool is available.

Every task follows `superpowers:test-driven-development`:
1. Run `impact` on the symbol if not already done.
2. Write a failing test.
3. Verify it fails for the expected reason.
4. Implement the simplest correct solution (Ponytail).
5. Run focused tests.
6. Refactor without changing behavior.

Mark deliberate shortcuts with a `ponytail:` comment naming the
ceiling and the upgrade path.

Do not silently ignore failures. Failing test with unclear cause:
back to `superpowers:systematic-debugging`.

## Step 5: Code Review

1. `superpowers:requesting-code-review`: correctness against requirements.
2. `ponytail:ponytail-review`: over-engineering in the diff.
3. `gitnexus-review` on the local changes: merge risk, regressions,
   missing tests.
4. `superpowers:receiving-code-review`: verify each finding against
   the code before changing anything. Push back with evidence when
   a finding is wrong.

## Step 6: Verification

`superpowers:verification-before-completion`.

Run GitNexus `detect_changes({scope: "all"})`.
`partial: true` or `truncated: true` is not a clean check: re-run.
Changed symbols and processes must match the plan.

Check:
- Acceptance criteria
- Relevant unit and integration tests
- Regression risks
- Security boundaries
- Unrelated changes

Gate: Required checks pass or blockers are reported.

## Step 7: Finish

1. `ponytail:ponytail-debt`: list the `ponytail:` shortcuts this
   change added, so they are tracked.
2. `superpowers:finishing-a-development-branch`.

Before any commit, `detect_changes` must be clean (Step 6).

Report concisely:
- Implemented changes
- Changed files
- Tests and results
- Impact risk and new `ponytail:` debt
- Remaining risks or blockers

Do not claim tests passed unless actually executed.
Do not commit, push, merge or deploy without
the authorization required by project policy.

## Failure Handling

- Missing GitNexus: report limitation; inspect source directly.
- Stale graph: refresh with `gitnexus-cli` before relying on it.
- Missing skill or GitNexus: suggest the `setup-dev-workflow` skill;
  meanwhile use safe equivalent steps.
- Failed tests: use systematic-debugging, fix, and rerun.
- Ambiguous requirement: ask the user.
- Destructive action: request explicit approval.
- Repeated blocker (3 failed fixes): stop and report evidence.
