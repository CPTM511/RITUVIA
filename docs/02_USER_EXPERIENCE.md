# User Experience Specification

## 1. Experience thesis

RITUVIA should feel like entering a calm, private room—not opening a casino, social feed, horror game, or high-pressure psychic hotline. The user should leave with greater agency and a complete moment, not a compulsion to keep buying or drawing.

## 2. Information architecture

### Public

- Home
- Explore
  - Tarot
  - Astrology
  - Numerology
  - Rituals and sanctuary
- Learn
  - Card library
  - Zodiac/planet/house/aspect library
  - Numerology guides/calculators
  - Reflection and ritual guides
- Pricing / digital objects
- Methodology and sources
- Safety and boundaries
- About
- Help / refunds / contact
- Legal / privacy / accessibility

### Authenticated

- Today
- Readings
- Sanctuary
- Intentions
- Journal
- Revisit
- Collection
- Account / privacy / orders

### Admin

- Overview
- Content
- Localization
- Prompts/evals
- Country policy
- Catalog/pricing
- Orders/subscriptions/refunds/disputes
- Safety/reports
- Experiments/analytics
- Audit/operations

## 3. First-session journey

1. Search/social/direct visitor lands on a relevant page.
2. The page answers the immediate question and explains the method/boundary.
3. One clear CTA starts an anonymous experience.
4. User chooses a theme or writes a safe question.
5. User completes the deterministic interaction.
6. Result shows an immediate concise insight before asking for an account or payment.
7. User can expand the explanation, set an intention, perform a free ritual, and write a reflection.
8. Account creation is offered to save, sync, revisit, or buy—not as a gate before value.
9. User selects an optional revisit.
10. The final state feels complete and shows one next step, not an infinite feed.

Target: a motivated user can reach the first useful result within three minutes on mobile.

## 4. Tarot interaction

### Question screen

- Lead with theme chips and constructive examples.
- Explain privacy and boundaries in one short line.
- Show a gentle safe-reframing response when needed.
- Allow “continue without writing a question.”
- An allowed result offers an explicit same-tab action into the one-card flow without copying the
  private question into the reading request, URL, metadata, storage, or analytics.

### Draw screen

- Use a deliberate but short interaction: shuffle animation, tap/keyboard select, reveal.
- Never imply physics, sensors, or AI can detect an aura/energy.
- Respect reduced motion and provide an instant reveal alternative.
- Lock the server-authoritative draw once created.

### Result screen hierarchy

1. Card(s) and position(s).
2. One-paragraph “what this may invite you to notice.”
3. Symbol details and alternative readings.
4. What this cannot determine.
5. Reflection question.
6. One small action.
7. Continue to intention/ritual.
8. Save/share/report controls.

Do not hide the core result behind payment after the draw. Paid depth must be described before purchase and preserve a useful free result.
The intention action stores only the exact displayed reading UUID in tab-scoped storage. Sanctuary
resolves that owner-scoped reading before creating an intention and clears the handoff after
success, rather than guessing from the newest unrelated reading.

## 5. Numerology interaction

- Input fields clearly identify required values and why they are needed.
- Show calculation steps in an expandable, accessible panel.
- Use result cards for numbers, not mystical certainty.
- Explain language/alphabet limitations before collecting a name.
- Provide “calculate another” without implying the previous result was wrong.

## 6. Astrology interaction

- Use progressive birth-data entry.
- Explain why exact time matters and provide “unknown” / “approximate” paths.
- Search locations with disambiguation and accessible keyboard behavior.
- Confirm local date/time/place before calculation.
- Visual chart must have a textual table/summary equivalent.
- Clearly separate astronomical placements from interpretive prose.
- Make uncertainty visible near affected claims, not buried in a footer.

## 7. Intention composer

- Provide concise templates: “I intend to…”, “I will practice…”, “I am willing to…”
- Detect attempts to control another person's feelings/actions and suggest a self-owned rewrite.
- Let the user choose one small action and revisit date.
- Keep the primary action “Save intention”; paid ritual objects are secondary.

## 8. Sanctuary

