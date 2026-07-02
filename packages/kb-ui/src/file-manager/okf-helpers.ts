import {
  isOkfCorpus,
  mergeOkfFrontmatterBoilerplate,
  validateOkfMarkdownSource,
} from '@evu/kb-core/okf/browser';

type ValidationIssue = {
  code: string;
  severity?: string;
  message: string;
};

export function resolveFormatProfile(settings: Record<string, unknown>): 'generic' | 'okf' {
  return settings.formatProfile === 'okf' ? 'okf' : 'generic';
}

export function readValidationIssues(metadata: Record<string, unknown>): ValidationIssue[] {
  const issues = metadata.validationIssues;
  if (!Array.isArray(issues)) {
    return [];
  }
  return issues.filter(
    (issue): issue is ValidationIssue =>
      typeof issue === 'object' &&
      issue !== null &&
      typeof (issue as ValidationIssue).code === 'string' &&
      typeof (issue as ValidationIssue).message === 'string',
  );
}

export function nodeHasValidationIssues(metadata: Record<string, unknown>): boolean {
  if (metadata.okfConformant === false) {
    return true;
  }
  return readValidationIssues(metadata).length > 0;
}

export function collectEditorValidationMessages(args: {
  content: string;
  corpusSettings: Record<string, unknown>;
  fileName: string;
}): string[] {
  if (!isOkfCorpus(args.corpusSettings) || !args.fileName.toLowerCase().endsWith('.md')) {
    return [];
  }

  const validation = validateOkfMarkdownSource(args.corpusSettings, args.fileName, args.content);
  return validation?.validationIssues.map((issue) => issue.message) ?? [];
}

export function fixOkfFrontmatterBoilerplate(args: { content: string; filePath: string }): {
  changed: boolean;
  content: string;
} {
  return mergeOkfFrontmatterBoilerplate(args.content, args.filePath);
}
