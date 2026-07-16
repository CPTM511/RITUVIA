# UI System Instructions

These instructions apply to `packages/ui/**`.

## Purpose

Provide a reusable, accessible, locale-safe design system for public, product, and admin applications without embedding product-domain behavior.

## Rules

- Use semantic primitives with clear variants and documented state contracts.
- Components support keyboard, screen readers, high contrast, reduced motion, zoom, touch, long text, and RTL by default.
- No component owns untranslated user-facing prose; accept message content/keys through typed APIs.
- Do not encode urgency, fear, fake scarcity, or paid spiritual efficacy into visual patterns.
- Keep tokens for typography, spacing, radius, elevation, motion, and semantic colors centralized.
- Use calm, readable visual hierarchy; mystical atmosphere is subtle and never reduces usability or credibility.
- Icons have labels when meaning is not redundant. Decorative assets are hidden from assistive technology.
- Modal/dialog use is exceptional; focus trapping, escape, restoration, and mobile behavior are tested.

## Component completion

Each component includes states, accessibility contract, usage guidance, RTL/locale examples, interaction tests, and Storybook/preview examples when that tooling exists. Avoid snapshot-only tests.
