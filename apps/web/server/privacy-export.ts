import "server-only";

import { webcrypto } from "node:crypto";

import { normalizeAccountEmail, parseBirthProfilePayloadV1 } from "@rituvia/domain";
import { parseAstrologyNatalFactsV1, parseAstrologyNatalRequestV1 } from "@rituvia/divination";
import {
  createPrivacyExportPersistence,
  PrivacyExportError,
  type PrivacyExportMetadata,
  type PrivacyExportPersistence,
  type PrivacyExportSnapshot,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebDatabase } from "./database";
import {
  createPrivateContentCryptography,
  type EncryptedPrivateContent,
  type PrivateContentCryptography,
} from "./private-content-crypto";
import {
  createPrivacyExportArtifactCryptography,
  PrivacyExportCryptoError,
  type PrivacyExportArtifactBinding,
} from "./privacy-export-crypto";

export type WebPrivacyExportErrorCode =
  | "conflict"
  | "expired"
  | "invalid"
  | "not_found"
  | "not_ready"
  | "rate_limited"
  | "recent_auth_required"
  | "session_unavailable"
  | "unavailable";

export class WebPrivacyExportError extends Error {
  readonly code: WebPrivacyExportErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: WebPrivacyExportErrorCode, retryAfterSeconds?: number) {
    super("The privacy export operation failed.");
    this.name = "WebPrivacyExportError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WebPrivacyExportError("unavailable");
  }
  return value as JsonRecord;
};

const array = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) throw new WebPrivacyExportError("unavailable");
  return value;
};

const text = (value: unknown): string => {
  if (typeof value !== "string") throw new WebPrivacyExportError("unavailable");
  return value;
};

const nullableText = (value: unknown): string | null => {
  if (value === null) return null;
  return text(value);
};

const decodeBase64 = (value: unknown): Uint8Array => {
  const encoded = text(value);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.byteLength === 0 || bytes.toString("base64") !== encoded) {
    throw new WebPrivacyExportError("unavailable");
  }
  return Uint8Array.from(bytes);
};

const encryptedContent = (value: unknown): EncryptedPrivateContent => {
  const source = record(value);
  return Object.freeze({
    ciphertext: decodeBase64(source.ciphertext),
    keyVersion: text(source.keyVersion),
    nonce: decodeBase64(source.nonce),
    tag: decodeBase64(source.tag),
  });
};

