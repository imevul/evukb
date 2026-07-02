import { isZipBytes } from '@evu/kb-core/archive/heuristics';
import { gunzipSync, zipSync } from 'fflate';

const ARCHIVE_EXTENSIONS = ['.tar.gz', '.tgz', '.evukb.zip', '.evukb', '.zip', '.gz'] as const;

// Client-side caps mirroring the server import defaults so a hostile archive
// cannot exhaust browser memory during normalization.
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 10_000;

function isGzipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function parseTarOctal(value: string): number | null {
  const trimmed = value.replace(/\0/g, '').trim();
  if (!trimmed) {
    return 0;
  }
  const parsed = Number.parseInt(trimmed, 8);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readTarString(bytes: Uint8Array, start: number, length: number): string {
  return new TextDecoder()
    .decode(bytes.subarray(start, start + length))
    .replace(/\0/g, '')
    .trim();
}

function extractTarEntries(tarBytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  let offset = 0;

  while (offset + 512 <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + 512);
    const allZero = header.every((byte) => byte === 0);
    if (allZero) {
      break;
    }

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const size = parseTarOctal(readTarString(header, 124, 12));
    const typeFlag = readTarString(header, 156, 1);

    if (!name || size === null) {
      throw new Error('Uploaded tar archive is malformed.');
    }

    const entryPath = prefix ? `${prefix}/${name}` : name;
    offset += 512;

    if (typeFlag === '5' || typeFlag === 'g') {
      continue;
    }

    if (typeFlag !== '' && typeFlag !== '0' && typeFlag !== '7') {
      offset += Math.ceil(size / 512) * 512;
      continue;
    }

    if (offset + size > tarBytes.length) {
      throw new Error('Uploaded tar archive is truncated.');
    }

    entries.set(entryPath.replace(/^(\.\/)+/, ''), tarBytes.subarray(offset, offset + size));
    if (entries.size > MAX_ARCHIVE_ENTRIES) {
      throw new Error(`Archive exceeds the maximum of ${MAX_ARCHIVE_ENTRIES} file entries.`);
    }
    offset += Math.ceil(size / 512) * 512;
  }

  if (entries.size === 0) {
    throw new Error('Uploaded tar archive contains no importable files.');
  }

  return entries;
}

function looksLikeTarArchive(bytes: Uint8Array): boolean {
  if (bytes.length < 512) {
    return false;
  }

  const name = readTarString(bytes, 0, 100);
  const size = parseTarOctal(readTarString(bytes, 124, 12));
  const magic = readTarString(bytes, 257, 6);
  return Boolean(name) && size !== null && (magic === 'ustar' || magic === 'ustar\x00');
}

function tarEntriesToZip(entries: Map<string, Uint8Array>): Uint8Array {
  const zipEntries: Record<string, Uint8Array> = {};
  for (const [path, body] of entries) {
    zipEntries[path] = body;
  }
  return zipSync(zipEntries);
}

function zipBytesToFile(bytes: Uint8Array, sourceName: string): File {
  const zipName = sourceName.toLowerCase().endsWith('.zip')
    ? sourceName
    : `${stemFromArchiveName(sourceName)}.zip`;
  return new File([new Uint8Array(bytes)], zipName, { type: 'application/zip' });
}

export function stemFromArchiveName(fileName: string): string {
  const lower = fileName.toLowerCase();
  for (const extension of ARCHIVE_EXTENSIONS) {
    if (lower.endsWith(extension)) {
      return fileName.slice(0, fileName.length - extension.length);
    }
  }
  return fileName.replace(/\.[^./\\]+$/, '');
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

function declaredGzipSize(bytes: Uint8Array): number | null {
  if (bytes.length < 8) {
    return null;
  }
  // Gzip trailer ISIZE: uncompressed size modulo 2^32, little-endian.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(bytes.length - 4, true);
}

function decompressGzip(bytes: Uint8Array): Uint8Array {
  const declared = declaredGzipSize(bytes);
  if (declared !== null && declared > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
    throw new Error(
      `Archive exceeds the maximum uncompressed size of ${MAX_ARCHIVE_UNCOMPRESSED_BYTES} bytes.`,
    );
  }
  let decompressed: Uint8Array;
  try {
    decompressed = gunzipSync(bytes);
  } catch {
    throw new Error('Uploaded gzip archive could not be decompressed.');
  }
  if (decompressed.byteLength > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
    throw new Error(
      `Archive exceeds the maximum uncompressed size of ${MAX_ARCHIVE_UNCOMPRESSED_BYTES} bytes.`,
    );
  }
  return decompressed;
}

function normalizeArchiveBytes(bytes: Uint8Array, sourceName: string): Uint8Array {
  if (bytes.byteLength > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
    throw new Error(`Archive exceeds the maximum size of ${MAX_ARCHIVE_UNCOMPRESSED_BYTES} bytes.`);
  }

  if (isZipBytes(bytes)) {
    return bytes;
  }

  if (isGzipBytes(bytes)) {
    const decompressed = decompressGzip(bytes);
    if (isZipBytes(decompressed)) {
      return decompressed;
    }
    if (looksLikeTarArchive(decompressed)) {
      return tarEntriesToZip(extractTarEntries(decompressed));
    }
    throw new Error('Decompressed gzip file is not a zip or tar archive.');
  }

  if (looksLikeTarArchive(bytes)) {
    return tarEntriesToZip(extractTarEntries(bytes));
  }

  throw new Error(`“${sourceName}” is not a supported archive (.evukb, .zip, .gz, .tar.gz).`);
}

export async function normalizeArchiveUploadFile(file: File): Promise<File> {
  const bytes = await readFileBytes(file);
  const normalized = normalizeArchiveBytes(bytes, file.name);
  return zipBytesToFile(normalized, file.name);
}

export const ARCHIVE_IMPORT_ACCEPT =
  '.evukb,.zip,.gz,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip,application/x-tar';

/** @internal exported for tests */
export function normalizeArchiveUploadBytes(bytes: Uint8Array, sourceName: string): Uint8Array {
  return normalizeArchiveBytes(bytes, sourceName);
}

/** @internal exported for tests */
export function buildArchiveZipFromTarEntries(entries: Map<string, Uint8Array>): Uint8Array {
  return tarEntriesToZip(entries);
}

/** @internal exported for tests */
export function extractArchiveTarEntries(tarBytes: Uint8Array): Map<string, Uint8Array> {
  return extractTarEntries(tarBytes);
}
