import type { LinkKind, NodeSourceType } from '../runtime.js';
import {
  type EvuKbPortableManifestV1,
  evuKbPortableFormat,
  evuKbPortableVersion,
  type PortableExportLink,
  type PortableExportNode,
} from './types.js';

const linkKinds: LinkKind[] = ['markdown', 'wikilink', 'autolink', 'citation', 'external'];
const nodeSourceTypes: NodeSourceType[] = ['managed', 'shared_mount', 'git', 'reference', 'import'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Manifest field "${field}" must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('Expected string or null.');
  }
  return value;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Manifest field "${field}" must be a boolean.`);
  }
  return value;
}

function readMetadata(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Manifest field "${field}" must be an object.`);
  }
  return value;
}

function parseExportNode(value: unknown, index: number): PortableExportNode {
  if (!isRecord(value)) {
    throw new Error(`Manifest nodes[${index}] must be an object.`);
  }
  const sourceType = readString(value.sourceType, `nodes[${index}].sourceType`);
  if (!nodeSourceTypes.includes(sourceType as NodeSourceType)) {
    throw new Error(`Manifest nodes[${index}].sourceType is invalid.`);
  }
  return {
    id: readString(value.id, `nodes[${index}].id`),
    path: typeof value.path === 'string' ? value.path : '',
    name: readString(value.name, `nodes[${index}].name`),
    contentHash: readString(value.contentHash, `nodes[${index}].contentHash`),
    mimeType: readOptionalString(value.mimeType),
    metadata: readMetadata(value.metadata ?? {}, `nodes[${index}].metadata`),
    sourceType: sourceType as NodeSourceType,
  };
}

function parseExportLink(value: unknown, index: number): PortableExportLink {
  if (!isRecord(value)) {
    throw new Error(`Manifest links[${index}] must be an object.`);
  }
  const linkKind = readString(value.linkKind, `links[${index}].linkKind`);
  if (!linkKinds.includes(linkKind as LinkKind)) {
    throw new Error(`Manifest links[${index}].linkKind is invalid.`);
  }
  const toNodeId = value.toNodeId;
  if (toNodeId !== null && typeof toNodeId !== 'string') {
    throw new Error(`Manifest links[${index}].toNodeId must be string or null.`);
  }
  return {
    fromNodeId: readString(value.fromNodeId, `links[${index}].fromNodeId`),
    toNodeId: toNodeId as string | null,
    linkKind: linkKind as LinkKind,
    raw: readString(value.raw, `links[${index}].raw`),
    targetPath: readOptionalString(value.targetPath),
    externalUrl: readOptionalString(value.externalUrl),
    resolved: readBoolean(value.resolved, `links[${index}].resolved`),
    metadata: readMetadata(value.metadata ?? {}, `links[${index}].metadata`),
  };
}

function parseChecksums(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error('Manifest checksums must be an object.');
  }
  const checksums: Record<string, string> = {};
  for (const [filePath, hash] of Object.entries(value)) {
    if (typeof hash !== 'string' || hash.length === 0) {
      throw new Error(`Manifest checksum for "${filePath}" must be a non-empty string.`);
    }
    checksums[filePath] = hash;
  }
  return checksums;
}

export function parsePortableManifestJson(raw: string): EvuKbPortableManifestV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Manifest is not valid JSON.');
  }
  return validatePortableManifest(parsed);
}

export function validatePortableManifest(value: unknown): EvuKbPortableManifestV1 {
  if (!isRecord(value)) {
    throw new Error('Manifest must be an object.');
  }

  const format = readString(value.format, 'format');
  if (format !== evuKbPortableFormat) {
    throw new Error(`Unsupported manifest format: ${format}`);
  }

  const version = value.version;
  if (version !== evuKbPortableVersion) {
    throw new Error(`Unsupported manifest version: ${String(version)}`);
  }

  if (!isRecord(value.corpus)) {
    throw new Error('Manifest corpus must be an object.');
  }

  const nodesRaw = value.nodes;
  if (!Array.isArray(nodesRaw)) {
    throw new Error('Manifest nodes must be an array.');
  }

  const linksRaw = value.links;
  if (!Array.isArray(linksRaw)) {
    throw new Error('Manifest links must be an array.');
  }

  return {
    format: evuKbPortableFormat,
    version: evuKbPortableVersion,
    exportedAt: readString(value.exportedAt, 'exportedAt'),
    corpus: {
      name: readString(value.corpus.name, 'corpus.name'),
      settings: readMetadata(value.corpus.settings ?? {}, 'corpus.settings'),
    },
    nodes: nodesRaw.map((node, index) => parseExportNode(node, index)),
    links: linksRaw.map((link, index) => parseExportLink(link, index)),
    checksums: parseChecksums(value.checksums),
  };
}

export function buildPortableManifest(
  input: Omit<EvuKbPortableManifestV1, 'format' | 'version'>,
): EvuKbPortableManifestV1 {
  return validatePortableManifest({
    format: evuKbPortableFormat,
    version: evuKbPortableVersion,
    ...input,
  });
}
