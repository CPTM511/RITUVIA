# Domain Package Instructions

These instructions apply to `packages/domain/**`.

## Role

Define framework-independent entities, value objects, state machines, domain errors, policies, and use-case interfaces shared across applications.

## Rules

- No React, Next.js, database client, network client, provider SDK, logging backend, or environment-variable access.
- Prefer immutable values and explicit constructors/validation.
- Represent money, locale, country, time, identity, content version, reading version, and policy version with typed value objects—not loose strings/numbers.
- State transitions are explicit and reject impossible jumps.
- Domain errors are stable and mapped to UI/API/provider behavior elsewhere.
- Time and randomness enter through injectable interfaces.
- Never place private free text in error messages or object stringification.

## Testing

Use unit and property tests for invariants, transition tables, serialization compatibility, and edge cases. Domain behavior is not considered covered solely by API/E2E tests.
