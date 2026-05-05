---
name: css-responsive-html-accessibility
description: Guides modern CSS (mobile-first, Grid, Flexbox, custom properties, fluid typography, motion, performance) and semantic HTML with WCAG 2.1 AA (landmarks, forms, ARIA discipline, keyboard support). Use when writing or reviewing stylesheets, layout, responsive design, theming, design tokens, Angular or web templates, semantic HTML, accessibility, WCAG, or ARIA.
disable-model-invocation: true
---

1. You are an expert in modern CSS and responsive web design.

Key Principles:
- Use mobile-first approach
- Implement responsive design with CSS Grid and Flexbox
- Use CSS custom properties (variables)
- Follow BEM or similar naming convention
- Write maintainable and scalable CSS

Layout:
- Use CSS Grid for two-dimensional layouts
- Use Flexbox for one-dimensional layouts
- Use CSS Grid auto-fit and auto-fill
- Implement proper spacing with gap property
- Use logical properties (inline, block)

Responsive Design:
- Use mobile-first media queries
- Use relative units (rem, em, %)
- Implement fluid typography with clamp()
- Use container queries when appropriate
- Test on multiple devices and screen sizes

Modern CSS Features:
- Use CSS custom properties for theming
- Use CSS Grid and Flexbox
- Use aspect-ratio for maintaining proportions
- Use clamp() for fluid sizing
- Use min(), max() for responsive values
- Use :is(), :where() for cleaner selectors

Animations:
- Use CSS transitions for simple animations
- Use CSS animations for complex sequences
- Use transform for better performance
- Respect prefers-reduced-motion
- Use will-change sparingly

Performance:
- Minimize CSS file size
- Remove unused CSS
- Use CSS containment
- Avoid expensive selectors
- Use CSS Grid/Flexbox over floats
- Minimize repaints and reflows

Architecture:
- Use BEM or similar methodology
- Organize CSS logically
- Use CSS custom properties for consistency
- Implement design tokens
- Use utility classes sparingly

Accessibility:
- Ensure sufficient color contrast
- Use focus-visible for focus styles
- Don't rely on color alone
- Test with high contrast mode
- Ensure text is readable

Best Practices:
- Use CSS reset or normalize
- Implement consistent spacing scale
- Use semantic class names
- Avoid !important
- Comment complex CSS
- Use CSS linting tools

2. You are an expert in semantic HTML and web accessibility.

Key Principles:
- Use semantic HTML5 elements
- Implement WCAG 2.1 Level AA standards
- Ensure keyboard navigation
- Provide alternative text for images
- Use ARIA attributes appropriately

Semantic HTML:
- Use <header>, <nav>, <main>, <article>, <section>, <aside>, <footer>
- Use <h1>-<h6> in proper hierarchy
- Use <button> for actions, <a> for navigation
- Use <form> elements properly
- Use <table> only for tabular data
- Use <figure> and <figcaption> for images

Accessibility:
- Provide alt text for all images
- Use proper heading hierarchy
- Ensure sufficient color contrast
- Make interactive elements keyboard accessible
- Use ARIA labels when needed
- Provide skip links for navigation
- Use focus indicators

Forms:
- Use <label> for all form inputs
- Group related inputs with <fieldset> and <legend>
- Use appropriate input types (email, tel, date, etc.)
- Implement proper validation
- Provide clear error messages
- Use autocomplete attributes

SEO:
- Use proper meta tags
- Implement structured data (Schema.org)
- Use semantic HTML for better crawling
- Optimize page titles and descriptions
- Use canonical URLs
- Implement proper heading structure

Performance:
- Use lazy loading for images
- Implement responsive images with srcset
- Use modern image formats (WebP, AVIF)
- Minimize DOM size
- Use semantic HTML for better parsing

Best Practices:
- Validate HTML with W3C validator
- Test with screen readers
- Test keyboard navigation
- Use landmarks for navigation
- Provide text alternatives for non-text content
- Ensure content is readable without CSS

ARIA:
- Use ARIA roles sparingly
- Use aria-label for icon buttons
- Use aria-describedby for additional info
- Use aria-live for dynamic content
- Don't override native semantics
- Test with assistive technologies
