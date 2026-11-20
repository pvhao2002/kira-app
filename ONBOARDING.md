# Welcome to Kira

## How We Use Claude

Based on kira.pham's usage over the last 30 days:

Work Type Breakdown:
  Build Feature    ████████░░░░░░░░░░░░  40%
  Plan Design      ████░░░░░░░░░░░░░░░░  20%
  Improve Quality  ████░░░░░░░░░░░░░░░░  20%
  Write Docs       ████░░░░░░░░░░░░░░░░  20%

Top Skills & Commands:
  /clear                               ████████████████████  2x/month
  /plan-to-verify                      ████████████████████  2x/month
  /ponytail:ponytail-review            ████████████████████  2x/month
  /add-dir                             ██████████░░░░░░░░░░  1x/month
  /frontend-design:frontend-design     ██████████░░░░░░░░░░  1x/month
  /model                               ██████████░░░░░░░░░░  1x/month
  /security-review                     ██████████░░░░░░░░░░  1x/month
  /ui-ux-pro-max:ui-ux-pro-max         ██████████░░░░░░░░░░  1x/month
  /superpowers:requesting-code-review  ██████████░░░░░░░░░░  1x/month

Top MCP Servers:
  playwright  ████████████████████  17 calls

## Your Setup Checklist

### Codebases
- [ ] kira-app — https://github.com/pvhao2002/kira-app (monorepo; `kira-bank` is a nested repo with its own `.git`)

### MCP Servers to Activate
- [ ] playwright — drives a real browser so Claude can open `kira-ui` pages, click through flows, and screenshot results for UI QA. Install with `claude mcp add playwright -- npx @playwright/mcp@latest`.
- [ ] gitnexus — code-intelligence graph the repo's CLAUDE.md requires (impact analysis before edits). Run the `/setup-dev-workflow` skill to install it plus the index.

### Skills to Know About
- /plan-to-verify — runs dev-workflow as a multi-agent pipeline: plan → TDD → review → verify. Run with `planOnly` first, approve the plan, then rerun.
- /ponytail:ponytail-review — review that hunts over-engineering: what to delete or simplify.
- /security-review — security review of pending changes on the current branch.
- /superpowers:requesting-code-review — correctness review before merging.
- /frontend-design:frontend-design and /ui-ux-pro-max:ui-ux-pro-max — UI design guidance when building or reshaping screens in `kira-ui`.
- /add-dir — give Claude access to an extra directory (e.g. a sibling repo) in the same session.
- /model — switch the model for the session.
- /clear — reset context between unrelated tasks.

## Team Tips

_TODO_

## Get Started

_TODO_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
