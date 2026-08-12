import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  authorizeEditorialPreview,
  authorizeEditorialPublication,
  editorialRecordAuthorityKey,
  editorialSourceAuthorityKey,
  parseEditorialRepositoryV1,
} from "../packages/content/src/index.js";
import { assertRegularFileBelowRoot } from "./editorial-content-path.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const contentPath = path.join(repositoryRoot, "content");
const manifestPath = await assertRegularFileBelowRoot(
  contentPath,
  path.join(contentPath, "editorial", "manifest.v1.json"),
);
const contentRoot = await realpath(contentPath);
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const manifestBytes = await readFile(manifestPath);
if (sha256(manifestBytes) !== "c7430ba8b34a489a71eb99447034ccba6a45f41f4345b13fd0ea7162a45a7316") {
  throw new Error("Editorial manifest authority drifted.");
}
const manifest = parseEditorialRepositoryV1(JSON.parse(manifestBytes.toString("utf8")));
const trustedRecordAuthorityDigests = new Map([
  [
    "rituvia.geo-answer-context.en@1.0.0",
    "20af97ddde8cd3be4847c9e8a6e8d1d03b2e064393807852e0d5828544657e2e",
  ],
  [
    "rituvia.astrology.western-natal-education.en@1.0.0",
    "2cd65754474d5b0bb99a900d4598bb423fffdf9cac4bb1dc4a3209af51f976cf",
  ],
  [
    "rituvia.numerology.symbolic-reflection.en@1.0.0",
    "d51cdd481611911cc449259945d9d9c37d51f90d642f75bb9718afb877ef8045",
  ],
  [
    "rituvia.tarot.major-arcana-library.en@1.0.0",
    "7ce7fa932678055fa02a416062c2b6cb4188c5df4115b8e13ba631cedbba3754",
  ],
  [
    "rituvia.ritual-reflection.library.en@1.0.0",
    "a775b30fe92be0456e71c6e211ffa4f81a1700264bf7b90d5c4b7afdd28f8f3b",
  ],
]);
const trustedSourceAuthorityDigests = new Map([
  [
    "rituvia.source.geo-answer-context",
    "a3976ae70eb8e9df0b4acaba51965072d97ac8c9c0bcbe8a198decded9e830e5",
  ],
  [
    "rituvia.source.astrology-method",
    "0e7a1e98958dacbdfbf7d97d415768c4d07b92d321008698f2fd61c3c29661ae",
  ],
  [
    "rituvia.source.astrology-education",
    "aa6582ab0b0f9998edaa3e031653c089b92bb9a9042d18fa2f8da8c1ac85e156",
  ],
  [
    "rituvia.source.swiss-programming-reference",
    "c9b37ad27e99aaec4616df18b5c78b9bcf521c8e7d6e4c21f11bc328fbf72e39",
  ],
  [
    "rituvia.source.numerology-prototype",
    "a1ffed6826615a334e2baf7c90936269bc22d6a55f5d5a7a6bdbd3b23cbf6733",
  ],
  [
    "rituvia.source.numerology-editorial",
    "ac36bb150573a4355fd1ce0c36ef6fc83c27e638a8fc3a9f30c8f87e89195349",
  ],
  [
    "rituvia.source.tarot-major-arcana",
    "678e71a7027816b8f59358a95dcbf84ccc23aaf29e5016256b6e987ef99e9d9a",
  ],
  [
    "rituvia.source.tarot-library-editorial",
    "5b338646ae8362d6896477b2e523d9576d8892c22bbf12667a2fa235ad37f8b1",
  ],
  [
    "rituvia.source.ritual-original-secular-catalog",
    "cff36f79e59d7335d0947c0637e3e8dfdbe46f88bcdfa4b36e2267735beb1090",
  ],
  [
    "rituvia.source.ritual-reflection-editorial",
    "59b006510c6161375e331cdcd422b5cfcf4fc4feb094f86b27ccadfb2e32c621",
  ],
]);
const approvedLocales = new Set(["en"]);
const verificationDate = new Date().toISOString().slice(0, 10);
const approvedRecordAuthorities = new Set<string>();
const approvedSourceAuthorities = new Set<string>();

if (
  manifest.records.length !== trustedRecordAuthorityDigests.size ||
  manifest.sources.length !== trustedSourceAuthorityDigests.size
) {
  throw new Error("Editorial authority registry drifted.");
}
for (const item of manifest.records) {
  const authority = editorialRecordAuthorityKey(item);
  if (sha256(authority) !== trustedRecordAuthorityDigests.get(item.recordId)) {
    throw new Error(`Editorial record authority drifted: ${item.recordId}`);
  }
  approvedRecordAuthorities.add(authority);
}
for (const source of manifest.sources) {
  const authority = editorialSourceAuthorityKey(source);
  if (sha256(authority) !== trustedSourceAuthorityDigests.get(source.sourceId)) {
    throw new Error(`Editorial source authority drifted: ${source.sourceId}`);
  }
  approvedSourceAuthorities.add(authority);
}

for (const item of manifest.records) {
  const artifactPath = path.resolve(repositoryRoot, item.artifact.path);
  const resolvedArtifactPath = await assertRegularFileBelowRoot(contentRoot, artifactPath);
  const artifact = await readFile(resolvedArtifactPath);
  JSON.parse(artifact.toString("utf8"));
  const actualArtifactSha256 = sha256(artifact);
  authorizeEditorialPreview(manifest, item.recordId, {
    actorRole: "owner",
    actualArtifactSha256,
  });
  if (item.status === "approved" || item.status === "published") {
    authorizeEditorialPublication(manifest, item.recordId, {
      actualArtifactSha256,
      approvedLocales,
      approvedRecordAuthorities,
      approvedSourceAuthorities,
      asOfDate: verificationDate,
    });
  }
}

process.stdout.write(
  `Verified ${manifest.records.length} editorial records, ${manifest.sources.length} sources, ` +
    `${manifest.claims.length} claims, and fail-closed preview/publication authority.\n`,
);
