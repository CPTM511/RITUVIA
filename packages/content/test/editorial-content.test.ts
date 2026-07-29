import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assessEditorialPreview,
  assessEditorialPublication,
  assessEditorialStatusTransition,
  authorizeEditorialPreview,
  authorizeEditorialPublication,
  authorizeEditorialStatusTransition,
  editorialRecordAuthorityKey,
  editorialSourceAuthorityKey,
  parseEditorialRepositoryV1,
  type EditorialPublicationContext,
} from "../src/index.js";

const manifestUrl = new URL("../../../content/editorial/manifest.v1.json", import.meta.url);
const manifestRaw = JSON.parse(readFileSync(manifestUrl, "utf8")) as Record<string, unknown>;
const cloneManifest = (): Record<string, unknown> => structuredClone(manifestRaw);
const manifestRecord = (manifest: Record<string, unknown>, recordId: string) => {
  const item = (manifest.records as Record<string, unknown>[]).find(
    (candidate) => candidate.recordId === recordId,
  );
  if (item === undefined) throw new TypeError("Missing manifest test record.");
  return item;
};
const manifestSource = (manifest: Record<string, unknown>, sourceId: string) => {
  const item = (manifest.sources as Record<string, unknown>[]).find(
    (candidate) => candidate.sourceId === sourceId,
  );
  if (item === undefined) throw new TypeError("Missing manifest test source.");
  return item;
};
const repository = parseEditorialRepositoryV1(manifestRaw);
const sha256 = (path: string): string =>
  createHash("sha256")
    .update(readFileSync(new URL(`../../../${path}`, import.meta.url)))
    .digest("hex");

const publicationContext = (
  recordId: string,
  override: Partial<EditorialPublicationContext> = {},
): EditorialPublicationContext => {
  const item = repository.records.find((candidate) => candidate.recordId === recordId);
  if (item === undefined) throw new TypeError("Missing test record.");
  return {
    actualArtifactSha256: sha256(item.artifact.path),
    approvedLocales: new Set(["en"]),
    approvedRecordAuthorities: new Set(repository.records.map(editorialRecordAuthorityKey)),
    approvedSourceAuthorities: new Set(repository.sources.map(editorialSourceAuthorityKey)),
    asOfDate: "2026-07-29",
    ...override,
  };
};

const findingCodes = (
  recordId: string,
  override: Partial<EditorialPublicationContext> = {},
): readonly string[] =>
  assessEditorialPublication(repository, recordId, publicationContext(recordId, override)).map(
    ({ code }) => code,
  );

