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

The first Tarot library publication is a separate D-081-approved editorial projection of the exact
approved local Major Arcana catalog. It may reuse the catalog's public-display material while
keeping SEO-editorial rights, route inventory, review evidence, and indexing authority separate.
Its exact projection checksum, rights, review window, and finite routes are registered in the
shared manifest and become indexable only through the production publication-integrity gate. It remains
unavailable to AI retrieval. Upright/reversed and theme content stay within one card document
rather than creating keyword-substitution doorway routes.

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

The first production-adapted schema is intentionally structural. Templates use closed purpose and
interaction codes, audio-off defaults, static reduced-motion equivalents, linear alternatives,
text-alternative localization keys, duration classes, and reflective completion. Catalog items
reference an exact template and approved publication record, carry a fixed symbolic-only scope and
no-external-outcome guarantee, and can declare only the reviewed art, animation, audio,
arrangement, duration, memory, collection, or persistence presentation dimensions. Arbitrary
instructions, descriptions, traditions, prices, Credit costs, ownership, efficacy, protection, or
result fields are rejected rather than filtered after acceptance.

The English original-secular catalog adapts the owner-supplied production-pack code inventory.
Regional traditions, additional locales, or substantive ritual prose require their separate
source, rights, cultural, translation, safety, and owner approval gates.

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

The first approved English numerology publication and interpretation source is
`content/traditions/numerology/rituvia-symbolic-reflection.en.v1.json`. D-065 binds its exact
version and digest, two owned-source rights records, author/reviewer metadata, thirty-six
calculation/result entries, prompt, fallback, independent semantic-review registration, public
route policy, and safe-off paid-product mapping. Public guides may project only reviewed
educational fields. Personalized interpretation may project only the complete bounded entry set
through the separate artifact integrity, authority, deterministic-fact, and safety boundary.
Number profiles are non-indexed source records and must not be automatically published as SEO
doorway pages.

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

## 16. Shared editorial repository boundary

`content/editorial/manifest.v1.json` is the Git-authored cross-content registry. The pure
`@rituvia/content` package validates exact asset checksums, stable identity and version, BCP 47
locale, method or tradition, audience, authorship and AI assistance, source and claim evidence,
rights and expiry, review role and freshness, risk, localization binding, lifecycle, deprecation,
and canonical-path ownership.

The registry supplements rather than replaces stricter Tarot, numerology, astrology, ritual, AI,
and message-catalog parsers. A registered artifact cannot be consumed merely because it parses or
declares approval. Private preview requires an exact digest and always emits private no-store and
noindex policy. Publication additionally requires process-owned record and source authority
fingerprints, explicit locale authority, and unexpired rights and review.

Corrections use retained versions and a reciprocal same-lineage replacement chain. Published
records do not return to draft. Translations bind the exact source record, version, and checksum;
source drift makes the binding invalid until a reviewed translation version replaces it.

The repository verifier reads only registered JSON files below `content/`, rejects symlinks and
resolved paths outside that root, pins the full manifest digest, hashes each artifact, verifies
record/source authority fingerprints, advances review and rights expiry using the current UTC
date, and invokes both authorization gates. The current registry contains only the approved English
numerology, Western natal education, Major Arcana, and ritual/reflection catalogs. It does not
activate AI retrieval, another locale, a regional tradition, legal policy, provider, deployment,
or public launch.

## 17. Original-secular ritual guide publication

`content/traditions/ritual/rituvia-ritual-reflection-library.en.v1.json` is a D-082-approved
RITUVIA editorial publication bound to the exact D-047 catalog digest. It declares one hub and five
finite guides, keeps source-catalog rights separate from SEO-editorial rights, and binds the owner
review, worldwide owned rights, review due date, six canonical paths, and production-only indexing
scope through the shared editorial authority.

The candidate may describe only the virtual product experience, optional reflection, a small
reversible action, private-by-default journaling, and voluntary revisit. It may not imply
historical, cultural, religious, health, therapeutic, manifestation, protection, cleansing,
prediction, or paid-object efficacy authority. The exact approved artifact digest, English rights,
review dates, and six-route inventory are registered in the shared editorial manifest and active
public route registry. Production build, browser accessibility, robots, sitemap, and publication
evidence are required for every later change and remain separate from deployment or public launch.

## 18. Public-page quality evidence

`content/editorial/public-page-inventory.v1.json` is the compact D-083 runtime authorization for
the exact active public inventory. It is generated only from typed core copy, exact editorial
artifacts, the localized route registry, and reviewed internal-link relationships. Core pages
retain D-025 decision authority and bind the exact Web message source digest; the other 41 pages
bind their D-080 editorial record and exact source-set digest.

`@rituvia/content` computes deterministic content and structure evidence and rejects thin pages,
exact/near duplication, template-only substitution, short-page containment, same-intent
cannibalization, canonical collision, stale review, missing authority or links, and unsafe
exposure. `pnpm check:public-pages` must reproduce the checked-in inventory byte-for-structure from
current sources. Runtime crawl publication accepts only the complete current passing set; it never
publishes a partial inventory after one record fails.

This evidence does not create editorial approval, replace domain-specific parsers, authorize a new
route or locale, or make an unreviewed content change safe. Human cultural, legal, safety, source,
and launch review remain independent gates.

## 19. Search representation authority

Structured data is a projection of visible reviewed content, not a separate editorial surface.
Every approved public inventory record declares one content shape and one exact structured parent.
Runtime maps only reviewed shapes to `WebSite`, `WebPage`, `CollectionPage`, or `Article`; an
unknown shape, missing parent, unrelated parent, stale inventory, or invisible parent link denies
the graph.

The graph may contain only canonical identity, type, English language, visible title, visible
description, and the reviewed parent identity. Hidden, `aria-hidden`, template, script, and style
content cannot supply evidence. Breadcrumbs, authorship, publication dates, FAQs, instructions,
products, offers, ratings, and reviews require their own visible source-authority decision before
publication.
