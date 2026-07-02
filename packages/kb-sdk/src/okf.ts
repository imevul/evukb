export type OkfConvertResult = {
  dryRun: boolean;
  updated: number;
  skipped: number;
  warnings: string[];
  readOnlyBlocked: string[];
};

export type ConvertToOkfRequest = {
  dryRun?: boolean;
  synthesizeIndex?: boolean;
};

export type OkfReadIndexResult = {
  corpusId: string;
  directory: string;
  nodeId?: string;
  content: string | null;
  synthesized: boolean;
};

export type OkfConceptSummary = {
  nodeId: string;
  conceptId: string;
  path: string;
  type: string | null;
  title: string | null;
  tags: string[];
};

export type OkfListConceptsResult = {
  corpusId: string;
  concepts: OkfConceptSummary[];
  limit: number;
  offset: number;
};