### Visual layout

- Centered ritual stage with clear object slots.
- Drawer or tray for owned/free objects.
- Intention card that can be hidden during a screen share.
- Timer/breathing controls and audio controls.
- Always-visible exit and completion controls.

### Interaction principles

- No accidental purchase from the ritual stage.
- Preview paid objects before checkout.
- Confirm purchase details outside the immersive flow.
- Free object remains equally prominent and dignified.
- Ritual completion uses calm affirmation, not claims that a wish was sent/granted.
- Permit accessibility mode with a linear text/button experience.
- The free candle and incense use one ordered interaction model in standard 2D and accessible
  linear modes. Both modes expose the same pause/resume, exit, step, and completion actions without
  requiring animation, audio, dragging, precision, or timing.
- Audio is off and absent from the initial free experience. Reduced-motion preference defaults to
  the linear path, while CSS image or animation failure leaves the complete text-and-button path
  available.
- Entering the focused inline stage moves focus to its title; Escape or the visible exit returns
  focus to the selected object. Exiting, going offline, or encountering a completion error keeps
  the private intention in memory.
- RIT-042 sends no ritual request before explicit completion. Its final action temporarily uses the
  historical `reflection-ritual.v1` boundary; RIT-043 owns durable start/pause/resume provenance,
  exact catalog/access snapshots, transactional pass handling, and the final lifecycle contract.

## 9. Journal and revisit

- Journal editor starts with optional prompts, never a mandatory mood score.
- Autosave locally/server-side with clear state.
- Provide privacy reminder and lock-screen-safe notification defaults.
- Sanctuary can hand an intention to `/en/revisit` through one opaque UUID held only in tab-scoped
  storage. The Revisit page reloads all private prose from the owner-scoped server boundary and
  removes that UUID after scheduling.
- Scheduling offers tomorrow, seven days, or a custom future local calendar date plus an editable
  IANA time zone. The local date remains stable across daylight-saving changes.
- Optional quiet hours are stored only as an inert future preference. Reminder preference is fixed
  to `none`, the channel is null, and this flow sends no email, push, SMS, webhook, or in-app
  notification.
- A signed-in user may separately opt into the RIT-045 once-only English reminder. Its preference
  link is a GET-safe fragment deep link to `/en/revisit#reminder-preferences`; loading or
  reloading the link changes no preference and focuses the reminder control or section for
  keyboard and assistive-technology users.
- RIT-104 renders the reminder as semantic HTML plus equivalent plain text with a lock-screen-safe
  subject, locale/time-zone date, quiet-hours context, private Revisit action, and preference link.
  Unsupported delivery locales are suppressed; English fallback is available only in explicit
  local preview and never activates sending.
- The selected date is an invitation, not an unlock. A user may complete before, on, or after it,
  comparing the encrypted original intention/action snapshot with what actually happened without
  treating the result as proof of prophecy.
- Completion accepts a private factual reflection plus up to three bounded user-owned outcome tags.
  Provide explicit reschedule, archive, soft-delete, retry, offline, empty, and conflict behavior;
  archive is terminal except for deletion and no streak continuation is required.
- Deleting a journal entry restores focus to the journal editor. Opening Revisit completion moves
  focus to the reflection field, and successful schedule, completion, or deletion moves focus to
  the announced status.

## 10. Commerce UX

- Show a product detail page or modal with exact contents, compatible experiences, permanence/expiration, price, tax, renewal, cancellation, refund terms, and country limitations.
- Use a neutral CTA such as “Continue to secure checkout.”
- Do not use countdowns, fake inventory, “your energy will fade,” or escalating recommendations after a vulnerable question.
- Return from checkout to a resilient confirmation state that can recover from delayed webhooks.
- Show “Payment received—access is being confirmed” rather than granting from URL query parameters.
- Make cancel/refund/support paths easy to find.

## 10A. Private account control

- The account page keeps profile preferences, minimal linked history, and active-session controls
  in one responsive private surface.
