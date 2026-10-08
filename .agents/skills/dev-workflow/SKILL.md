---
name: dev-workflow
description: Orchestrate requirements clarification, repository exploration, planning, implementation, verification and delivery for coding tasks. Use GitNexus, Superpowers, Ponytail and Caveman when installed.
---
# Dev Workflow (Claude Code CLI + ChatGPT Codex App)

Follow the state machine in `workflow/engine.mjs` from repository root. First `node workflow/engine.mjs status` or, if no state exists, `node workflow/engine.mjs init "<user task>"`.

Phases, in order:
1. `requirements`: Use Superpowers brainstorming when useful. Ask one essential question at a time, only if repository inspection cannot resolve it. Record `acceptance` and `clarifications` (say `None needed` when true).
2. `exploration`: Use GitNexus for symbol navigation, dependencies, impact; verify actual source code. Record `code_paths` and `impact`. If GitNexus is unavailable, document fallback honestly.
3. `planning`: Use Superpowers planning and Ponytail simplicity principles. Record `plan` and `approval` (`Not required: bounded change` only if true); respect explicit design approvals.
4. `implementation`: Use Superpowers TDD/debugging and Ponytail minimal correct code. Record `changed_files` and `checks` with actual evidence.
5. `verification`: Run tests, acceptance review and GitNexus change impact check. Record `tests` and `acceptance_review`. Do not claim unrun tests passed.
6. `delivery`: Use Caveman-style concise communication. Record `summary`.

Each phase: `node workflow/engine.mjs record KEY "actual evidence"`, then `node workflow/engine.mjs gate`, then `node workflow/engine.mjs advance` only if gate passes. Never invent evidence, approvals, plugin invocations, or model switches. Retain user answers and decisions in state evidence. Do not silently modify deployed infrastructure, push, merge or perform destructive tasks.

Model selection: Run `node workflow/engine.mjs model claude` in Claude Code or `... model codex` in Codex to see desired model. This is **advisory**. In Claude Code, use the `/model` interface to select an available model at phase transitions; never claim the command switched it automatically. In the ChatGPT Codex App, model selection remains controlled by the app/user; never pretend to force Astra or Sol from repository files.

Caveman concision rules apply throughout, but must not remove critical diagnostics. Installed plugin capabilities and versions can vary. If not available, use native equivalents and declare fallback.
