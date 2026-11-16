---
name: KnowStack Study Workspace
colors:
  canvas: '#0B1326'
  panel: '#131B2E'
  elevated: '#222A3D'
  text: '#DAE2FD'
  muted: '#C7C4D7'
  primary: '#C0C1FF'
  positive: '#4EDEA3'
typography:
  heading: { fontFamily: Geist }
  body: { fontFamily: Inter }
  utility: { fontFamily: JetBrains Mono }
rounded:
  control: 6px
  panel: 8px
  status: 9999px
spacing:
  desktop-gutter: 36px
  mobile-gutter: 20px
---

# Study desk direction
English product for developers studying technical concepts and preparing for interviews. Current product evidence does not establish a Japan-specific market. Preserve technical accuracy and quiet reading; avoid invented progress, completion, editorial review or response-time promises.

The signature is recommended reading beside a small study desk, followed by a track directory using actual published counts. Home, tracks, saved guides and questions have distinct destinations. Technical symbols communicate the category, never a fictional study sequence.

## Runtime ownership and drift
`src/index.css` is canonical for all theme values; this file documents approved intent, not generated CSS. Tailwind @theme variables feed existing utilities and `.ks-*` shared rules. Panels map to surface-container-low, emphasis to primary, body to on-surface and muted copy to on-surface-variant. Remaining inherited semantic tokens live in that same @theme block. Badge difficulty colors remain owned by Badge.tsx.

This root document supersedes the conflicting prose in `mockup/devvault/DESIGN.md` for implemented screens. Retain existing navy and lavender runtime colors rather than the alternative indigo palette in the old prose. Resolve runtime radius drift: rounded-lg 6px, rounded-xl 8px, rounded-full 9999px. Status uses full pills; ordinary controls use 6px. Existing administrative utility classes inherit these corrections.

## Layout and type
Fixed 248px desktop rail and 72px header. Main starts at 108px with 36px gutters, maximum 1240px study width. At 900px the rail becomes a native modal drawer. At 767px use 20px gutters, 64px header, one content column and 44px icon hit areas. No nested metric panels. Track shortcuts wrap into a single column on smaller laptops.

Geist headings 32px desktop/28px mobile; guide headings 20px, recommendation 24px. Inter body 13–15px and article body 17px/28px at 68ch. JetBrains Mono is reserved for metadata and code. All have system fallbacks. Thin borders and tonal surfaces define depth; only account popover has a shadow. Recommendation permits one restrained indigo tint.

## Shared components and states
Icon.tsx owns local decorative SVG icons on touched reader/navigation surfaces; controls retain text or accessible names. Badge.tsx owns status labels, loading and errors. Native selects own filtering. AuthModal owns authentication. Markdown owns sanitized rendered content.

Primary buttons are lavender with dark text, 40px minimum height; secondary links use lavender text. Busy saving disables save buttons; failures leave the saved state unchanged and announce inline. Focus uses a 2px primary outline. Scrollbar geometry is global, thin with a stable gutter. Hover transitions last 150ms; reduced-motion disables incidental transitions and spinner animation. No ambient animation.

Article text is capped at 68ch. Code and tables may scroll inside their containers. Shared reading actions, Ask local drafts and admin operations retain their existing contracts. See UX-CONTRACT.md for behavior.
