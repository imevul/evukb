import type { PortableImportResult } from '../portable/types.js';

export type ArchiveImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  indexed: number;
  warnings: string[];
  errors: string[];
};

export type CorpusArchiveImportResult = PortableImportResult & {
  mode: 'portable' | 'archive';
};
