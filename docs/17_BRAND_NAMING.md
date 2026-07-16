# Brand Naming Decision

## 1. Recommendation

Use **RITUVIA** as the working brand, pending formal legal, domain, and linguistic clearance.

### Intended construction

- `Ritu-`: evokes ritual without using the full generic word.
- `-via`: path or way.
- Brand meaning: a path through insight, intention, ritual, and return.

### Pronunciation

Recommended English pronunciation: `rih-TOO-vee-uh`.

### Positioning line

`A global sanctuary for symbolic self-reflection and personal ritual.`

### Tagline

`Insight. Intention. Ritual. Return.`

## 2. Why it fits

- Distinctive enough to own as a product word rather than a descriptive keyword.
- Broad enough for tarot, astrology, numerology, rituals, journals, and future regional packs.
- Does not promise prophecy, magic, or guaranteed results.
- Pronounceable across many major-language sound systems, subject to native linguistic review.
- Allows search discovery to come from content architecture rather than relying on a generic brand term.

## 3. Preliminary conflict screen

As of 2026-07-16, exact-match public web searches for `Rituvia` and common app/company combinations did not reveal an obvious established exact-name product. This is only an initial collision screen. Search indexes are incomplete; unregistered use, pending applications, phonetic/visual similarity, local marks, domains, company names, and social handles may still conflict.

Do not state that RITUVIA is legally cleared or available until professional searches and registrations are complete.

## 4. Required clearance before public commitment

1. Exact, phonetic, visual, and conceptual trademark search in WIPO Global Brand Database.
2. USPTO, EUIPO, UKIPO, and the first paid-launch countries.
3. Relevant Nice classes determined by counsel; likely areas include software, education/entertainment/digital content, SaaS, and personal/spiritual services.
4. Company-name and app-store searches.
5. Domain registrar availability and adverse-history check.
6. Social handles and common misspellings.
7. Native linguistic/semantic screening for all Tier 0–2 languages.
8. Counsel opinion and filing strategy.

## 5. Domain strategy

Check and secure, in priority order, without assuming availability:

- Exact `.com`.
- A concise product modifier such as `get`, `with`, `app`, or `sanctuary` only if exact domain is unavailable.
- Defensive common misspellings and primary country domains as justified.
- Avoid hyphens and confusing doubled letters where possible.

Do not publicly promote a domain until ownership, DNS security, and trademark risk are confirmed.

## 6. Backup candidates

| Candidate | Meaning | Strength | Risk/concern |
|---|---|---|---|
| `RITUORA` | ritual + aura/ora | Warm and spiritual | More directly “aura”; may sound less grounded |
| `VOWORA` | vow + aura/ora | Intention/ritual resonance | “Vow” may feel religious or matrimonial |
| `NUMINARA` | numinous + ara | Premium sanctuary feel | Longer; “numinous” less globally understood |

Backups also require full clearance. Do not reserve them as legally safe based only on public search.

## 7. Brand architecture

Use one master brand and descriptive product labels:

- RITUVIA Tarot.
- RITUVIA Astrology.
- RITUVIA Numerology.
- RITUVIA Sanctuary.
- RITUVIA Journal.

Regional traditions should be named specifically and respectfully, not folded into a vague “mystic” category.

## 8. Configuration requirement

No user-facing code hardcodes `RITUVIA`, domain, legal entity, support email, sender, social handle, app-store ID, or asset URL. Use a typed brand configuration:

```ts
type BrandConfig = {
  name: string;
  shortName: string;
  legalEntity: string;
  tagline: string;
  canonicalOrigin: string;
  supportEmail: string;
  transactionalSender: string;
  socialHandles: Record<string, string>;
  assetManifest: string;
};
```

Tests should verify there are no legacy `LUMORA` strings outside `reference/` and migration notes after final naming.

## 9. Naming usage rules

- Write `RITUVIA` in all caps only in the logotype; normal prose may use `Rituvia` for readability after brand design decides.
- Do not append “AI Psychic,” “Fortune Guarantee,” or similar high-risk descriptors.
- SEO titles should explain the product utility; the brand alone should not carry discoverability.
- Legal disclaimers must use the actual legal entity after formation, not the working brand placeholder.
