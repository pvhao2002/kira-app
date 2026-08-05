<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kira Portfolio 3D

## Project Direction

This is a Next.js portfolio experience built with **Three.js**. The 3D scene
and its motion are part of the product, not decorative afterthoughts: future
requests will add animations that introduce individual portfolio details.

## Required Skills and Workflow

- For a new visual surface, a redesign, or a substantial 3D presentation,
  use the `build-web-apps:frontend-app-builder` skill. Start with a complete
  visual concept and any necessary image assets before implementation, unless
  the user explicitly opts out or requests a small change in an established
  design system.
- Treat an approved concept as the visual specification. Do not add unrequested
  copy, sections, UI controls, or decorative effects while implementing it.
- For a rendered UI change, regression, or interaction bug, use
  `build-web-apps:frontend-testing-debugging`. Verify the requested user flow
  in the in-app Browser first, including console health, a visible screenshot,
  and at least one interaction. Check desktop and a mobile viewport when
  practical; a successful build alone is not visual QA.
- When a visual concept exists, compare the rendered result against it before
  handoff. Keep temporary screenshots, traces, and QA files outside the
  repository unless the user asks to retain them.

## 3D and Animation Guidelines

- Keep the scene structure modular so a detail can own its geometry, material,
  interaction, and introduction animation.
- Make animations intentional and easy to tune. Centralize durations, easing,
  delays, and reduced-motion behavior instead of scattering magic values across
  components.
- Do not start render loops, event listeners, loaders, or animation timelines
  without cleaning them up when the React component unmounts.
- Respect `prefers-reduced-motion`; retain a clear static or low-motion way to
  explore the portfolio.
- Prefer lightweight assets and lazy-load heavy 3D content. Avoid unnecessary
  per-frame React state updates.
- Preserve usable keyboard navigation, readable text alternatives, and an
  accessible non-3D path for essential content.
- Keep camera movement, scroll-linked behavior, pointer input, and focus
  behavior predictable. An animation must not trap scrolling, block navigation,
  or make the essential portfolio content unreachable.

## Change Scope

When adding a requested detail animation, keep the change focused on that
detail and its supporting scene utilities. Do not invent portfolio content,
visual direction, or interactions beyond the requested behavior.
