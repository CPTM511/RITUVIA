# `@rituvia/ui`

Private, native-first UI foundations for RITUVIA applications. Import components from
`@rituvia/ui` and import `@rituvia/ui/styles` once at the application root before app-specific CSS.

## Contracts

- All visible labels, descriptions, errors, loading text, and option text come from the consuming
  application's typed messages. Components own no production prose.
- `ActionLink` accepts only values created by `createLocalActionHref`; it has no disabled or loading
  fiction. External URLs require a later, separately reviewed component and host policy.
- Control IDs, names, and option values use bounded public identifiers created by their matching
  constructors. Never derive them from a question, journal, prayer, birth value, error, URL, or
  other private/free text.
- `Button` defaults to `type="button"`. Loading and disabled states set native `disabled`; server
  mutations still require authorization and idempotency because UI state is not a security boundary.
- Components omit event handlers when no callback is supplied, so static and native-form use remains
  Server Component safe. A consumer that supplies `onPress`, `onValueChange`, or `onCheckedChange`
  owns that interaction and must render it inside its own explicit `"use client"` boundary.
- Field components render explicit labels and associate descriptions/errors. `requiredLabel` is
  caller-provided visible text, so required state is never communicated by color alone.
- Text inputs and textareas default to `autocomplete="off"`; callers opt into the reviewed public
  autocomplete values. Direction, input mode, and input type are runtime allowlisted; optional
  `maxLength` is bounded to 1–65,535 and textarea rows to 1–24. Password, file, hidden, and other
  sensitive/specialized input types are deliberately excluded: the approved identity architecture
  uses provider-owned magic-link, passkey, or social flows, and any later exception needs a dedicated
  security-reviewed control rather than server-prefilling this generic field.
- The autocomplete allowlist intentionally covers only current consumers and the planned magic-link
  email path. A future profile/address form must add its reviewed WCAG input-purpose tokens instead
  of bypassing the primitive. `inputMode="none"` is excluded until a real consumer provides an
  accessible replacement keyboard.
- An interactive mixed checkbox is controlled and requires `onCheckedChange` inside a client
  boundary. Without a callback, `mixed` is accepted only with native `disabled` for static status
  display, so browser checked/form state cannot diverge from its visual and ARIA state.
- `InlineAlert` is static by default. Use `live="polite"` only for a newly inserted status and
  `live="assertive"` only for a newly inserted urgent error.
- `EmptyState`, `ErrorState`, `OfflineState`, and `ProviderUnavailableState` are presentation-only
  page patterns. The consuming application owns localized copy, truthful state classification,
  focus timing, and retry behavior. Static states are quiet by default; use polite announcements for
  newly inserted advisory states and assertive announcements only for a newly inserted error.
  Actions are either bounded local links or caller-owned buttons. Never pass raw errors, provider
  payloads, request IDs, questions, journals, or other private text. Retry is permitted only when the
  caller has established that the operation is safe and idempotent.
  `StatePattern` is the lower-level discriminated renderer for a consumer that must change between
  reviewed variants without replacing a focused host subtree; prefer the named wrappers for static
  states.
- `Spinner` is decorative unless a localized label is supplied. `Skeleton` is always decorative;
  set `aria-busy="true"` on the affected region and retain meaningful fallback content.
- `system` is the default theme. Set only `data-theme="light"`, `"dark"`, or `"system"` on the
  document. This package performs no storage, network, analytics, environment, or preference work.

## State and locale review

Review every applicable default, hover, focus, active, disabled, loading, invalid, read-only,
required, checked, and mixed state. Verify 320px and 400% reflow, long translated text, Arabic RTL,
CJK wrapping, Devanagari shaping, light/dark/system, forced colors, reduced motion, keyboard order,
and 44px targets. Directional icons and switch travel follow each element's computed direction so
nested `dir="ltr"`/`dir="rtl"` overrides remain isolated; other symbols keep their orientation.

Japanese, Korean, Simplified Chinese, Traditional Chinese, and Devanagari use local-only fallback
stacks. The package never downloads fonts. CJK uses strict line breaking with normal word
breaking; Devanagari preserves ligatures and script-safe spacing. Human-authored values must not be
normalized or truncated during composition, and consumers must not use native `maxLength` where
UTF-16 units would disagree with the server's reviewed Unicode boundary.

The package intentionally excludes dialogs, comboboxes, date/location controls, domain cards, theme
persistence, service-worker caching, offline synchronization, provider adapters, and a generic
partial/degraded state machine until real consuming tasks can prove their interaction contracts.
Loading remains composed from the reviewed `Button`, `Spinner`, and `Skeleton` primitives. The
provider-unavailable presentation pattern does not prove that an application has a provider
integration or a provider-failure classifier.
