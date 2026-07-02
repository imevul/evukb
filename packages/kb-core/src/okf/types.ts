export type KnowledgeValidationSeverity = 'warning' | 'error';

export type KnowledgeValidationIssue = {
  code: string;
  severity: KnowledgeValidationSeverity;
  message: string;
};

export const OKF_VALIDATION_CODES = {
  FRONTMATTER_PARSE: 'frontmatter.parse_error',
  OKF_MISSING_TYPE: 'okf.missing_type',
  OKF_INDEX_FRONTMATTER: 'okf.index_has_frontmatter',
  OKF_LOG_HEADING: 'okf.log_missing_heading',
  OKF_CITATION_BLOCKED: 'okf.citation_blocked',
  OKF_CITATION_INVALID_URL: 'okf.citation_invalid_url',
  OKF_CITATION_UNREACHABLE: 'okf.citation_unreachable',
} as const;

export type CitationValidationStatus = 'valid' | 'blocked' | 'invalid' | 'unreachable';

export type CitationValidationEntry = {
  url: string;
  status: CitationValidationStatus;
  httpStatus?: number;
  message?: string;
};

export type CitationValidationMetadata = {
  validatedAt: string;
  entries: CitationValidationEntry[];
};

export type OkfValidationCode = (typeof OKF_VALIDATION_CODES)[keyof typeof OKF_VALIDATION_CODES];

export type OkfFileRole = 'concept' | 'index' | 'log' | 'non_md';

export type OkfValidationInput = {
  fileName: string;
  hasFrontmatter: boolean;
  frontmatterParseError: string | null;
  parsed: Record<string, unknown>;
  body?: string;
};

export type OkfValidationResult = {
  conformant: boolean;
  issues: KnowledgeValidationIssue[];
};

export const OKF_SPEC_URL =
  'https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md';
