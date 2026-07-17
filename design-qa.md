# RIT-035 Design QA

## Grounding

- Source: `output/playwright/rit035/lumora-reference-result-1440x1000.png`
- Implementation: `output/playwright/rit035/rituvia-one-card-verified-1440x1000.png`
- Combined comparison: `output/playwright/rit035/design-comparison-2880x1000.png`
- Additional states: `rituvia-one-card-processing-1440x1000.png` and
  `rituvia-three-card-fallback-390x844.png`
- Desktop viewport: 1440 × 1000 for both source and implementation.
- Mobile viewport: 390 × 844.

Screenshots remain local and Git-ignored under the repository screenshot policy. The comparison was
opened and reviewed as one side-by-side image, with Lumora on the left and RITUVIA on the right.

## Interaction acceptance

- One-card: choose a theme, create the anonymous draw, reveal the fixed card, explicitly request an
  interpretation, receive a private 503, manually retry with the same UUID V4 operation, observe a
  non-displayable processing state, then receive a durable verified result.
- Three-card: choose a theme, create and reveal exactly three ordered cards, attempt interpretation
  while offline with zero API start, reconnect, manually retry, observe processing, then receive a
  reviewed non-AI fallback without a verified-AI claim.
- The browser ledger confirmed one session and one reading request per flow, bodyless GET polling,
  no unexpected API path, and no interpretation request before explicit consent.
- Both terminal states receive focus, retain the fixed reading, and show the professional-advice
  boundary. Processing exposes no final prose and the private Problem Details canary never renders.

## Visual review and fixes

- Preserved the reference's calm, bounded progression from selection to draw to structured result,
  while using RITUVIA's existing cream, aubergine, type, spacing, radius, and control system rather
  than copying Lumora's provisional brand.
- Kept the optional interpretation visibly separate from deterministic card facts. The processing,
  verified-AI, and reviewed-fallback states have distinct labels without fear, scarcity, or efficacy
  language.
- Corrected screenshot scroll alignment so the entire interpretation container and its boundary are
  visible at the same desktop viewport as the reference.
- Real-flow Axe testing exposed repeated named region landmarks in nested result content. The nested
  groups now rely on their heading hierarchy instead, removing the duplicate-landmark failure while
  retaining readable structure.
- Desktop and mobile screenshots show no horizontal overflow, clipping, cropped controls, or broken
  radii. Mobile copy reflows inside the panel and keeps 44 px targets.

## Final result

**Passed.** The RIT-035 interaction and visual slice is coherent with the Lumora flow reference,
faithful to the established RITUVIA design system, and verified in processing, verified, fallback,
offline, desktop, and mobile states. No unresolved visual or interaction blocker remains for this
safe-off local slice.