const decryptVerifiedEmail = async (
  input: Readonly<{
    accountId: string;
    authKey: Uint8Array;
    encrypted: unknown;
    providerKey: string;
    providerSubject: string;
  }>,
): Promise<string> => {
  const encrypted = record(input.encrypted);
  const keyVersion = text(encrypted.keyVersion);
  if (keyVersion !== "auth-data.v1") throw new WebPrivacyExportError("unavailable");
  const ciphertext = decodeBase64(encrypted.ciphertext);
  const tag = decodeBase64(encrypted.tag);
  const sealed = new Uint8Array(ciphertext.byteLength + tag.byteLength);
  sealed.set(ciphertext);
  sealed.set(tag, ciphertext.byteLength);
  try {
    const key = await webcrypto.subtle.importKey("raw", input.authKey, "AES-GCM", false, [
      "decrypt",
    ]);
    const plaintext = await webcrypto.subtle.decrypt(
      {
        additionalData: new TextEncoder().encode(
          `rituvia.account-email.v1:identity:${input.accountId}:${input.providerKey}:${input.providerSubject}:${keyVersion}`,
        ),
        iv: decodeBase64(encrypted.nonce),
        name: "AES-GCM",
        tagLength: 128,
      },
      key,
      sealed,
    );
    return normalizeAccountEmail(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
  } catch {
    throw new WebPrivacyExportError("unavailable");
  }
};

const decryptSnapshot = async (
  snapshot: PrivacyExportSnapshot,
  cryptography: PrivateContentCryptography,
  authKey: Uint8Array,
): Promise<JsonRecord> => {
  const account = record(snapshot.account);
  const accountId = text(account.id);
  const identities = await Promise.all(
    array(snapshot.identities).map(async (value) => {
      const identity = record(value);
      const providerKey = text(identity.providerKey);
      const providerSubject = text(identity.providerSubject);
      return Object.freeze({
        ...identity,
        verifiedEmail: await decryptVerifiedEmail({
          accountId,
          authKey,
          encrypted: identity.verifiedEmail,
          providerKey,
          providerSubject,
        }),
      });
    }),
  );
  const birthProfiles = array(snapshot.birthProfiles).map((value) => {
    const profile = record(value);
    const id = text(profile.id);
    const plaintext = cryptography.decrypt({
      context: {
        ownerSubjectId: accountId,
        purpose: "birth_profile.payload",
        resourceBinding: `birth-profile:${id}`,
      },
      encrypted: encryptedContent(profile.encryptedPayload),
    });
    const canonicalPayloadDigest = text(profile.canonicalPayloadDigest);
    const calculatedDigest = cryptography.deriveCanonicalRequestDigest({
      canonicalRequest: plaintext,
      ownerSubjectId: accountId,
    });
    if (
      text(profile.digestKeyVersion) !== cryptography.digestKeyVersion ||
      !cryptography.digestsEqual(canonicalPayloadDigest, calculatedDigest)
    ) {
      throw new WebPrivacyExportError("unavailable");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(plaintext);
    } catch {
      throw new WebPrivacyExportError("unavailable");
    }
    return Object.freeze({
      createdAt: profile.createdAt,
      id,
      payload: parseBirthProfilePayloadV1(payload),
      revision: profile.revision,
      updatedAt: profile.updatedAt,
    });
  });
  const astrologyCalculations = array(snapshot.astrologyCalculations).map((value) => {
    const calculation = record(value);
    const id = text(calculation.id);
    const plaintext = cryptography.decrypt({
      context: {
        ownerSubjectId: accountId,
        purpose: "astrology_calculation.payload",
        resourceBinding: `astrology-calculation:${id}`,
      },
      encrypted: encryptedContent(calculation.encryptedFacts),
    });
    const calculatedDigest = cryptography.deriveCanonicalRequestDigest({
      canonicalRequest: plaintext,
      ownerSubjectId: accountId,
    });
    if (
      text(calculation.digestKeyVersion) !== cryptography.digestKeyVersion ||
      !cryptography.digestsEqual(text(calculation.keyedFactsDigest), calculatedDigest)
    ) {
      throw new WebPrivacyExportError("unavailable");
    }
    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(plaintext);
    } catch {
      throw new WebPrivacyExportError("unavailable");
    }
    const payload = record(rawPayload);
    if (payload.schemaVersion !== "astrology-calculation-payload.v1") {
      throw new WebPrivacyExportError("unavailable");
    }
    const request = parseAstrologyNatalRequestV1(payload.request);
    const facts = parseAstrologyNatalFactsV1(payload.facts);
    if (
      request.profileRevision !== facts.profileRevision ||
      request.inputSnapshotSha256 !== facts.inputSnapshotSha256 ||
      request.timeZoneProvenanceSha256 !== facts.timeZoneProvenanceSha256 ||
      text(calculation.birthProfileId).length === 0 ||
      calculation.birthProfileRevision !== facts.profileRevision ||
      text(calculation.status) !== facts.calculationStatus ||
      text(calculation.timeCertainty) !== facts.confidence.timeCertainty ||
      text(calculation.methodVersion) !== facts.method.methodVersion ||
      text(calculation.aspectPolicyVersion) !== facts.method.aspectPolicyVersion ||
      text(calculation.methodCatalogDigest) !== `sha256:${facts.method.catalogSha256}` ||
      text(calculation.inputSnapshotDigest) !== `sha256:${facts.inputSnapshotSha256}` ||
      text(calculation.timezoneProvenanceDigest) !== `sha256:${facts.timeZoneProvenanceSha256}`
    ) {
      throw new WebPrivacyExportError("unavailable");
    }
    return Object.freeze({
      birthProfileId: calculation.birthProfileId,
      birthProfileRevision: calculation.birthProfileRevision,
      createdAt: calculation.createdAt,
      facts,
      id,
      request,
    });
  });
  const intentions = array(snapshot.intentions).map((value) => {
    const intention = record(value);
    const id = text(intention.id);
    const subjectId = text(intention.subjectId);
    const schemaVersion = text(intention.schemaVersion);
    const intentionText =
      intention.intentionText === null
        ? null
        : cryptography.decrypt({
            context: {
              ownerSubjectId: subjectId,
              purpose: "intention.text",
              resourceBinding: `intention:${id}`,
            },
            encrypted: encryptedContent(intention.intentionText),
          });
    const readingId = nullableText(intention.readingId);
    const smallAction = cryptography.decrypt({
      context: {
        ownerSubjectId: subjectId,
        purpose: "intention.small_action",
        resourceBinding:
          schemaVersion === "reflection-intention.v1"
            ? `reading:${readingId ?? ""}`
            : `intention:${id}`,
      },
      encrypted: encryptedContent(intention.smallAction),
    });
    return Object.freeze({ ...intention, intentionText, smallAction });
  });
  const journalGroups = record(snapshot.journals);
  const journals = Object.freeze({
    current: array(journalGroups.current).map((value) => {
      const journal = record(value);
      return Object.freeze({
        ...journal,
        reflection: cryptography.decrypt({
          context: {
            ownerSubjectId: text(journal.subjectId),
            purpose: "journal.reflection",
            resourceBinding: `journal:${text(journal.id)}`,
          },
          encrypted: encryptedContent(journal.reflection),
        }),
      });
    }),
    legacy: array(journalGroups.legacy).map((value) => {
      const journal = record(value);
      return Object.freeze({
        ...journal,
        reflection: cryptography.decrypt({
          context: {
            ownerSubjectId: text(journal.subjectId),
            purpose: "journal.reflection",
            resourceBinding: `journal:${text(journal.intentionId)}:${nullableText(journal.ritualSessionId)}`,
          },
          encrypted: encryptedContent(journal.reflection),
        }),
      });
    }),
  });
  const revisits = array(snapshot.revisits).map((value) => {
    const revisit = record(value);
    const id = text(revisit.id);
    const subjectId = text(revisit.subjectId);
    return Object.freeze({
      ...revisit,
      completionReflection:
        revisit.completionReflection === null
          ? null
          : cryptography.decrypt({
              context: {
                ownerSubjectId: subjectId,
                purpose: "revisit.completion",
                resourceBinding: `revisit:${id}`,
              },
              encrypted: encryptedContent(revisit.completionReflection),
            }),
      intentionText: cryptography.decrypt({
        context: {
          ownerSubjectId: subjectId,
          purpose: "revisit.intention_snapshot",
          resourceBinding: `revisit:${id}`,
        },
        encrypted: encryptedContent(revisit.intentionText),
      }),
      smallAction: cryptography.decrypt({
        context: {
          ownerSubjectId: subjectId,
          purpose: "revisit.action_snapshot",
          resourceBinding: `revisit:${id}`,
        },
        encrypted: encryptedContent(revisit.smallAction),
      }),
    });
  });
  return Object.freeze({
    account,
    astrologyCalculations,
    birthProfiles,
    commerce: snapshot.commerce,
    consents: snapshot.consents,
    identities,
    intentions,
    interpretations: snapshot.interpretations,
    journals,
    linkedSubjects: snapshot.linkedSubjects,
    privacyActivity: snapshot.privacyActivity,
    readings: snapshot.readings,
    reports: snapshot.reports,
    revisits,
    rituals: snapshot.rituals,
    sessions: snapshot.sessions,
    wallets: snapshot.wallets,
  });
};

