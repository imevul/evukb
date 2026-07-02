import type { LinkKind, NodeSourceType } from '../runtime.js';

export const evuKbPortableFormat = 'evukb-portable' as const;
export const evuKbPortableVersion = 1 as const;

export const portableManifestPath = '.evukb/manifest.json';
export const portableFilesPrefix = 'files/';

export type PortableExportNode = {
  id: string;
  path: string;
  name: string;
  contentHash: string;
  mimeType: string | null;
  metadata: Record<string, unknown>;
  sourceType: NodeSourceType;
};

export type PortableExportLink = {
  fromNodeId: string;
  toNodeId: string | null;
  linkKind: LinkKind;
  raw: string;
  targetPath: string | null;
  externalUrl: string | null;
  resolved: boolean;
  metadata: Record<string, unknown>;
};

export type EvuKbPortableManifestV1 = {
  format: typeof evuKbPortableFormat;
  version: typeof evuKbPortableVersion;
  exportedAt: string;
  corpus: {
    name: string;
    settings: Record<string, unknown>;
  };
  nodes: PortableExportNode[];
  links: PortableExportLink[];
  checksums: Record<string, string>;
};

export type PortableImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  linksRestored: number;
  indexed: number;
  warnings: string[];
  errors: string[];
};

export function portableSourceRef(relativePath: string): string {
  return `evukb-portable:${relativePath}`;
}

export function portableFileZipPath(relativePath: string): string {
  return `${portableFilesPrefix}${relativePath}`;
}
