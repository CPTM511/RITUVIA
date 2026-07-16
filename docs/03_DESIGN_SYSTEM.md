# Design System and Brand Experience

## 1. Direction

RITUVIA is a contemporary digital sanctuary: quiet, luminous, grounded, premium, and culturally respectful. It must avoid gothic-horror clichés, gambling visual language, cheap “psychic hotline” aesthetics, excessive stars/gradients, and religious claims it cannot substantiate.

## 2. Working identity

- Name: `RITUVIA` (configuration-driven working brand).
- Pronunciation guide: `rih-TOO-vee-uh`.
- Primary tagline: `Insight. Intention. Ritual. Return.`
- Supporting line: `A sanctuary for insight and ritual.`
- Brand idea: a path (`via`) through reflection and ritual.

## 3. Visual principles

1. **Stillness:** generous whitespace and deliberate pacing.
2. **Warm depth:** dark environments may feel intimate, not threatening.
3. **Tactile symbolism:** paper, stone, smoke, flame, water, metal, and botanical references used with restraint.
4. **Modern clarity:** readable type, clear controls, visible prices, and honest system states.
5. **Inclusive spirituality:** no single religion presented as the platform's authority.
6. **Completion:** every immersive screen has a visible exit and final state.

## 4. Token proposal

Tokens are semantic and must support light/dark/system modes. Exact colors must be contrast-tested before acceptance.

```css
:root {
  --surface-canvas: #F6F1E8;
  --surface-panel: #FFFDF8;
  --surface-elevated: #FFFFFF;
  --ink-primary: #201C27;
  --ink-secondary: #625B6B;
  --line-subtle: #DDD4C7;
  --brand-deep: #352A4A;
  --brand-main: #66507F;
  --brand-soft: #E9DFF0;
  --accent-gold: #A97732;
  --accent-sage: #66745F;
  --state-info: #315D79;
  --state-warning: #8A5C22;
  --state-danger: #8B3F47;
  --focus-ring: #275E9E;
}
```

Do not treat these values as immutable. Preserve semantic token names and validate contrast in all contexts. Do not use green/red alone for success/failure.

## 5. Typography

- Use one highly legible variable sans family for UI and long text.
- A restrained serif display face MAY be used for large editorial headings and card titles, but never for controls or dense copy.
- Avoid font dependencies that break CJK, Arabic, or Devanagari; define locale-aware fallback stacks.
- Use fluid type scales with minimum 16px body text.
- Numerals in prices, charts, dates, and calculations must align and remain unambiguous.

## 6. Spacing, shape, and motion

- 4px base spacing grid; favor 8/12/16/24/32/48/64.
- Moderate corner radius, consistent by component level; avoid decorative inconsistency.
- Shadows are quiet and used only for hierarchy.
- Motion communicates state/reveal, normally 120–350ms.
- Ritual ambient motion may be longer but subtle, pausable, and disabled by reduced-motion preferences.
- No motion is required to understand or complete a task.

## 7. Component system

Create accessible, tested primitives before feature pages:

- Button, link, icon button, split button.
- Input, textarea, select, combobox, date/time, location search.
- Checkbox, radio, switch, segmented control, chips.
- Dialog, drawer, popover, tooltip, toast, inline alert.
- Navigation, tabs, breadcrumb, pagination.
- Card, disclosure, stepper, timeline.
- Price/product card, entitlement badge, checkout status.
- Reading card, tarot card, chart placement, numerology result.
- Intention card, ritual object, sanctuary stage, journal editor.
- Skeleton, empty state, error state, offline state.
- Locale switcher and RTL-safe directional icon wrapper.
- Data table and admin forms.

Every component needs stories/examples for default, hover, focus, disabled, loading, error, long text, mobile, dark mode, and RTL where relevant.

## 8. Tarot artwork

- Begin with a legally owned or commissioned unified deck, not scraped art.
- Art must have asset provenance, license, creator credit, version, alt text, and localization notes.
- Avoid stereotypical representation and cultural appropriation.
- The result remains useful when images fail.
- Card back must not imply randomized client selection before the server draw is fixed.

## 9. Astrology visualization

- Use SVG/canvas only with a complete textual equivalent.
- Make signs, houses, planets, degrees, and aspects distinguishable without color alone.
- Provide zoom/pan only when it improves access; a table view is mandatory.
- Uncertain birth time must visibly affect chart confidence.

## 10. Sanctuary rendering tiers

1. **Accessible linear mode:** text, buttons, image/alt text, no animation required.
2. **Standard 2D mode:** CSS/SVG/canvas animation and ambient audio.
3. **Enhanced mode:** optional richer rendering after performance proof.

Do not make WebGL or high-end graphics a launch dependency. Never block completion because a device cannot render an effect.

## 11. Illustration and imagery

- Prefer original abstract/natural imagery: light, horizon, paper, botanicals, stone, water, smoke, constellations as subtle structure.
- Avoid crystal-ball clichés, disembodied hands, exoticized religious figures, or fear imagery.
- Every marketing image needs mobile crops, alt text, rights metadata, and performance variants.

## 12. Conversion design

- One dominant CTA per view.
- Show value before account/payment gates.
- Paid enhancements use honest visual comparison and exact contents.
- Never blur or lock a frightening result behind payment.
- Never hide cancellation/refund terms.
- Do not use false scarcity, countdowns, default preselection, confirmshaming, or hard-to-close modals.

## 13. Design QA checklist

- Mobile 320/360/390/430 widths and desktop.
- 200% and 400% zoom/reflow.
- Keyboard and screen reader.
- Reduced motion and muted audio.
- Light/dark/system mode.
- English long strings, German expansion, Arabic RTL, CJK line breaking, Devanagari shaping.
- Slow network, missing images, AI delay, payment delay, offline.
- Price, legal, safety, and AI labels in the relevant context.
- No horizontal overflow or clipped focus.