const countRecords = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.length + value.reduce((total, item) => total + countRecords(item), 0);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).reduce((total, item) => total + countRecords(item), 0);
  }
  return 0;
};

const humanReadableMarkdown = (
  exportedAt: string,
  expiresAt: string,
  machineReadable: JsonRecord,
): string => {
  const sections = Object.entries(machineReadable)
    .map(([name, value]) => {
      const title = name.replaceAll(/([a-z])([A-Z])/gu, "$1 $2");
      const formatted = JSON.stringify(value, null, 2)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
      return `## ${title[0]?.toUpperCase() ?? ""}${title.slice(1)}\n\n${formatted}`;
    })
    .join("\n\n");
  return `# RITUVIA Privacy Export

Generated at: ${exportedAt}
Download available until: ${expiresAt}

This document is a human-readable view of the same versioned data included in the
\`machineReadable\` field. Private user-authored text is reproduced exactly inside JSON strings.

${sections}
`;
};

export const buildPrivacyExportPackage = async (input: {
  authKey: Uint8Array;
  expiresAt: string;
  exportId: string;
  privateContentCryptography: PrivateContentCryptography;
  snapshot: PrivacyExportSnapshot;
}): Promise<Readonly<{ plaintext: string; recordCount: number }>> => {
  const machineReadable = await decryptSnapshot(
    input.snapshot,
    input.privateContentCryptography,
    input.authKey,
  );
  const recordCount = countRecords(machineReadable);
  return Object.freeze({
    plaintext: JSON.stringify(
      Object.freeze({
        humanReadableMarkdown: humanReadableMarkdown(
          input.snapshot.snapshotAt,
          input.expiresAt,
          machineReadable,
        ),
        machineReadable,
        manifest: Object.freeze({
          exportId: input.exportId,
          exportedAt: input.snapshot.snapshotAt,
          expiresAt: input.expiresAt,
          format: "json+markdown",
          recordCount,
        }),
        schemaVersion: "privacy-export-package.v2",
      }),
    ),
    recordCount,
  });
};