describe("editorial repository", () => {
  it("parses the shared registry and binds exact approved artifacts", () => {
    expect(repository.repositoryId).toBe("rituvia.editorial");
    expect(repository.records.map(({ recordId }) => recordId)).toEqual([
      "rituvia.geo-answer-context.en@1.0.0",
      "rituvia.astrology.western-natal-education.en@1.0.0",
      "rituvia.numerology.symbolic-reflection.en@1.0.0",
      "rituvia.tarot.major-arcana-library.en@1.0.0",
      "rituvia.ritual-reflection.library.en@1.0.0",
    ]);
    for (const item of repository.records) {
      expect(sha256(item.artifact.path)).toBe(item.artifact.sha256);
      expect(item.sourceRefs.length).toBeGreaterThan(0);
      expect(item.claimRefs.length).toBeGreaterThan(0);
    }
  });

  it("authorizes private noindex preview and exact English publication", () => {
    for (const item of repository.records) {
      expect(
        authorizeEditorialPreview(repository, item.recordId, {
          actorRole: "editor",
          actualArtifactSha256: sha256(item.artifact.path),
        }),
      ).toEqual({
        artifactSha256: item.artifact.sha256,
        cacheControl: "private, no-store",
        locale: "en",
        mode: "preview",
        recordId: item.recordId,
        robots: "noindex, nofollow, noarchive",
      });
      expect(
        authorizeEditorialPublication(repository, item.recordId, publicationContext(item.recordId)),
      ).toMatchObject({
        artifactSha256: item.artifact.sha256,
        indexingAllowed: item.publication.indexingAllowed,
        locale: "en",
        mode: "publication",
        recordId: item.recordId,
        robots: item.publication.indexingAllowed ? "index, follow" : "noindex, follow",
      });
    }
  });

  it("allows only explicit forward editorial status transitions", () => {
    const recordId = repository.records[0]!.recordId;
    expect(assessEditorialStatusTransition(recordId, "draft", "source_checked")).toEqual([]);
    expect(assessEditorialStatusTransition(recordId, "approved", "published")).toEqual([]);
    expect(assessEditorialStatusTransition(recordId, "published", "deprecated")).toEqual([]);
    expect(assessEditorialStatusTransition(recordId, "published", "draft")).toEqual([
      { code: "transition", recordId },
    ]);
    expect(() => authorizeEditorialStatusTransition(recordId, "archived", "published")).toThrow(
      "Editorial authorization failed: transition",
    );
  });

  it("fails publication closed on artifact, authority, locale, review, and source drift", () => {
    const recordId = repository.records[0]!.recordId;
    expect(
      findingCodes(recordId, {
        actualArtifactSha256: "0".repeat(64),
        approvedLocales: new Set(),
        approvedRecordAuthorities: new Set(),
        approvedSourceAuthorities: new Set(),
        asOfDate: "2028-01-01",
      }),
    ).toEqual(["artifact", "locale", "approval", "review", "source"]);
    expect(() =>
      authorizeEditorialPublication(repository, recordId, {
        ...publicationContext(recordId),
        approvedRecordAuthorities: new Set(),
      }),
    ).toThrow("Editorial authorization failed: approval");
    expect(() =>
      assessEditorialPublication(repository, recordId, {
        ...publicationContext(recordId),
        asOfDate: "not-a-date",
      }),
    ).toThrow(TypeError);
  });

  it("rejects malformed paths, metadata drift, self-review, and cross-lineage SEO duplication", () => {
    const withTraversal = cloneManifest();
    const traversalRecord = manifestRecord(
      withTraversal,
      "rituvia.astrology.western-natal-education.en@1.0.0",
    );
    (traversalRecord.artifact as Record<string, unknown>).path = "content/../private.json";
    const withUnexpected = cloneManifest();
    manifestRecord(
      withUnexpected,
      "rituvia.astrology.western-natal-education.en@1.0.0",
    ).unexpected = true;
    const withSelfReview = cloneManifest();
    const selfReviewed = manifestRecord(
      withSelfReview,
      "rituvia.astrology.western-natal-education.en@1.0.0",
    );
    (selfReviewed.author as Record<string, unknown>).id = (
      selfReviewed.review as Record<string, unknown>
    ).reviewerId;
    const withDuplicatePath = cloneManifest();
    const secondSeo = manifestRecord(
      withDuplicatePath,
      "rituvia.numerology.symbolic-reflection.en@1.0.0",
    ).seo as Record<string, unknown>;
    secondSeo.canonicalPaths = [...((secondSeo.canonicalPaths as string[]) ?? []), "/en/astrology"];
    const withLocaleDrift = cloneManifest();
    const localeDriftSeo = manifestRecord(
      withLocaleDrift,
      "rituvia.astrology.western-natal-education.en@1.0.0",
    ).seo as Record<string, unknown>;
    localeDriftSeo.canonicalPaths = ["/fr/astrology"];
    const withSourceSelfReview = cloneManifest();
    const selfReviewedSource = manifestSource(
      withSourceSelfReview,
      "rituvia.source.astrology-method",
    );
    selfReviewedSource.creator = selfReviewedSource.reviewerId;

    expect(() => parseEditorialRepositoryV1(withTraversal)).toThrow(TypeError);
    expect(() => parseEditorialRepositoryV1(withUnexpected)).toThrow(TypeError);
    expect(() => parseEditorialRepositoryV1(withSelfReview)).toThrow(TypeError);
    expect(() => parseEditorialRepositoryV1(withDuplicatePath)).toThrow(TypeError);
    expect(() => parseEditorialRepositoryV1(withLocaleDrift)).toThrow(TypeError);
    expect(() => parseEditorialRepositoryV1(withSourceSelfReview)).toThrow(TypeError);
  });

  it("rejects self-declared record and source authority drift under unchanged IDs", () => {
    const driftedManifest = cloneManifest();
    const driftedRecord = (driftedManifest.records as Record<string, unknown>[])[0]!;
    driftedRecord.status = "approved";
    const driftedSource = (driftedManifest.sources as Record<string, unknown>[])[0]!;
    (driftedSource.rights as Record<string, unknown>).evidenceReference = "changed-evidence";
    const driftedRepository = parseEditorialRepositoryV1(driftedManifest);
    const recordId = driftedRecord.recordId as string;

    expect(
      assessEditorialPublication(driftedRepository, recordId, publicationContext(recordId)).map(
        ({ code }) => code,
      ),
    ).toEqual(["approval", "source"]);
  });

  it("binds translations to an exact source and blocks incomplete localized review", () => {
    const translatedManifest = cloneManifest();
    const records = translatedManifest.records as Record<string, unknown>[];
    const source = manifestRecord(
      translatedManifest,
      "rituvia.astrology.western-natal-education.en@1.0.0",
    );
    const translation = structuredClone(source);
    translation.contentId = "rituvia.astrology.western-natal-education.es-419";
    translation.recordId = "rituvia.astrology.western-natal-education.es-419@1.0.0";
    translation.locale = "es-419";
    translation.status = "approved";
    translation.artifact = {
      path: "content/editorial/testing/astrology.es-419.v1.json",
      sha256: "1".repeat(64),
    };
    translation.localization = {
      kind: "translation",
      method: "machine_then_human",
      sourceArtifactSha256: (source.artifact as Record<string, unknown>).sha256,
      sourceRecordId: source.recordId,
      sourceVersion: source.version,
      status: "human_review",
    };
    translation.review = {
      approvalReference: "test:es-419-review",
      requiredRole: "qualified",
      reviewDueDate: "2027-07-28",
      reviewedDate: "2026-07-28",
      reviewerId: "qualified.es-419",
      reviewerRole: "qualified",
    };
    translation.seo = {
      canonicalPaths: ["/es-419/astrologia"],
      description: "Contenido de prueba revisado para verificar el límite editorial.",
      title: "Astrología de prueba",
    };
    records.push(translation);
    const translatedRepository = parseEditorialRepositoryV1(translatedManifest);
    const context: EditorialPublicationContext = {
      actualArtifactSha256: "1".repeat(64),
      approvedLocales: new Set(["es-419"]),
      approvedRecordAuthorities: new Set(
        translatedRepository.records.map(editorialRecordAuthorityKey),
      ),
      approvedSourceAuthorities: new Set(
        translatedRepository.sources.map(editorialSourceAuthorityKey),
      ),
      asOfDate: "2026-07-28",
    };

    expect(
      assessEditorialPublication(translatedRepository, translation.recordId as string, context).map(
        ({ code }) => code,
      ),
    ).toEqual(["localization"]);

    (translation.localization as Record<string, unknown>).status = "approved";
    const approvedRepository = parseEditorialRepositoryV1(translatedManifest);
    const approvedContext = {
      ...context,
      approvedRecordAuthorities: new Set(
        approvedRepository.records.map(editorialRecordAuthorityKey),
      ),
    };
    expect(
      authorizeEditorialPublication(
        approvedRepository,
        translation.recordId as string,
        approvedContext,
      ).locale,
    ).toBe("es-419");

    (translation.localization as Record<string, unknown>).sourceArtifactSha256 = "2".repeat(64);
    expect(() => parseEditorialRepositoryV1(translatedManifest)).toThrow(TypeError);

    (translation.localization as Record<string, unknown>).sourceArtifactSha256 = (
      source.artifact as Record<string, unknown>
    ).sha256;
    source.status = "archived";
    expect(() => parseEditorialRepositoryV1(translatedManifest)).toThrow(TypeError);

    source.status = "published";
    (source.rights as Record<string, unknown>).allowedUses = [
      "internal_preview",
      "public_display",
      "commercial_use",
      "seo_publication",
    ];
    expect(() => parseEditorialRepositoryV1(translatedManifest)).toThrow(TypeError);
  });

  it("retains a reciprocal acyclic deprecation chain and rejects broken replacement metadata", () => {
    const versionedManifest = cloneManifest();
    const records = versionedManifest.records as Record<string, unknown>[];
    const previous = manifestRecord(
      versionedManifest,
      "rituvia.astrology.western-natal-education.en@1.0.0",
    );
    const replacement = structuredClone(previous);
    previous.status = "deprecated";
    previous.lifecycle = {
      ...(previous.lifecycle as Record<string, unknown>),
      deprecatedDate: "2026-07-28",
      replacementRecordId: "rituvia.astrology.western-natal-education.en@2.0.0",
    };
    replacement.version = "2.0.0";
    replacement.recordId = "rituvia.astrology.western-natal-education.en@2.0.0";
    replacement.status = "approved";
    replacement.artifact = {
      path: "content/editorial/testing/astrology.en.v2.json",
      sha256: "3".repeat(64),
    };
    replacement.lifecycle = {
      changeReason: "Replace the first version through an explicit retained editorial chain.",
      deprecatedDate: null,
      effectiveDate: "2026-07-28",
      replacementRecordId: null,
      supersedesRecordId: previous.recordId,
    };
    records.push(replacement);

    const parsed = parseEditorialRepositoryV1(versionedManifest);
    expect(parsed.records.at(-1)?.lifecycle.supersedesRecordId).toBe(previous.recordId);

    previous.version = "3.0.0";
    previous.recordId = "rituvia.astrology.western-natal-education.en@3.0.0";
    (previous.lifecycle as Record<string, unknown>).replacementRecordId = replacement.recordId;
    (replacement.lifecycle as Record<string, unknown>).supersedesRecordId = previous.recordId;
    expect(() => parseEditorialRepositoryV1(versionedManifest)).toThrow(TypeError);

    previous.version = "1.0.0";
    previous.recordId = "rituvia.astrology.western-natal-education.en@1.0.0";
    (previous.lifecycle as Record<string, unknown>).replacementRecordId = replacement.recordId;
    (replacement.lifecycle as Record<string, unknown>).supersedesRecordId =
      "rituvia.astrology.western-natal-education.en@9.0.0";
    expect(() => parseEditorialRepositoryV1(versionedManifest)).toThrow(TypeError);
  });

  it("blocks archived previews and rejects reference-only source publication rights", () => {
    const archivedManifest = cloneManifest();
    const archived = (archivedManifest.records as Record<string, unknown>[])[0]!;
    archived.status = "archived";
    archived.publication = {
      indexingAllowed: false,
      previewAllowed: false,
      publishAllowed: false,
    };
    archived.seo = null;
    const archivedRepository = parseEditorialRepositoryV1(archivedManifest);
    expect(
      assessEditorialPreview(archivedRepository, archived.recordId as string, {
        actorRole: "owner",
        actualArtifactSha256: (archived.artifact as Record<string, unknown>).sha256 as string,
      }).map(({ code }) => code),
    ).toEqual(["preview"]);

    const invalidSourceRights = cloneManifest();
    const referenceRights = manifestSource(
      invalidSourceRights,
      "rituvia.source.swiss-programming-reference",
    ).rights as Record<string, unknown>;
    referenceRights.allowedUses = ["factual_citation", "public_display"];
    expect(() => parseEditorialRepositoryV1(invalidSourceRights)).toThrow(TypeError);
  });

  it("blocks publication when prohibited-claim review is not complete", () => {
    const unsafeManifest = cloneManifest();
    const unsafe = (unsafeManifest.records as Record<string, unknown>[])[0]!;
    (unsafe.risk as Record<string, unknown>).prohibitedClaimsChecked = false;
    const unsafeRepository = parseEditorialRepositoryV1(unsafeManifest);

    expect(
      assessEditorialPublication(
        unsafeRepository,
        unsafe.recordId as string,
        publicationContext(unsafe.recordId as string),
      ).map(({ code }) => code),
    ).toEqual(["approval", "safety"]);
  });
});
