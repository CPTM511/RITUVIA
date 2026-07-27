# Native Astrology Engine Instructions

These instructions apply to `packages/astrology-engine-native/**`.

- This package is server-only. It may depend on `@rituvia/divination`, but UI/client code and the
  pure package must never import native C types, paths, binaries, or provider-specific flags.
- Runtime network access and automatic engine/data fallback are forbidden.
- Execute only an absolute checksum-attested binary with checksum-attested, non-symlink,
  read-only ephemeris files.
- Discard native stderr and bound stdout, duration, arguments, and accepted JSON shape. Never log
  birth inputs, coordinates, UTC instants, paths, native payloads, or raw errors.
- The immutable vendor manifest must pin every source, header, notice, and data file by SHA-256.
  Build-time download requires an explicit flag and cannot occur in request handling.
- Preserve AGPL license text, upstream notices, complete bridge/build source, reproducible-build
  evidence, SBOM, ABI/compiler metadata, and the Corresponding Source release policy.
- Missing data, corrupt data, version drift, non-finite values, partial results, unexpected
  `SEFLG_SWIEPH` flags, or process failure return unavailable without placements.
- Generated source, data, binaries, metadata, and SBOMs stay under `.native-cache/` and must not be
  committed as substitutes for release archives or exact Corresponding Source.
