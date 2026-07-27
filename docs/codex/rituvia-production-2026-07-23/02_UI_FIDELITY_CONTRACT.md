# 02 — UI Fidelity Contract

## 1. Objective

The production UI must look and behave like the golden prototype while using real routes, real server state, accessible semantics and production services. Codex must not redesign, simplify or replace components merely because another library is easier.

## 2. Frozen visual tokens

| Token | Value |
|---|---|
| Background | `#080a10` |
| Deep background | `#04060a` |
| Panel | `#121621` |
| Secondary panel | `#181d2a` |
| Tertiary panel | `#0d111a` |
| Primary text | `#f6f1e7` |
| Muted text | `#a9adba` |
| Secondary muted | `#7d8291` |
| Gold | `#e3c27a` |
| Light gold | `#ffe3a4` |
| Violet | `#9e91e8` |
| Teal | `#79c8c2` |
| Success | `#86c69d` |
| Danger | `#e49a9a` |
| Warning | `#e1bd70` |
| Default radius | `22px` |
| Content max width | `1180px` |
| Desktop header | `72px` |
| Display font | Georgia / Times New Roman / Songti SC / serif |
| Body font | Inter / system sans / PingFang SC / Microsoft YaHei |

Do not substitute bright gradients, glassmorphism, dashboard blue, crypto-wallet visuals or generic AI chat styling.

## 3. Golden screenshots

Baselines live in `evidence/screenshots/`. Required fixed viewport comparisons:

- Desktop: 1440 × 1000.
- Tablet: 1024 × 768.
- Mobile: 390 × 844.
- Narrow mobile: 320 × 700.

Current supplied baselines include home, readings, Daily Tarot, Tarot, Deep Readings, plans, Sanctuary, sign-in, authenticated account, billing/wallets, Stripe checkout, USDC/Base checkout, orders, about and key Chinese mobile pages.

In CI, use the repository's pinned Linux browser and fonts. Set `prefers-reduced-motion: reduce`, freeze time, seed deterministic fixtures and disable third-party animation. Default visual threshold:

```ts
expect(page).toHaveScreenshot(name, {
  animations: 'disabled',
  maxDiffPixelRatio: 0.005,
  threshold: 0.20,
});
```

A changed baseline requires an ADR, before/after screenshots and Owner approval. Do not update snapshots merely to make CI green.

## 4. Content fidelity

- Copy comes from reviewed locale files derived from the prototype.
- No machine translation at runtime.
- No developer or test language in public UI.
- Provider names, prices and Credit costs must come from server catalogue or approved configuration.
- Error states must use the same restrained tone as the prototype.
- No scarcity countdowns, loss framing, fear, streak pressure or aggressive upsells.

## 5. Interaction fidelity

Required behavior:

- Anonymous users can begin Daily Tarot, Tarot, Numerology, Sanctuary and core journaling flows before account creation where product policy permits.
- Sign-in after an interrupted task returns the user to that task and preserves non-sensitive draft state.
- Wallet sign-in, wallet account linking and crypto payment wallet connection are separate flows.
- Stripe and crypto return pages show `pending` until a verified server event confirms payment.
- Deep Reading confirmation always shows exact Credit cost and remaining Credits.
- AI failure releases the reservation and offers retry without double charge.
- Permanent objects remain available; consumable rituals decrement only when a ritual session successfully starts.
- Rituals can pause, resume, complete and exit without trapping the user.

## 6. Responsive rules

- No horizontal overflow at 320px.
- Navigation collapses to a semantic mobile menu.
- Payment and wallet cards stack on small screens.
- Tarot cards remain readable without horizontal scroll.
- Tables must convert to accessible stacked rows or local scrollers only when necessary.
- Native date/time controls must not overflow on iOS.

## 7. Accessibility contract

Target WCAG 2.2 AA:

- Keyboard-complete flows and visible focus.
- Skip link and semantic landmarks.
- Modal focus trap, Escape close and focus return.
- Accessible names for wallet, payment and card controls.
- Text equivalents for astrology charts and decorative ritual visuals.
- `aria-live` for payment, AI generation, ritual and error states.
- Reduced-motion behavior that does not remove information.
- 200% and 400% zoom checks.
- Axe serious/critical violations: zero.
- Manual VoiceOver and NVDA checks before public launch.

## 8. Production differences that are allowed

Only the following differences are permitted without a design ADR:

- Real provider redirects or hosted UI.
- Legally required copy, tax, payment or consent disclosures.
- Loading duration caused by real networks.
- Secure re-authentication or confirmation steps.
- Error and recovery states required by real provider behavior.
- Removal of fake cards, fake wallet addresses, fake transaction hashes and simulation buttons.

These differences must use the same design system and tone.
