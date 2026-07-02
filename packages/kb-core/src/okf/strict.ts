import type { OkfNodeMetadata } from './metadata.js';
import { isOkfCorpus } from './settings.js';
import type { KnowledgeValidationIssue } from './types.js';

export function isOkfStrictEnabled(settings: Record<string, unknown>): boolean {
  return isOkfCorpus(settings) && settings.okfStrict === true;
}

export function okfStrictSaveBlocked(
  settings: Record<string, unknown>,
  okfMetadata: OkfNodeMetadata | null,
): boolean {
  if (!isOkfStrictEnabled(settings) || !okfMetadata) {
    return false;
  }

  if (okfMetadata.okfConformant === false) {
    return true;
  }

  return okfMetadata.validationIssues.some((issue) => issue.severity === 'error');
}

export function formatOkfStrictSaveError(issues: KnowledgeValidationIssue[]): string {
  if (issues.length === 0) {
    return 'OKF strict mode blocked this save due to validation issues.';
  }
  const summary = issues.map((issue) => issue.message).join('; ');
  return `OKF strict mode blocked this save: ${summary}`;
}