const mapError = (error: unknown): never => {
  if (error instanceof WebPrivacyExportError) throw error;
  if (error instanceof PrivacyExportCryptoError) throw new WebPrivacyExportError("unavailable");
  if (error instanceof PrivacyExportError) {
    switch (error.code) {
      case "PRIVACY_EXPORT_CONFLICT":
        throw new WebPrivacyExportError("conflict");
      case "PRIVACY_EXPORT_EXPIRED":
        throw new WebPrivacyExportError("expired");
      case "PRIVACY_EXPORT_INVALID":
        throw new WebPrivacyExportError("invalid");
      case "PRIVACY_EXPORT_NOT_FOUND":
        throw new WebPrivacyExportError("not_found");
      case "PRIVACY_EXPORT_NOT_READY":
        throw new WebPrivacyExportError("not_ready");
      case "PRIVACY_EXPORT_RATE_LIMITED":
        throw new WebPrivacyExportError("rate_limited", error.retryAfterSeconds);
      case "PRIVACY_EXPORT_RECENT_AUTH_REQUIRED":
        throw new WebPrivacyExportError("recent_auth_required");
      case "PRIVACY_EXPORT_SESSION_UNAVAILABLE":
        throw new WebPrivacyExportError("session_unavailable");
      case "PRIVACY_EXPORT_UNAVAILABLE":
        throw new WebPrivacyExportError("unavailable");
    }
  }
  throw new WebPrivacyExportError("unavailable");
};

let persistence: PrivacyExportPersistence | undefined;

