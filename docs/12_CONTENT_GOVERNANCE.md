# Content and Cultural Governance

## 1. Purpose

RITUVIA earns trust through careful separation of tradition, interpretation, product design, and factual claims. Content must be traceable, respectful, legally usable, translatable, and reviewable.

## 2. Content principles

- Identify the specific tradition/system and its limits.
- Distinguish historical/cultural description from RITUVIA's reflective product interpretation.
- Preserve ambiguity and agency rather than claiming one authoritative truth.
- Do not flatten cultures into an interchangeable “mystical” aesthetic.
- Do not fabricate lineage, ritual authenticity, scripture, experts, or citations.
- Do not use sacred/restricted practices as generic paid decoration.
- Clearly mark AI-generated text and editorial review status.

## 3. Source hierarchy

Prefer:

1. Primary or authoritative traditional texts/records where appropriate and legally usable.
2. Reputable scholarly, museum, institutional, astronomical, historical, or practitioner sources.
3. Rights-cleared expert-created content.
4. Carefully reviewed secondary sources.

Do not use anonymous SEO sites, scraped competitors, model memory, or social posts as the sole authority for cultural claims.

## 4. Source record

Every content unit links to source records containing:

- Title, creator/editor/publisher.
- Publication/version/date.
- URL/ISBN/archive identifier.
- Tradition/geography/language.
- Rights/license and allowed use.
- Exact claim or excerpt supported.
- Reviewer and review date.
- Known disagreement/interpretation notes.
- Expiry/review date where facts/resources change.

## 5. Editorial states

```text
draft -> source_checked -> cultural_review -> safety_review
      -> translation_ready -> localized_review -> approved -> published
      -> deprecated/archived
```

Not every low-risk UI string needs every step. Tradition, safety, legal, payment, crisis, and claim-heavy content does.

## 6. Tarot content schema

For each card and orientation:

- Stable card/deck ID.
- Traditional title and alternatives.
- Visual symbols with source/art attribution.
- Core themes.
- Constructive possibilities.
- Tension/shadow without fear.
- Theme-specific readings.
- Reflection questions.
- Small actions.
- What the card cannot determine.
- Source and editorial version.
- Translation/cultural notes.

Deck artwork and text rights are separate and both must be documented.

## 7. Astrology content schema

For each planet/sign/house/aspect:

- Deterministic astronomical/geometry definition where applicable.
- Interpretive tradition and source.
- Possibilities and limitations.
- No diagnosis, personality certainty, compatibility verdict, or discriminatory inference.
- Birth-time/house-system uncertainty notes.
- Version and translation status.

## 8. Numerology content schema

- Rule-set name/tradition.
- Input normalization.
- Formula and reduction/master-number rules.
- Alphabet/language mapping and unsupported scripts.
- Worked examples.
- Interpretive possibilities and limits.
- Source/version.

Do not present one mapping as universally valid.

## 9. Ritual content schema

- Purpose and tradition/source, or clearly marked original secular symbolic design.
- Materials/objects and digital interaction.
- Accessibility alternative.
- Duration, audio/motion behavior.
- Safety considerations.
- Completion language.
- No efficacy guarantee.
- Commercial rights and cultural review.

## 10. Prohibited claims lexicon

Maintain locale-aware rules and reviewer guidance for claims such as:

- Guaranteed, destined, certain, proof, prophecy confirmed.
- Curse/possession/removal/protection guarantees.
- Fertility, disease, treatment, medication, death timing.
- Legal verdict, crime/guilt, immigration outcome.
- Investment/lottery/market certainty.
- Another person's secret thoughts/faithfulness/future behavior as fact.
- Paid item has stronger energy/power/results.
- Urgent spiritual window, dangerous energy, or dependency language.

A lexicon supports review; context-aware safety tests are still required.

## 11. Regional expansion rule

A new tradition needs a separate proposal with:

- User need and cultural scope.
- Named sources and qualified reviewers.
- Rights/licensing.
- Correct deterministic methodology if applicable.
- Local language and terminology plan.
- Prohibited/regulated claims and payment-country review.
- UX that does not blend it invisibly with another system.
- Eval/test corpus and launch monitoring.

No regional tradition launches merely because an LLM can generate text about it.

## 12. Translation governance

- Preserve concept and boundary, not only words.
- Maintain glossary and “do not translate” terms.
- Review mystical certainty, gender, honorific, relationship, crisis, and payment language carefully.
- Back-translation MAY be a QA signal, not final proof.
- Locale reviewers can reject source copy that cannot be safely translated.
- Published translated content records source version; stale translations are flagged/withdrawn where material.

## 13. AI-generated content governance

- AI drafts must carry source IDs and claim inventory.
- No citation may be fabricated or inferred from an unrelated source.
- Automated checks detect unsupported numerical/historical claims, plagiarism-like overlap, banned claims, cultural mixing, and missing boundaries.
- Human approval is required for sensitive publication classes.
- Generated personalized interpretations follow `docs/06_AI_INTERPRETATION_SAFETY.md` and are not indexed.

## 14. Content corrections

- User/editor can report factual, cultural, safety, translation, rights, or accessibility issues.
- Triage severity and unpublish critical content quickly via kill switch.
- Correct source unit and propagate version/translation dependencies.
- Preserve correction history and notify affected generated templates where needed.
- Do not silently rewrite historical paid reports; offer correction context/version handling.

## 15. Author and reviewer integrity

- Do not invent author biographies or expert review.
- Clearly distinguish AI assistance, staff editing, and external expert review.
- Record conflicts/sponsorship.
- Do not imply religious institutional endorsement without permission.
