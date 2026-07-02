import { parseFrontmatter } from '../markdown/frontmatter.js';
import type { ParsedFrontmatter } from '../markdown/types.js';
import { isOkfCorpus } from './settings.js';
import type {
  CitationValidationEntry,
  CitationValidationMetadata,
  KnowledgeValidationIssue,
} from './types.js';
import { OKF_VALIDATION_CODES } from './types.js';
import { validateOkfV01 } from './validate.js';

export type OkfNodeMetadata = {
  validationIssues: KnowledgeValidationIssue[];
  okfConformant: boolean;
  okfWarnings: string[];
};

export function validateOkfMarkdown(
  settings: Record<string, unknown>,
  fileName: string,
  frontmatter: ParsedFrontmatter,
): OkfNodeMetadata | null {
  if (!isOkfCorpus(settings)) {
    return null;
  }

  const frontmatterParseError = frontmatter.errors[0]?.message ?? null;
  const result = validateOkfV01({
    fileName,
    hasFrontmatter: frontmatter.raw.length > 0,
    frontmatterParseError,
    parsed: frontmatter.parsed,
    body: frontmatter.body,
  });

  return {
    validationIssues: result.issues,
    okfConformant: result.conformant,
    okfWarnings: result.issues.map((issue) => issue.message),
  };
}

export function validateOkfMarkdownSource(
  settings: Record<string, unknown>,
  fileName: string,
  source: string,
): OkfNodeMetadata | null {
  return validateOkfMarkdown(settings, fileName, parseFrontmatter(source));
}

export function mergeOkfNodeMetadata(
  existingMetadata: Record<string, unknown>,
  okf: OkfNodeMetadata | null,
  baseWarnings: string[] = [],
): Record<string, unknown> {
  const withoutOkf = stripOkfNodeMetadata(existingMetadata);
  if (!okf) {
    return {
      ...withoutOkf,
      indexWarnings: baseWarnings,
    };
  }

  return {
    ...withoutOkf,
    validationIssues: okf.validationIssues,
    okfConformant: okf.okfConformant,
    indexWarnings: [...baseWarnings, ...okf.okfWarnings],
  };
}

export function stripOkfNodeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const { validationIssues, okfConformant, citationValidation, ...rest } = metadata;
  return rest;
}

function citationIssuesFromEntries(entries: CitationValidationEntry[]): KnowledgeValidationIssue[] {
  const issues: KnowledgeValidationIssue[] = [];
  for (const entry of entries) {
    if (entry.status === 'valid') {
      continue;
    }
    if (entry.status === 'blocked') {
      issues.push({
        code: OKF_VALIDATION_CODES.OKF_CITATION_BLOCKED,
        severity: 'warning',
        message: entry.message ?? `Citation URL blocked: ${entry.url}`,
      });
      continue;
    }
    if (entry.status === 'invalid') {
      issues.push({
        code: OKF_VALIDATION_CODES.OKF_CITATION_INVALID_URL,
        severity: 'warning',
        message: entry.message ?? `Invalid citation URL: ${entry.url}`,
      });
      continue;
    }
    issues.push({
      code: OKF_VALIDATION_CODES.OKF_CITATION_UNREACHABLE,
      severity: 'warning',
      message: entry.message ?? `Citation URL unreachable: ${entry.url}`,
    });
  }
  return issues;
}

export function mergeCitationValidationMetadata(
  metadata: Record<string, unknown>,
  citationValidation: CitationValidationMetadata | null,
): Record<string, unknown> {
  const withoutCitation = { ...metadata };
  delete withoutCitation.citationValidation;

  if (!citationValidation) {
    return withoutCitation;
  }

  const existingIssues = Array.isArray(withoutCitation.validationIssues)
    ? (withoutCitation.validationIssues as KnowledgeValidationIssue[]).filter(
        (issue) =>
          issue.code !== OKF_VALIDATION_CODES.OKF_CITATION_BLOCKED &&
          issue.code !== OKF_VALIDATION_CODES.OKF_CITATION_INVALID_URL &&
          issue.code !== OKF_VALIDATION_CODES.OKF_CITATION_UNREACHABLE,
      )
    : [];

  const citationIssues = citationIssuesFromEntries(citationValidation.entries);
  const citationWarnings = citationIssues.map((issue) => issue.message);
  const baseWarnings = Array.isArray(withoutCitation.indexWarnings)
    ? (withoutCitation.indexWarnings as string[]).filter(
        (warning) =>
          !warning.includes('Citation URL blocked') &&
          !warning.includes('Invalid citation URL') &&
          !warning.includes('Citation URL unreachable'),
      )
    : [];

  return {
    ...withoutCitation,
    citationValidation,
    validationIssues: [...existingIssues, ...citationIssues],
    indexWarnings: [...baseWarnings, ...citationWarnings],
    okfConformant:
      typeof withoutCitation.okfConformant === 'boolean' ? withoutCitation.okfConformant : true,
  };
}

export function readCitationValidationMetadata(
  metadata: Record<string, unknown>,
): CitationValidationMetadata | null {
  const value = metadata.citationValidation;
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as CitationValidationMetadata;
  if (!Array.isArray(record.entries) || typeof record.validatedAt !== 'string') {
    return null;
  }
  return record;
}

export function countCitationValidationIssues(
  nodes: Array<{ metadata: Record<string, unknown> }>,
): number {
  return nodes.filter((node) => {
    const citation = readCitationValidationMetadata(node.metadata);
    return citation?.entries.some((entry) => entry.status !== 'valid') ?? false;
  }).length;
}

export function nodeHasValidationIssues(metadata: Record<string, unknown>): boolean {
  if (metadata.okfConformant === false) {
    return true;
  }
  const issues = metadata.validationIssues;
  if (Array.isArray(issues) && issues.length > 0) {
    return true;
  }
  const citation = readCitationValidationMetadata(metadata);
  return citation?.entries.some((entry) => entry.status !== 'valid') ?? false;
}

export function countOkfValidationIssues(
  nodes: Array<{ metadata: Record<string, unknown> }>,
): number {
  return nodes.filter((node) => nodeHasValidationIssues(node.metadata)).length;
}
