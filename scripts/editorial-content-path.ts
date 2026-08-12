import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

const escapesRoot = (relativePath: string): boolean =>
  relativePath === "" ||
  relativePath.startsWith(`..${path.sep}`) ||
  relativePath === ".." ||
  path.isAbsolute(relativePath);

export const assertRegularFileBelowRoot = async (
  rootPath: string,
  candidatePath: string,
): Promise<string> => {
  const rootStat = await lstat(rootPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new TypeError("Editorial content root must be a regular directory.");
  }
  const relativeCandidate = path.relative(rootPath, candidatePath);
  if (escapesRoot(relativeCandidate)) {
    throw new TypeError("Editorial content path escapes its root.");
  }
  const parts = relativeCandidate.split(path.sep);
  let currentPath = rootPath;
  for (const [index, part] of parts.entries()) {
    currentPath = path.join(currentPath, part);
    const currentStat = await lstat(currentPath);
    if (currentStat.isSymbolicLink()) {
      throw new TypeError("Editorial content paths cannot contain symbolic links.");
    }
    if (index < parts.length - 1 && !currentStat.isDirectory()) {
      throw new TypeError("Editorial content parent must be a regular directory.");
    }
    if (index === parts.length - 1 && !currentStat.isFile()) {
      throw new TypeError("Editorial content artifact must be a regular file.");
    }
  }
  const resolvedRoot = await realpath(rootPath);
  const resolvedCandidate = await realpath(candidatePath);
  if (escapesRoot(path.relative(resolvedRoot, resolvedCandidate))) {
    throw new TypeError("Editorial content resolution escapes its root.");
  }
  return resolvedCandidate;
};
