---
name: DevVault
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#d0bcff'
  on-tertiary: '#3c0091'
  tertiary-container: '#a078ff'
  on-tertiary-container: '#340080'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-xl-mobile:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.005em
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 13.5px
    fontWeight: '400'
    lineHeight: 22px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
  badge-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system establishes a high-density, hyper-focused technical workspace tailored for software engineers, systems architects, and interview candidates. The design philosophy centers on utility, legibility, and architectural precision—balancing the editorial calm of GitBook and Notion with the polished, structured precision of Stripe Docs.

The emotional baseline is quiet competence: fast scanning, clear information scaffolding, zero decorative clutter, and intentional micro-interactions. Surfaces are utilitarian yet refined, relying on structured borders, strict typographic scale, and crisp accents rather than heavy decorative treatments. Visual weight is reserved for high-signal technical indicators—syntax blocks, difficulty grading, algorithmic trade-offs, and critical system callouts.

## Colors

The palette operates on a disciplined base of dark neutral slates and cool zinc undertones to minimize eye fatigue during extended deep-work sessions. Primary interactions and focal points utilize an energetic electric indigo (`#6366F1`), accented by a technical violet (`#8B5CF6`) for conceptual structures and an emerald green (`#10B981`) for verification states, senior mastery milestones, and code health signals.

### Palette Application
- **Canvas Base & Tonal Surfaces**: Default dark mode runs on `#0B0F19` (Canvas Root), `#111827` (Card Surface & Sidebar), and `#1E293B` (Elevated Popovers, Command Bars, Code Chrome). Light mode counterpart anchors to `#FFFFFF`, `#F8FAFC`, and `#F1F5F9`.
- **Borders & Dividers**: Subtly structured `#1E293B` on `#0B0F19` in dark mode; `#E2E8F0` in light mode. Key structural seams rely on 1px crisp lines rather than blurry drop shadows.
- **Accents & Roles**:
  - `Indigo (#6366F1)`: System focus states, link highlights, active navigation paths, primary CTAs.
  - `Emerald (#10B981)`: Success metrics, verified solutions, "Junior" & "Mid" progress indicators, production readiness tags.
  - `Amber (#F59E0B)`: Warn callouts, "Senior" difficulty tags, runtime warning notes.
  - `Rose / Crimson (#F43F5E)`: Deprecations, architectural anti-patterns, "Staff/Lead" difficulty indicators, critical caveats.

## Typography

The typographic hierarchy uses a triad of technical typefaces: **Geist** for crisp, geometric headers that stay sharp at tight resolutions; **Inter** for readable body copy engineered for documentation scanning; and **JetBrains Mono** for syntax, terminal snippets, schema definitions, and metadata badges.

### Typographic Rules
- Line lengths for documentation body text are capped at `68ch` to preserve vertical reading momentum.
- Code blocks preserve a slightly relaxed `22px` line height to accommodate inline diff indicators, breakpoint icons, and annotations.
- `label-caps` must always be rendered in uppercase with positive letter spacing (`0.06em`) for categorical taxonomy, sidebar group headers, and API method labels (e.g., `POST`, `IDEMPOTENT`, `COMPLEXITY`).

## Layout & Spacing

The architecture implements a 3-column documentation layout with fixed structural sidebars and a fluid core reading pane:

1. **Left Navigation Rail (Global Scope)**: Fixed width of `280px`. Contains deep directory hierarchies, track filters, and topic trees.
2. **Main Technical Canvas (Reading Pane)**: Fluid width, minimum `640px`, maximum `860px` centered within the viewport.
3. **Right Context Rail (On-Page Scope)**: Fixed width of `240px`. Sticky Table of Contents (TOC), difficulty index, reading time, and direct markdown export actions.

### Responsive Reflow
- **Desktop (>= 1280px)**: Complete 3-pane layout visible simultaneously.
- **Tablet (768px - 1279px)**: Right context rail collapses into a compact floating bar or collapsible top sheet; left rail remains accessible via icon-pinned drawer; center pane occupies remaining viewport with `gutter: 1.5rem`.
- **Mobile (< 768px)**: Canvas becomes a single full-width column (`margin: 1rem`). Navigation collapses to an accessible mobile command bar with swipe drawers.

## Elevation & Depth

This design system avoids heavy shadows, simulating physical hierarchy through tonal surface steps and low-contrast perimeter borders.

