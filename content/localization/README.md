# RITUVIA localization records

`rituvia-core-ui.en.v1.json` is the approved English source catalog for parameterized UI messages.
`rituvia-lifecycle-messages.en.v1.json` is the reviewed English source catalog for Revisit reminder
and support-receipt message architecture. Translation catalogs must bind the exact source version
and file checksum, preserve the ICU placeholder, link, and markup inventories, pass the approved
locale glossary, and reach `approved` status with the required reviewer before publication.

No non-English locale is activated by these records. Machine output remains `machine_draft`;
high-impact safety, spiritual, legal, and payment messages require an owner or qualified reviewer.
Locale launch, localized routes, country policy, legal copy, support, and deployment remain
separate gates.

`rituvia-core-ui.en.v1.runtime.json` and
`rituvia-lifecycle-messages.en.v1.runtime.json` are checksummed message-only projections of their
source catalogs. The localization workflow gate requires exact catalog identity, content type,
source checksum, and key/value parity while preventing rights, reviewer, or other source-governance
metadata from entering runtime assets.

Production lifecycle delivery requires an exact authorized locale and suppresses unsupported
locales rather than silently sending English. Explicit English fallback exists only in local
preview, emits one non-identifying event, and cannot activate delivery. The support receipt is
preview architecture only: no support address, service-level claim, provider, or send path is
activated.
