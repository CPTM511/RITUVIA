# RITUVIA Open Source and Corresponding Source Policy

RITUVIA is licensed under `AGPL-3.0-only`. The complete license is in [`LICENSE`](../LICENSE).

## Public network releases

Before a public network version is activated, release evidence must prove that:

1. the public source repository identifies the exact deployed version or immutable commit;
2. users can reach a prominent source-code link from the running service;
3. the published Corresponding Source contains all RITUVIA source, modifications, interfaces,
   native bridge source, build/install scripts, dependency manifests, lockfiles, and material
   configuration needed to generate and run the deployed object code;
4. Swiss Ephemeris source/data provenance, checksums, copyright notices, and AGPL terms are
   preserved;
5. generated binaries, source maps, and SBOMs identify the same source revision;
6. no private key, token, customer data, production secret, or private operational evidence is
   included; and
7. third-party materials are distributed only under compatible terms with their notices intact.

An upstream URL alone is not accepted as durable Corresponding Source evidence for a deployed
version. Release packaging must archive every exact upstream source and data file used to build the
native artifact, even when development builds use the checksum-pinned acquisition script.

## Swiss Ephemeris

RITUVIA uses the AGPL option described by Swiss Ephemeris. The project must preserve the upstream
copyright and license notice and must not use Astrodienst or author names to promote RITUVIA.
Runtime calculation is offline. Build-time acquisition is explicit, checksum-pinned, and excluded
from request handling.

The active source/data snapshot, native compiler settings, ABI, SBOM, reference vectors, returned
engine flags, and kill-switch evidence are versioned release inputs. Automatic Moshier, JPL,
alternate-data, or alternate-engine fallback is forbidden.

## Offline archive rehearsal

`pnpm test:astrology-native-corresponding-source -- --source-root <verified-source-root>` creates an
ignored native-component archive, verifies its complete extracted inventory, and rebuilds with a
rejecting curl shim first in `PATH`. The rebuilt engine metadata must exactly match the baseline.
CI uses the explicit `--allow-download` acquisition mode before proving the archived rebuild is
offline.

This rehearsal covers the native component and its exact Swiss Ephemeris inputs. It is not the
public release offer: a dirty worktree archive, a component-only archive, an upstream URL, or an
unpublished local file cannot satisfy the complete exact-deployed-version Corresponding Source
requirements above.

## Complete release-source rehearsal

`pnpm test:release-corresponding-source` accepts only an explicit 40-character release revision,
a checksum-attested native-component archive, and that archive's SHA-256. It fails unless the
repository and component evidence are clean and bound to the same revision. It rejects unexpected
ignored inputs, symlinks, submodules, conflicts, case-colliding paths, unresolved Git LFS pointers,
environment redirection, component/source drift, unsafe archive entries, and existing output
replacement. The resulting ignored local archive contains the complete tracked repository plus
the exact pinned Swiss source/data, an independently computed inventory, and offline native
rebuild instructions.

The ordinary CI rehearsal does not upload or publish this archive. Final release evidence must run
the gate on the immutable deployed revision, retain and upload the resulting archive, re-download
it and verify its digest, and expose a prominent unauthenticated source link bound to that exact
revision.

## Review boundary

The owner has approved AGPL licensing and public Corresponding Source publication. A qualified
license-compatibility review remains part of the legal/public-launch gate, especially for
third-party assets, fonts, content, and dependencies. It does not authorize suppressing source or
attribution obligations.
