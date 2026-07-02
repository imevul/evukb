import {
  type KnowledgeValidationIssue,
  OKF_VALIDATION_CODES,
  type OkfFileRole,
  type OkfValidationInput,
  type OkfValidationResult,
} from './types.js';

export function classifyOkfFile(fileName: string): OkfFileRole {
  const lower = fileName.toLowerCase();
  if (lower === 'index.md') {
    return 'index';
  }
  if (lower === 'log.md') {
    return 'log';
  }
  if (lower.endsWith('.md')) {
    return 'concept';
  }
  return 'non_md';
}

export function validateOkfV01(input: OkfValidationInput): OkfValidationResult {
  const issues: KnowledgeValidationIssue[] = [];
  const role = classifyOkfFile(input.fileName);

  if (role === 'index' && input.hasFrontmatter) {
    issues.push({
      code: OKF_VALIDATION_CODES.OKF_INDEX_FRONTMATTER,
      severity: 'warning',
      message:
        'OKF index.md should not contain frontmatter (except optional okf_version at bundle root)',
    });
  }

  if (role === 'log' && input.body !== undefined) {
    if (!input.body.includes('# Directory Update Log')) {
      issues.push({
        code: OKF_VALIDATION_CODES.OKF_LOG_HEADING,
        severity: 'warning',
        message: 'OKF log.md should start with a # Directory Update Log heading',
      });
    }
  }

  if (role === 'concept') {
    if (input.frontmatterParseError) {
      issues.push({
        code: OKF_VALIDATION_CODES.FRONTMATTER_PARSE,
        severity: 'error',
        message: input.frontmatterParseError,
      });
    }
    const typeVal = input.parsed.type;
    if (typeof typeVal !== 'string' || typeVal.trim().length === 0) {
      issues.push({
        code: OKF_VALIDATION_CODES.OKF_MISSING_TYPE,
        severity: 'warning',
        message: 'OKF concept documents require a non-empty type field in frontmatter',
      });
    }
  }

  const conformant = !issues.some(
    (issue) => issue.severity === 'error' || issue.code === OKF_VALIDATION_CODES.OKF_MISSING_TYPE,
  );

  return { conformant, issues };
}
