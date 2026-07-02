export type PortableImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  linksRestored: number;
  indexed: number;
  warnings: string[];
  errors: string[];
};

export type CorpusArchiveImportResult = PortableImportResult & {
  mode: 'portable' | 'archive';
};
