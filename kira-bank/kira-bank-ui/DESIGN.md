---
version: alpha
name: "Kira Bank UI"
description: "A calm, information-dense personal finance workspace with clear blue interaction cues."
colors:
  primary: "#1e5fbf"
  accent: "#008f78"
  canvas: "#f3f7fb"
  surface: "#ffffff"
  surface-dark: "#10263e"
  border: "#d8e3ee"
  focus: "#1d4ed8"
typography:
  sans:
    fontFamily: "Plus Jakarta Sans, Be Vietnam Pro, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
spacing:
  control-height: "44px"
  mobile-search-height: "48px"
  page-max: "1440px"
components:
  search:
    height: "44px"
    radius: "10px"
    border: "1px solid var(--search-border)"
    focus: "3px var(--search-focus-ring)"
  card:
    radius: "14px"
  button:
    radius: "9px"
---

# Kira Bank UI Design System

## Overview

### Creative North Star

Kira Bank is a quiet financial workbench: cool paper-like surfaces, navy structure, and blue focus cues make dense account work easy to scan.

### Product context and register

- **Audience and primary job:** People managing personal finance records and reconciliations across desktop and mobile screens.
- **Target market(s) and evidence:** The existing Kira Bank application and its bilingual English/Vietnamese UI.
- **Locale(s) and language policy:** English and Vietnamese strings come from the application translation service.
- **Usage scene:** Repeated, practical data entry and review on responsive screens.
- **Register:** Product UI with restrained financial utility.
- **Memorable signature:** Blue interaction cues against layered navy surfaces.
- **Restraint:** Forms and search controls stay quiet so financial values and actions carry the hierarchy.
- **Anti-references:** Avoid stacked gradients, heavy shadows, and decorative pill controls that make data tools feel like marketing pages.
- **Token ownership/runtime mapping:** Runtime CSS variables in `src/styles.css` are canonical. This document mirrors the values and maps search tokens (`components.search`) to `.global-search`, `.search-box`, `.search-input-wrapper`, and `.search-field`.

## Colors

Light mode uses `canvas` and `surface` for page and panel separation, `border` for structure, `primary` for navigation and actions, and `focus` for keyboard focus. Dark mode remaps the surface, border, and search variables in `[data-theme=dark]` while retaining the same semantic hierarchy.

## Typography

The application uses Plus Jakarta Sans with Be Vietnam Pro and system fallbacks. Headings use stronger scale and weight; dense financial values remain readable at the body size. Vietnamese text uses the same fallback chain without forced casing.

## Layout

The shared shell uses a fixed navigation rail on wide screens and a collapsible rail on smaller screens. Controls use a 44px baseline; the mobile global search keeps a 48px touch-friendly height. Search fields shrink to the available width and preserve placeholder text without moving adjacent controls.

## Elevation & Depth

Hierarchy comes from tonal surface changes and thin borders. Shadows are reserved for dialogs, menus, and raised panels. Search fields use no inner shadow; focus is a single blue ring around the owning wrapper or standalone field.

## Shapes

Controls use a restrained 10px radius, panels use 14px, and larger containers use 18px. Search wrappers own their surface, border, and focus state; their inner inputs are transparent and do not add a second border or background.

## Components

### Foundational visual states

Search controls have a flat default surface, blue border on hover, and a 3px blue focus ring. Placeholder text uses the muted token. Dark mode keeps the same states with dark surfaces and cyan-blue focus. Disabled behavior remains owned by the existing form controls.

### Forms and overlays

Wrapped searches use `.global-search`, `.search-box`, or `.search-input-wrapper`. Standalone search inputs use `.search-field` or native `type="search"`. The shared stylesheet owns the visual contract; component styles may change width and layout only.

### Motion

Search transitions are short and limited to border, surface, and focus changes. Reduced-motion preferences continue to disable nonessential transitions through the global motion rules.

## Do's and Don'ts

- **Do:** Keep search surfaces flat and let one wrapper own the focus treatment.
- **Do:** Use the shared 44px search contract across feature pages and dropdowns.
- **Don't:** Add a second background, border, or focus ring to the inner input.
- **Don't:** Change search behavior or query timing as part of visual styling work.
