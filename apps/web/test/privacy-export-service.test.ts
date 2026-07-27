import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";

import { astrologyMethodCatalogSha256 } from "@rituvia/divination";

import { createPrivateContentCryptography } from "../server/private-content-crypto";
import { buildPrivacyExportPackage } from "../server/privacy-export";

type PrivacyExportSnapshot = Parameters<typeof buildPrivacyExportPackage>[0]["snapshot"];

const subjectId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const intentionId = "33333333-3333-4333-8333-333333333333";
const journalId = "44444444-4444-4444-8444-444444444444";
const ritualId = "55555555-5555-4555-8555-555555555555";
const revisitId = "66666666-6666-4666-8666-666666666666";
const readingId = "77777777-7777-4777-8777-777777777777";
const exportId = "88888888-8888-4888-8888-888888888888";
const birthProfileId = "99999999-9999-4999-8999-999999999999";
const astrologyCalculationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const encode = (value: Uint8Array): string => Buffer.from(value).toString("base64");
const asStored = (
  value: Readonly<{
    ciphertext: Uint8Array;
    keyVersion: string;
    nonce: Uint8Array;
    tag: Uint8Array;
  }>,
) => ({
  ciphertext: encode(value.ciphertext),
  keyVersion: value.keyVersion,
  nonce: encode(value.nonce),
  tag: encode(value.tag),
});

const encryptEmail = async (email: string, keyBytes: Uint8Array) => {
  const providerKey = "local.passwordless.v1";
  const providerSubject = "local.synthetic";
  const keyVersion = "auth-data.v1";
  const nonce = new Uint8Array(12).fill(6);
  const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const sealed = new Uint8Array(
    await webcrypto.subtle.encrypt(
      {
        additionalData: new TextEncoder().encode(
          `rituvia.account-email.v1:identity:${accountId}:${providerKey}:${providerSubject}:${keyVersion}`,
        ),
        iv: nonce,
        name: "AES-GCM",
        tagLength: 128,
      },
      key,
      new TextEncoder().encode(email),
    ),
  );
  return {
    providerKey,
    providerSubject,
    verifiedEmail: {
      ciphertext: encode(sealed.slice(0, -16)),
      keyVersion,
      nonce: encode(nonce),
      tag: encode(sealed.slice(-16)),
    },
  };
};

