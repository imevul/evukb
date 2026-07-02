import { maxPortableZipEntries, maxPortableZipUncompressedBytes } from '../limits.js';

export type ArchiveImportLimits = {
  maxEntries: number;
  maxUncompressedBytes: number;
};

export const defaultArchiveImportLimits: ArchiveImportLimits = {
  maxEntries: maxPortableZipEntries,
  maxUncompressedBytes: maxPortableZipUncompressedBytes,
};

export const maxArchiveImportEntries = maxPortableZipEntries;
export const maxArchiveImportUncompressedBytes = maxPortableZipUncompressedBytes;

/**
 * Maximum accepted ratio between declared uncompressed size and compressed
 * archive size before an archive is treated as a zip bomb. Small archives get
 * a byte floor so legitimate highly-compressible files are not rejected.
 */
export const maxArchiveCompressionRatio = 200;
const compressionRatioByteFloor = 4 * 1024 * 1024;

export class ArchiveImportLimitError extends Error {
  override readonly name = 'ArchiveImportLimitError';
}

export function assertArchiveZipImportLimits(
  entries: Record<string, Uint8Array>,
  limits: ArchiveImportLimits = defaultArchiveImportLimits,
): void {
  let entryCount = 0;
  let totalBytes = 0;
  for (const [entryName, body] of Object.entries(entries)) {
    if (entryName.endsWith('/')) {
      continue;
    }
    entryCount += 1;
    totalBytes += body.byteLength;
    if (entryCount > limits.maxEntries) {
      throw new ArchiveImportLimitError(
        `Archive exceeds the maximum of ${limits.maxEntries} file entries.`,
      );
    }
    if (totalBytes > limits.maxUncompressedBytes) {
      throw new ArchiveImportLimitError(
        `Archive exceeds the maximum uncompressed size of ${limits.maxUncompressedBytes} bytes.`,
      );
    }
  }
}

/**
 * Tracks a cumulative entry/byte budget across nested archive layers so a zip
 * wrapped in another zip cannot double the effective import limits.
 */
export class ArchiveImportBudget {
  readonly #limits: ArchiveImportLimits;
  #entryCount = 0;
  #totalBytes = 0;

  constructor(limits: ArchiveImportLimits = defaultArchiveImportLimits) {
    this.#limits = limits;
  }

  /** Remaining limits after previously consumed layers. */
  remaining(): ArchiveImportLimits {
    return {
      maxEntries: Math.max(0, this.#limits.maxEntries - this.#entryCount),
      maxUncompressedBytes: Math.max(0, this.#limits.maxUncompressedBytes - this.#totalBytes),
    };
  }

  /** Validates a layer against the remaining budget and consumes it. */
  consume(entries: Record<string, Uint8Array>): void {
    for (const [entryName, body] of Object.entries(entries)) {
      if (entryName.endsWith('/')) {
        continue;
      }
      this.#entryCount += 1;
      this.#totalBytes += body.byteLength;
      if (this.#entryCount > this.#limits.maxEntries) {
        throw new ArchiveImportLimitError(
          `Archive exceeds the maximum of ${this.#limits.maxEntries} file entries across nested layers.`,
        );
      }
      if (this.#totalBytes > this.#limits.maxUncompressedBytes) {
        throw new ArchiveImportLimitError(
          `Archive exceeds the maximum uncompressed size of ${this.#limits.maxUncompressedBytes} bytes across nested layers.`,
        );
      }
    }
  }
}

export type ZipDeclaredTotals = {
  entryCount: number;
  totalUncompressedBytes: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_MIN_LENGTH = 22;
const MAX_EOCD_COMMENT_LENGTH = 0xffff;

/**
 * Reads entry count and declared uncompressed sizes from the zip central
 * directory without inflating any data. Returns null when the central
 * directory cannot be located or parsed (the caller should let the real zip
 * parser produce its own error). Zip64 markers are reported as
 * Number.MAX_SAFE_INTEGER so callers reject them against any sane limit.
 */
export function readZipDeclaredTotals(zipBytes: Uint8Array): ZipDeclaredTotals | null {
  if (zipBytes.byteLength < EOCD_MIN_LENGTH) {
    return null;
  }
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

  let eocdOffset = -1;
  const scanFloor = Math.max(0, zipBytes.byteLength - EOCD_MIN_LENGTH - MAX_EOCD_COMMENT_LENGTH);
  for (let offset = zipBytes.byteLength - EOCD_MIN_LENGTH; offset >= scanFloor; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    return null;
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  if (totalEntries === 0xffff || centralDirectoryOffset === 0xffffffff) {
    return {
      entryCount: Number.MAX_SAFE_INTEGER,
      totalUncompressedBytes: Number.MAX_SAFE_INTEGER,
    };
  }

  let offset = centralDirectoryOffset;
  let entryCount = 0;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    if (
      offset + 46 > zipBytes.byteLength ||
      view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return null;
    }
    const uncompressedSize = view.getUint32(offset + 24, true);
    if (uncompressedSize === 0xffffffff) {
      return {
        entryCount: Number.MAX_SAFE_INTEGER,
        totalUncompressedBytes: Number.MAX_SAFE_INTEGER,
      };
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entryCount += 1;
    totalUncompressedBytes += uncompressedSize;
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return { entryCount, totalUncompressedBytes };
}

/**
 * Guards against zip bombs before any decompression happens: rejects archives
 * whose central directory declares more entries or uncompressed bytes than the
 * limits allow, or whose declared expansion ratio is implausibly high.
 */
export function assertZipDeclaredSizesWithinLimits(
  zipBytes: Uint8Array,
  limits: ArchiveImportLimits = defaultArchiveImportLimits,
): void {
  const totals = readZipDeclaredTotals(zipBytes);
  if (!totals) {
    return;
  }
  if (totals.entryCount > limits.maxEntries) {
    throw new ArchiveImportLimitError(
      `Archive declares ${totals.entryCount} entries which exceeds the maximum of ${limits.maxEntries}.`,
    );
  }
  if (totals.totalUncompressedBytes > limits.maxUncompressedBytes) {
    throw new ArchiveImportLimitError(
      `Archive declares an uncompressed size beyond the maximum of ${limits.maxUncompressedBytes} bytes.`,
    );
  }
  const ratioBudget = Math.max(zipBytes.byteLength, compressionRatioByteFloor);
  if (totals.totalUncompressedBytes > ratioBudget * maxArchiveCompressionRatio) {
    throw new ArchiveImportLimitError(
      'Archive compression ratio is implausibly high; rejecting as a potential zip bomb.',
    );
  }
}
