# Divination Engine Instructions

These instructions apply to `packages/divination/**`.

## Role

Implement deterministic, inspectable, versioned calculation engines for tarot selection/layout, Western astrology inputs/calculations, and numerology. This package produces facts/symbolic primitives—not persuasive prose, diagnoses, predictions, or advice.

## Design rules

- Pure functions where possible; no UI, database, network, provider SDK, analytics, or AI imports.
- Explicit versioned input/output schemas and provenance.
- Reproducible seeded randomness for test/replay; production entropy source must be documented and unbiased.
- Preserve user-selected method/deck/system options explicitly.
- Do not merge traditions into an invented “universal” system.
- Return uncertainty, missing-input, boundary, and calculation metadata when relevant.

## Tarot

- Separate deck metadata, card identity, orientation, spread positions, draw algorithm, and interpretation content.
- Prevent duplicate draws unless the configured deck/method explicitly permits replacement.
- Version deck/content licenses independently from draw logic.

## Astrology

- Keep astronomical calculation/provider adapter behind a narrow interface.
- Store input precision and time-zone/source confidence; never fabricate birth time.
- Unknown birth time follows a documented limited flow and suppresses unsupported houses/angles.
- Pin ephemeris/calculation versions and verify license before production activation.

## Numerology

- Make normalization rules, alphabet/system, master-number behavior, date calendar, transliteration policy, and reduction steps visible and versioned.
- Do not silently transliterate names across scripts; ask for or document the chosen representation.

## Tests

- Golden vectors from authoritative, licensed, reviewable sources.
- Property tests for invariants and edge cases.
- Cross-time-zone/DST/leap-year/calendar fixtures.
- Seed reproducibility and distribution sanity tests.
- Backward-compatibility fixtures for persisted reading versions.

Any calculation discrepancy blocks release until resolved or explicitly versioned/migrated.