const loadRuntime = () => {
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.databaseUrl === undefined ||
    configuration.accountIdentityPolicy === undefined ||
    configuration.privateContentKeyring === undefined ||
    configuration.privacyExport === undefined
  ) {
    throw new WebPrivacyExportError("unavailable");
  }
  persistence ??= createPrivacyExportPersistence(loadWebDatabase(), {
    artifactTtlSeconds: configuration.privacyExport.artifactTtlSeconds,
    encryptionKeyVersion: configuration.privacyExport.encryptionKeyVersion,
    recentAuthenticationSeconds: configuration.privacyExport.recentAuthenticationSeconds,
    requestWindowSeconds: configuration.privacyExport.requestWindowSeconds,
  });
  return Object.freeze({
    artifactCryptography: createPrivacyExportArtifactCryptography({
      key: configuration.privacyExport.artifactKey,
      version: configuration.privacyExport.encryptionKeyVersion,
    }),
    authKey: configuration.accountIdentityPolicy.emailEncryptionKey,
    privateContentCryptography: createPrivateContentCryptography(
      configuration.privateContentKeyring,
    ),
    persistence,
  });
};

export const requestWebPrivacyExport = async (input: {
  idempotencyKey: string;
  sessionToken: string | undefined;
}): Promise<PrivacyExportMetadata> => {
  if (input.sessionToken === undefined) throw new WebPrivacyExportError("session_unavailable");
  const runtime = loadRuntime();
  try {
    const prepared = await runtime.persistence.prepare({
      idempotencyKey: input.idempotencyKey,
      sessionToken: input.sessionToken,
    });
    if (prepared.kind === "existing") return prepared.metadata;
    try {
      const built = await buildPrivacyExportPackage({
        authKey: runtime.authKey,
        expiresAt: prepared.metadata.expiresAt,
        exportId: prepared.metadata.id,
        privateContentCryptography: runtime.privateContentCryptography,
        snapshot: prepared.snapshot,
      });
      const encrypted = runtime.artifactCryptography.encrypt(
        {
          createdAt: prepared.metadata.createdAt,
          encryptionKeyVersion: runtime.artifactCryptography.version,
          expiresAt: prepared.metadata.expiresAt,
          exportId: prepared.metadata.id,
          schemaVersion: "privacy-export-package.v2",
          userId: prepared.userId,
        },
        built.plaintext,
      );
      return await runtime.persistence.complete({
        ...encrypted,
        exportId: prepared.metadata.id,
        recordCount: built.recordCount,
        userId: prepared.userId,
      });
    } catch (error) {
      await runtime.persistence
        .fail({
          exportId: prepared.metadata.id,
          failureCode: "build_failed",
          userId: prepared.userId,
        })
        .catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return mapError(error);
  }
};

export const getWebPrivacyExportMetadata = async (input: {
  exportId: string;
  sessionToken: string | undefined;
}): Promise<PrivacyExportMetadata> => {
  if (input.sessionToken === undefined) throw new WebPrivacyExportError("session_unavailable");
  try {
    return await loadRuntime().persistence.getMetadata({
      exportId: input.exportId,
      sessionToken: input.sessionToken,
    });
  } catch (error) {
    return mapError(error);
  }
};

export const downloadWebPrivacyExport = async (input: {
  exportId: string;
  sessionToken: string | undefined;
}): Promise<string> => {
  if (input.sessionToken === undefined) throw new WebPrivacyExportError("session_unavailable");
  const runtime = loadRuntime();
  try {
    const encrypted = await runtime.persistence.authorizeDownload({
      exportId: input.exportId,
      sessionToken: input.sessionToken,
    });
    const binding: PrivacyExportArtifactBinding = {
      createdAt: encrypted.createdAt,
      encryptionKeyVersion: encrypted.encryptionKeyVersion,
      expiresAt: encrypted.expiresAt,
      exportId: encrypted.id,
      schemaVersion: encrypted.schemaVersion,
      userId: encrypted.userId,
    };
    return runtime.artifactCryptography.decrypt(binding, {
      authenticationTag: encrypted.authenticationTag,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      plaintextBytes: encrypted.plaintextBytes,
      plaintextSha256: encrypted.plaintextSha256,
    });
  } catch (error) {
    return mapError(error);
  }
};
