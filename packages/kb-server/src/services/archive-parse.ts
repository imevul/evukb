import {
  ArchiveImportBudget,
  assertZipDeclaredSizesWithinLimits,
  buildAutostrippedArchiveWarning,
  findSingleNestedArchiveEntry,
  isPortableArchive,
  normalizeArchiveZipEntry,
  stripAutostrippedZipEntries,
  stripSingleRootPrefix,
} from '@evu/kb-core';
import { unzipSync } from 'fflate';

import { ApiError } from '../errors.js';
import { resolveArchiveImportLimits } from '../limits.js';
import { filterPortableZipEntries } from './import-shared.js';

export type ResolvedArchiveImport =
  | { mode: 'portable'; entries: Map<string, Uint8Array>; autostrippedCount: number }
  | { mode: 'archive'; entries: Map<string, Uint8Array>; autostrippedCount: number };

export function parseZipUpload(zipBuffer: Buffer): Record<string, Uint8Array> {
  const bytes = new Uint8Array(zipBuffer);
  assertDeclaredZipSafety(bytes, resolveArchiveImportLimits());
  try {
    return unzipSync(bytes);
  } catch {
    throw ApiError.validation('Uploaded file is not a valid zip archive.');
  }
}

/** Zip-bomb guard: validates central-directory declared sizes before inflating. */
function assertDeclaredZipSafety(
  zipBytes: Uint8Array,
  limits: ReturnType<typeof resolveArchiveImportLimits>,
): void {
  try {
    assertZipDeclaredSizesWithinLimits(zipBytes, limits);
  } catch (error) {
    if (error instanceof Error && error.name === 'ArchiveImportLimitError') {
      throw ApiError.validation(error.message);
    }
    throw error;
  }
}

function normalizeGenericZipEntries(entries: Record<string, Uint8Array>): Map<string, Uint8Array> {
  const safeEntries = new Map<string, Uint8Array>();
  for (const [entryName, body] of Object.entries(entries)) {
    if (entryName.endsWith('/')) {
      continue;
    }
    try {
      const normalized = normalizeArchiveZipEntry(entryName);
      safeEntries.set(normalized, body);
    } catch (error) {
      throw ApiError.validation(
        error instanceof Error ? error.message : 'Unsafe zip entry rejected.',
      );
    }
  }
  return safeEntries;
}

function portableEntriesFromRaw(entries: Record<string, Uint8Array>): Map<string, Uint8Array> {
  return filterPortableZipEntries(entries);
}

function consumeArchiveBudget(
  budget: ArchiveImportBudget,
  entries: Record<string, Uint8Array>,
): void {
  try {
    budget.consume(entries);
  } catch (error) {
    if (error instanceof Error && error.name === 'ArchiveImportLimitError') {
      throw ApiError.validation(error.message);
    }
    throw error;
  }
}

export function resolveArchiveImport(entries: Record<string, Uint8Array>): ResolvedArchiveImport {
  // One budget spans all nested layers so a zip-in-zip cannot double the limits.
  const budget = new ArchiveImportBudget(resolveArchiveImportLimits());
  const initial = stripAutostrippedZipEntries(entries);
  let autostrippedCount = initial.autostrippedCount;
  consumeArchiveBudget(budget, initial.entries);

  const genericEntries = normalizeGenericZipEntries(initial.entries);
  if (isPortableArchive(genericEntries)) {
    return {
      mode: 'portable',
      entries: portableEntriesFromRaw(initial.entries),
      autostrippedCount,
    };
  }

  const nested = findSingleNestedArchiveEntry(genericEntries);
  if (nested) {
    assertDeclaredZipSafety(nested.body, budget.remaining());
    const innerEntries = parseZipUpload(Buffer.from(nested.body));
    const innerStripped = stripAutostrippedZipEntries(innerEntries);
    autostrippedCount += innerStripped.autostrippedCount;
    consumeArchiveBudget(budget, innerStripped.entries);
    const innerGeneric = normalizeGenericZipEntries(innerStripped.entries);
    if (isPortableArchive(innerGeneric)) {
      return {
        mode: 'portable',
        entries: portableEntriesFromRaw(innerStripped.entries),
        autostrippedCount,
      };
    }
    return {
      mode: 'archive',
      entries: stripSingleRootPrefix(innerGeneric),
      autostrippedCount,
    };
  }

  return {
    mode: 'archive',
    entries: stripSingleRootPrefix(genericEntries),
    autostrippedCount,
  };
}

export function appendAutostrippedArchiveWarnings(
  warnings: string[],
  autostrippedCount: number,
): string[] {
  if (autostrippedCount <= 0) {
    return warnings;
  }
  const message = buildAutostrippedArchiveWarning(autostrippedCount);
  return warnings.includes(message) ? warnings : [message, ...warnings];
}
