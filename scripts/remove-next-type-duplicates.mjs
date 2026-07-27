import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const duplicatePattern = /^(?<base>.+) [2-9][0-9]*(?<extension>\.ts)$/u;
const typeRoots = [
  path.join(process.cwd(), ".next", "types"),
  path.join(process.cwd(), ".next", "dev", "types"),
];

for (const typeRoot of typeRoots) {
  let entries;
  try {
    entries = await readdir(typeRoot, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = duplicatePattern.exec(entry.name);
    if (match?.groups === undefined) continue;
    const duplicatePath = path.join(entry.parentPath, entry.name);
    const canonicalPath = path.join(
      entry.parentPath,
      `${match.groups.base}${match.groups.extension}`,
    );
    let duplicate;
    let canonical;
    try {
      [duplicate, canonical] = await Promise.all([
        readFile(duplicatePath),
        readFile(canonicalPath),
      ]);
    } catch (error) {
      throw new Error(
        `Generated Next.js type copy has no readable canonical peer: ${duplicatePath}`,
        {
          cause: error,
        },
      );
    }
    if (!duplicate.equals(canonical)) {
      throw new Error(
        `Generated Next.js type copy differs from its canonical peer: ${duplicatePath}`,
      );
    }
    await rm(duplicatePath);
  }
}
