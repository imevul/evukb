const nestedArchiveExtensions = ['.evukb', '.zip'] as const;

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function hasNestedArchiveExtension(entryName: string): boolean {
  const lower = entryName.toLowerCase();
  return nestedArchiveExtensions.some((extension) => lower.endsWith(extension));
}

export function stripSingleRootPrefix(
  entries: ReadonlyMap<string, Uint8Array>,
): Map<string, Uint8Array> {
  const filePaths = [...entries.keys()];
  if (filePaths.length === 0) {
    return new Map(entries);
  }

  if (filePaths.some((entryPath) => !entryPath.includes('/'))) {
    return new Map(entries);
  }

  const rootSegments = new Set(
    filePaths.map((entryPath) => entryPath.split('/')[0]).filter(Boolean),
  );
  if (rootSegments.size !== 1) {
    return new Map(entries);
  }

  const [rootPrefix] = rootSegments;
  if (!rootPrefix) {
    return new Map(entries);
  }
  const stripped = new Map<string, Uint8Array>();
  for (const [entryPath, body] of entries) {
    const relativePath = entryPath.slice(rootPrefix.length + 1);
    if (!relativePath) {
      continue;
    }
    stripped.set(relativePath, body);
  }

  return stripped.size > 0 ? stripped : new Map(entries);
}

export function findSingleNestedArchiveEntry(
  entries: ReadonlyMap<string, Uint8Array>,
): { entryName: string; body: Uint8Array } | null {
  const fileEntries = [...entries.entries()].filter(([entryName]) => !entryName.endsWith('/'));
  if (fileEntries.length !== 1) {
    return null;
  }

  const [entryName, body] = fileEntries[0] ?? [];
  if (!entryName || !body) {
    return null;
  }
  if (!hasNestedArchiveExtension(entryName) || !isZipBytes(body)) {
    return null;
  }

  return { entryName, body };
}
