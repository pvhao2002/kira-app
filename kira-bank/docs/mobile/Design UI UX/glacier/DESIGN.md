# Glacier — Glassmorphism

## North Star: "Frozen Light"
Ethereal depth through layered translucent surfaces. Dark, atmospheric, and premium.

## Colors
- **Primary (`#7dd3fc`):** Ice-blue for interactive elements and accents.
- **Background (`#0a0e1a`):** Deep navy-black base.
- **Tertiary (`#c8a0f0`):** Soft lavender for secondary accents.
- All surface containers should feel like tinted glass layers.

## Glass Effect (Core Pattern)
- **Cards/Panels:** `background: rgba(15, 21, 36, 0.6)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(125, 211, 252, 0.1)`.
- **Elevated glass:** Increase opacity to 0.75 and blur to 24px.
- **Borders:** Always use semi-transparent primary or white at 8-15% opacity.

## Typography
- **All fonts:** Inter for clean, modern readability.
- Headlines: semibold, slightly tracked. Body: regular weight.
- Text colors: `on_surface` for primary, `on_surface_variant` for secondary.

## Elevation
- Depth through blur intensity and opacity, not shadows.
- Layer 0: solid background. Layer 1: 60% opacity + 16px blur. Layer 2: 75% + 24px blur.
- Subtle glow effects: `box-shadow: 0 0 30px rgba(125, 211, 252, 0.05)`.

## Components
- **Buttons:** Primary = semi-transparent primary fill with border. Hover = increase opacity.
- **Cards:** Frosted glass with thin luminous border.
- **Inputs:** Glass background, thin border, glow on focus.

## Rules
- Never use opaque solid backgrounds on floating elements.
- Keep borders subtle — luminous, not structural.
- Limit glow effects to interactive states.