describe("privacy export package builder", () => {
  it("produces matching human and machine views with authorized private plaintext only", async () => {
    const privateKey = new Uint8Array(32).fill(3);
    const authKey = new Uint8Array(32).fill(4);
    const cryptography = createPrivateContentCryptography({
      activeKeyVersion: "private-content.v1",
      digestKeyVersion: "private-content.v1",
      keys: [{ key: privateKey, version: "private-content.v1" }],
    });
    const intentionText = "private intention canary";
    const smallAction = "private action canary";
    const journalText = "private journal canary";
    const revisitText = "private revisit canary";
    const email = "private-export@example.test";
    const identity = await encryptEmail(email, authKey);
    const birthProfilePayload = {
      label: "Private birth profile canary",
      selectedLocation: {
        admin1Code: "NY",
        countryCode: "US",
        displayName: "New York City, New York, United States",
        latitudeE6: 40_714_300,
        locationId: "geonames:5128581",
        longitudeE6: -74_006_000,
        timeZoneConfidence: "provider_assigned",
        timeZoneId: "America/New_York",
        timeZoneSource: "geonames.timezone",
      },
      normalized: {
        ambiguity: "unambiguous",
        offsetSeconds: -14_400,
        runtimeCanonicalTimeZoneId: "America/New_York",
        utcInstant: "1990-05-20T13:15:00.000Z",
      },
      originalInput: {
        approximationWindowMinutes: null,
        birthDate: "1990-05-20",
        birthTime: "09:15",
        disambiguation: null,
        locationId: "geonames:5128581",
      },
      provider: {
        adapterVersion: "1.0.0",
        attributionRequired: true,
        attributionText: "GeoNames",
        dataSha256: "a".repeat(64),
        dataVersion: "fixture-2026-07-26",
        licenseId: "CC-BY-4.0",
        providerId: "geonames.gazetteer",
        providerVersion: "1.0.0",
        sourceUrl: "https://download.geonames.org/export/dump/",
      },
      runtime: {
        historicalConfidence: "tzdb_rule_match",
        icuVersion: "78.3",
        runtimeId: "node_intl",
        runtimeVersion: "24.18.0",
        timeZoneDataVersion: "2026b",
      },
      schemaVersion: "birth-profile.v1",
      timeCertainty: "exact",
    };
    const birthProfilePlaintext = JSON.stringify(birthProfilePayload);
    const astrologyRequest = {
      approximationWindowMinutes: null,
      houseSystem: "placidus",
      inputSnapshotSha256: "1".repeat(64),
      latitudeE6: 40_714_300,
      longitudeE6: -74_006_000,
      method: {
        aspectPolicyVersion: "rituvia-major-aspects.v1",
        catalogSha256: astrologyMethodCatalogSha256,
        methodVersion: "rituvia-western-natal.v1",
        node: "true_node",
        zodiac: "tropical",
      },
      profileRevision: 1,
      schemaVersion: "astrology-natal-request.v1",
      timeCertainty: "unknown",
      timeZoneProvenanceSha256: "2".repeat(64),
      utcInstant: null,
    };
    const astrologyFacts = {
      approximationWindowMinutes: null,
      aspects: [],
      calculationStatus: "unavailable_unknown_time",
      confidence: {
        anglesAvailable: false,
        housesAvailable: false,
        messageCode: "UNKNOWN_TIME_NO_PLACEMENTS",
        timeCertainty: "unknown",
      },
      engine: {
        abiVersion: "darwin-arm64",
        adapterVersion: "1.0.0",
        binarySha256: "3".repeat(64),
        compilerFlagsSha256: "4".repeat(64),
        compilerId: "Apple clang 17",
        dataInventorySha256: "5".repeat(64),
        libraryVersion: "2.10.03",
        nativeSbomSha256: "6".repeat(64),
        sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
        sourceInventorySha256: "7".repeat(64),
        sourceSnapshotTag: "v2.10.3final",
      },
      houseSystem: "placidus",
      houses: null,
      inputSnapshotSha256: astrologyRequest.inputSnapshotSha256,
      julianDayUt: null,
      method: astrologyRequest.method,
      placements: [],
      profileRevision: 1,
      requestedEphemerisFlags: 258,
      schemaVersion: "astrology-natal-facts.v1",
      timeZoneProvenanceSha256: astrologyRequest.timeZoneProvenanceSha256,
    };
    const astrologyPlaintext = JSON.stringify({
      facts: astrologyFacts,
      request: astrologyRequest,
      schemaVersion: "astrology-calculation-payload.v1",
    });
    const snapshot: PrivacyExportSnapshot = {
      account: { id: accountId, locale: "en", status: "active" },
      astrologyCalculations: [
        {
          aspectPolicyVersion: astrologyFacts.method.aspectPolicyVersion,
          birthProfileId,
          birthProfileRevision: 1,
          createdAt: "2026-07-25T00:00:00.000Z",
          digestKeyVersion: cryptography.digestKeyVersion,
          encryptedFacts: asStored(
            cryptography.encrypt({
              context: {
                ownerSubjectId: accountId,
                purpose: "astrology_calculation.payload",
                resourceBinding: `astrology-calculation:${astrologyCalculationId}`,
              },
              plaintext: astrologyPlaintext,
            }),
          ),
          id: astrologyCalculationId,
          inputSnapshotDigest: `sha256:${astrologyFacts.inputSnapshotSha256}`,
          keyedFactsDigest: cryptography.deriveCanonicalRequestDigest({
            canonicalRequest: astrologyPlaintext,
            ownerSubjectId: accountId,
          }),
          methodCatalogDigest: `sha256:${astrologyMethodCatalogSha256}`,
          methodVersion: astrologyFacts.method.methodVersion,
          status: astrologyFacts.calculationStatus,
          timeCertainty: astrologyFacts.confidence.timeCertainty,
          timezoneProvenanceDigest: `sha256:${astrologyFacts.timeZoneProvenanceSha256}`,
        },
      ],
      birthProfiles: [
        {
          canonicalPayloadDigest: cryptography.deriveCanonicalRequestDigest({
            canonicalRequest: birthProfilePlaintext,
            ownerSubjectId: accountId,
          }),
          createdAt: "2026-07-25T00:00:00.000Z",
          digestKeyVersion: cryptography.digestKeyVersion,
          encryptedPayload: asStored(
            cryptography.encrypt({
              context: {
                ownerSubjectId: accountId,
                purpose: "birth_profile.payload",
                resourceBinding: `birth-profile:${birthProfileId}`,
              },
              plaintext: birthProfilePlaintext,
            }),
          ),
          id: birthProfileId,
          revision: 1,
          updatedAt: "2026-07-25T00:00:00.000Z",
        },
      ],
      commerce: { entitlements: [], ledgerEntries: [], orders: [], paymentAttempts: [] },
      consents: [],
      identities: [{ id: exportId, ...identity }],
      intentions: [
        {
          id: intentionId,
          intentionText: asStored(
            cryptography.encrypt({
              context: {
                ownerSubjectId: subjectId,
                purpose: "intention.text",
                resourceBinding: `intention:${intentionId}`,
              },
              plaintext: intentionText,
            }),
          ),
          readingId,
          schemaVersion: "reflection-intention.v2",
          smallAction: asStored(
            cryptography.encrypt({
              context: {
                ownerSubjectId: subjectId,
                purpose: "intention.small_action",
                resourceBinding: `intention:${intentionId}`,
              },
              plaintext: smallAction,
            }),
          ),
          subjectId,
        },
      ],
      interpretations: [],
      journals: {
        current: [
          {
            id: journalId,
            intentionId,
            reflection: asStored(
              cryptography.encrypt({
                context: {
                  ownerSubjectId: subjectId,
                  purpose: "journal.reflection",
                  resourceBinding: `journal:${journalId}`,
                },
                plaintext: journalText,
              }),
            ),
            ritualSessionId: ritualId,
            subjectId,
          },
        ],
        legacy: [],
      },
      linkedSubjects: [{ subjectId }],
      privacyActivity: [{ action: "requested", exportId }],
      readings: [],
      reports: [],
      revisits: [
        {
          completionReflection: null,
          id: revisitId,
          intentionText: asStored(
            cryptography.encrypt({
              context: {
                ownerSubjectId: subjectId,
                purpose: "revisit.intention_snapshot",
                resourceBinding: `revisit:${revisitId}`,
              },
              plaintext: revisitText,
            }),
          ),
          smallAction: asStored(
            cryptography.encrypt({
              context: {
                ownerSubjectId: subjectId,
                purpose: "revisit.action_snapshot",
                resourceBinding: `revisit:${revisitId}`,
              },
              plaintext: smallAction,
            }),
          ),
          subjectId,
        },
      ],
      rituals: { current: [], legacy: [] },
      sessions: [],
      snapshotAt: "2026-07-25T00:00:00.000Z",
    };
    const built = await buildPrivacyExportPackage({
      authKey,
      expiresAt: "2026-07-25T00:15:00.000Z",
      exportId,
      privateContentCryptography: cryptography,
      snapshot,
    });
    const parsed = JSON.parse(built.plaintext) as Record<string, unknown>;
    const serialized = JSON.stringify(parsed);

    expect(parsed.schemaVersion).toBe("privacy-export-package.v2");
    expect(built.recordCount).toBeGreaterThanOrEqual(6);
    expect(serialized).toContain(email);
    expect(serialized).toContain(intentionText);
    expect(serialized).toContain(smallAction);
    expect(serialized).toContain(journalText);
    expect(serialized).toContain(revisitText);
    expect(serialized).toContain("Private birth profile canary");
    expect(serialized).toContain("unavailable_unknown_time");
    expect(serialized).not.toContain(
      (snapshot.astrologyCalculations as Array<{ encryptedFacts: { ciphertext: string } }>)[0]!
        .encryptedFacts.ciphertext,
    );
    expect(serialized).not.toContain(identity.verifiedEmail.ciphertext);
    expect(serialized).not.toContain(
      (snapshot.intentions as Array<{ smallAction: { ciphertext: string } }>)[0]!.smallAction
        .ciphertext,
    );
    expect(String(parsed.humanReadableMarkdown)).toContain("## Intentions");
  });

  it("fails closed when encrypted content is rebound to another resource", async () => {
    const key = new Uint8Array(32).fill(3);
    const cryptography = createPrivateContentCryptography({
      activeKeyVersion: "private-content.v1",
      digestKeyVersion: "private-content.v1",
      keys: [{ key, version: "private-content.v1" }],
    });
    const mismatched = asStored(
      cryptography.encrypt({
        context: {
          ownerSubjectId: subjectId,
          purpose: "intention.small_action",
          resourceBinding: `intention:${journalId}`,
        },
        plaintext: "must not decrypt",
      }),
    );
    await expect(
      buildPrivacyExportPackage({
        authKey: new Uint8Array(32).fill(4),
        expiresAt: "2026-07-25T00:15:00.000Z",
        exportId,
        privateContentCryptography: cryptography,
        snapshot: {
          account: { id: accountId },
          astrologyCalculations: [],
          birthProfiles: [],
          commerce: {},
          consents: [],
          identities: [],
          intentions: [
            {
              id: intentionId,
              intentionText: null,
              readingId,
              schemaVersion: "reflection-intention.v2",
              smallAction: mismatched,
              subjectId,
            },
          ],
          interpretations: [],
          journals: { current: [], legacy: [] },
          linkedSubjects: [],
          privacyActivity: [],
          readings: [],
          reports: [],
          revisits: [],
          rituals: { current: [], legacy: [] },
          sessions: [],
          snapshotAt: "2026-07-25T00:00:00.000Z",
        },
      }),
    ).rejects.toThrow();
  });
});
