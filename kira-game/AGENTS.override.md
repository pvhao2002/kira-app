# kira-game — module rules

Scope: `kira-game/` only. A browser 3D story game in Vietnamese: high school → first love → university → after
university. No backend and no login: the player types a name and picks a gender; progress lives in localStorage.

Status: planning, no code yet. Design: `docs/design.md`. Build plan: `docs/plan.md`. Story drafts (Markdown, written
separately): `docs/story/`.

- Planned stack: Vite + TypeScript (strict) + three.js (WebGL2) + inkjs, plain DOM/CSS UI, Vitest. Node 24 runs the
  TypeScript tools in `tools/` directly (type stripping), so there is no tsx/ts-node.
- At runtime the story is Ink (`story/*.ink`); the TypeScript code knows no specific story. The conventions (variables,
  tags, knot names, `mo_<knot>()` availability, `# o:` placement, `chuong_<n>` → `hub` → `chinh_tiep` flow) are in
  `docs/design.md` §7.3.

## Rules
- Static site only: no server calls, no cookies, no analytics, no third-party CDNs at runtime.
- Render player names and story text with `textContent` only, never `innerHTML`.
- Stats `tinh_cam`, `nang_luc`, `gia_dinh`, `ban_be` stay within 0–100; change them only through `doi()` in Ink.
- localStorage keys are `kira-game:save`, `kira-game:checkpoints`, `kira-game:profile`; wrap every access in try/catch.
- Automatic graphics quality only steps down during a session (design §7.5); keep assets within the budgets in §7.6.
- Content rating 13+. Characters in chapters 1–2 are minors: nothing sexual or suggestive (design §6.6).
- Third-party assets must be CC0, CC-BY or licensed for web games; record each one in `assets/LICENSES.md`.
- `.blend` files and raw source art never go into git.

## Verify
- `cd kira-game && npm test && npm run typecheck` (unit tests and headless story checks).
- World/UI changes also need a look in the browser (`npm run dev`). Ask the owner before starting it unless runtime QA
  is already allowed in the session.