- History is a bounded chronological summary across every anonymous subject already linked to the
  account. It labels resource type, coarse lifecycle state, approved reading theme, and time only;
  it never lists questions, intention text, journal prose, Revisit reflection, email, or identity
  data.
- A reading summary can restore that exact owner-authorized reading by placing only its UUID in
  tab-scoped storage. Other resource summaries are informational until their dedicated account
  restoration flow is implemented.
- Profile changes use optimistic revision protection. A change made in another session produces a
  visible conflict and requires reloading rather than silently overwriting it.
- Session cards distinguish this session from other active sessions using sign-in, last-active,
  and expiry times only. Do not display or collect device names, locations, IP addresses, user
  agents, fingerprints, or inferred trust.
- Targeted sign-out is available only for another session. Current-session sign-out and all-session
  sign-out remain explicit, confirmable actions and never claim success if durable revocation
  fails.

## 11. Global and locale UX

- Locale switcher shows language names in their own language.
- Preserve current route where equivalent content exists.
- Do not auto-switch an authenticated user's language without confirmation.
- Use local date, time, number, currency, name, and address conventions.
- Support RTL mirroring without mirroring charts/symbols that should retain semantic orientation.
- Test text expansion of at least 40%.
- Avoid idioms and puns in core actions.
- Regional spiritual content must identify its tradition; never present it as universally interchangeable.

## 12. Accessibility requirements

Target WCAG 2.2 AA.

- Full keyboard operation with visible focus and logical order.
- Semantic headings, landmarks, labels, status messages, and error associations.
- 44×44 CSS pixel minimum touch targets where practical.
- Contrast-compliant text and controls; never encode meaning by color alone.
- Reduced-motion path and no flashing.
- Captions/transcripts or non-audio equivalent for ambient/guided sound.
- Text alternative for card art, chart placements, ritual objects, and share images.
- Accessible modal/dialog focus trapping and restoration.
- Screen-reader announcements for draw/reveal, save, payment state, and background completion.
- Zoom/reflow to 400% without loss of function.

## 13. Required states

Every networked feature must define:

- Initial.
- Loading/skeleton.
- Partial/streaming.
- Success.
- Empty.
- Validation error.
- Permission/eligibility blocked.
- Rate/usage limit.
- Provider unavailable.
- Offline/degraded.
- Retry.
- Duplicate/idempotent completion.
- Deleted/expired.

## 14. Trust cues

Place trust where the decision occurs:

- “AI-generated interpretation” beside AI content.
- “Symbolic reflection, not professional advice” near question/result.
- Formula/engine version in expandable methodology.
- Private-by-default label beside journal/prayer fields.
- Exact digital product description before checkout.
- Country/payment limitations before collecting unnecessary information.

## 15. Content tone

- Calm, warm, precise, non-authoritarian.
- Use “may,” “could,” “invites,” “one possibility,” and “consider.”
- Avoid “destined,” “definitely,” “the universe says,” “you must,” “only this can,” and “act now.”
- Do not patronize skeptics or claim belief is required.
- Do not imply disagreement means the user is spiritually blocked.

## 16. Mobile and PWA

- Mobile is the primary design constraint.
- Core flow must work on small screens, slow networks, and without install.
- PWA install prompt is user-initiated and shown only after demonstrated value.
- Cache only safe public assets and explicitly selected private offline data.
- Never cache payment pages or sensitive responses in shared caches.
- App icons, splash, theme color, offline shell, and update behavior require explicit QA.

## 17. Privacy-safe one-card sharing

RIT-115 adds an opt-in share section only after a one-card result is revealed. No preview exists
until requested. The preview is the exact locally generated SVG that will be downloaded or sent
to a supported device share sheet, not a separate visual approximation.

The card contains only brand, reviewed card title, orientation, optional bounded theme, a generic
reflection line, the public locale Tarot URL, and the symbolic-not-predictive boundary. The theme
is included by default per the product requirement and can be removed before any artifact action.
Private question, reading ID, interpretation, birth data, intention, journal text, and account
details are never share-component inputs. Browsers without SVG file-share support retain local
download and do not show a misleading link-only card action.