### Elevation Layers
- **Base Canvas (Level 0)**: `#0B0F19`. Pure background canvas. Zero shadow.
- **Structural Substrates (Level 1)**: `#111827`. Used for sidebars, doc panels, and code container bodies. Outlined with a 1px solid border in `#1E293B`.
- **Floating Interactive Elements (Level 2)**: `#1E293B`. Used for dropdown menus, quick search modals, and hover previews. Elevated with an ambient tint shadow: `0 8px 24px -4px rgba(0, 0, 0, 0.45)`, reinforced by an edge highlight of `1px solid rgba(255, 255, 255, 0.08)`.
- **Topmost Overlays (Level 3)**: `#0F172A`. Command palette (`Cmd+K`) and syntax detail modals. Supported by backdrop blur (`backdrop-filter: blur(12px)`) across an underlying dimming scrim (`rgba(11, 15, 25, 0.8)`).

## Shapes

The design system adopts a refined, subtle curve profile (`roundedness: 1`). Radii stay tight and disciplined to maintain developer-tool utility:

- **Base Radius (`0.25rem` / `4px`)**: Buttons, tags, input fields, inline code pills, and tab triggers.
- **Container Radius (`0.5rem` / `8px`)**: Technical cards, callout boxes, modal panels, and code block containers.
- **Full Pill (`9999px`)**: Reserved exclusively for dynamic status chips, difficulty level badges (e.g., `Senior`, `Staff`), and author metadata capsules.

## Components

### Buttons & Actions
- **Primary**: Solid `#6366F1` background, white label, subtle hover transition to `#4F46E5`. No drop shadow. Height: 36px (desktop), 40px (mobile). Font: `Inter` Medium 13px.
- **Secondary / Ghost**: Transparent fill with `1px solid #334155` border. On hover, background shifts to `#1E293B` and border shifts to `#475569`.
- **Icon Actions (Copy Code, Bookmark)**: 32x32px square hit-target, soft border radius (4px), low-opacity icon tint changing to high-contrast on hover.

### Badges & Taxonomy Pills
- **Difficulty Badges**:
  - `Junior`: Emerald-tinted background (`rgba(16, 185, 129, 0.12)`), text `#34D399`, border `rgba(16, 185, 129, 0.25)`.
  - `Mid`: Cyan-tinted background (`rgba(6, 182, 212, 0.12)`), text `#22D3EE`, border `rgba(6, 182, 212, 0.25)`.
  - `Senior`: Amber-tinted background (`rgba(245, 158, 11, 0.12)`), text `#FBBF24`, border `rgba(245, 158, 11, 0.25)`.
  - `Lead / Staff`: Rose-tinted background (`rgba(244, 63, 94, 0.12)`), text `#FB7185`, border `rgba(244, 63, 94, 0.25)`.
- **Technology Badges**: Monospaced or Inter-medium 12px pill badge with dark neutral background (`#1E293B`), neutral text (`#94A3B8`), and 1px muted perimeter border (`#334155`).

### Code Blocks & Terminal Snippets
- **Container**: Slate surface (`#0D1117` or `#111827`) with a 1px border (`#1E293B`).
- **Header Bar**: 36px height containing the file path / language name (`JetBrains Mono` 11px uppercase), an active language icon, and a single-click "Copy Snippet" button with copied confirmation feedback.
- **Line Numbers**: Right-aligned, non-selectable gutter in `#475569`.

### Technical Callouts & Alert Boxes
- Four semantic variants: `Note` (Indigo), `Tip` (Emerald), `Caution` (Amber), and `Anti-Pattern` (Rose).
- Styled with a 3px solid vertical left accent border, a 6% opacity tinted background fill matching the accent hue, and an integrated icon aligned with the title heading.

### Sticky Table of Contents (TOC)
- Vertical tree running down the right-hand column with a 1px continuous connecting line.
- Unvisited items in `#64748B`; active viewport section highlighted in `#6366F1` with an indigo pip marker on the active indicator line.

### Inputs & Command Palette
- **Inputs**: Flat `#0F172A` background, `1px solid #334155` border, active focus state featuring a high-precision `1px solid #6366F1` border with zero blur ring.
- **Command Palette (`Cmd+K`)**: Centered 600px overlay with instantaneous query filtering, group dividers for topics, algorithms, and system designs, with keyboard shortcut hints (`Enter`, `Esc`, `Arrow keys`) pinned to the footer.