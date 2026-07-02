import { parseFrontmatter } from '../markdown/frontmatter.js';
import { classifyOkfFile } from './validate.js';

export type OkfConvertResult = {
  dryRun: boolean;
  updated: number;
  skipped: number;
  warnings: string[];
  readOnlyBlocked: string[];
};

export type ConvertCorpusToOkfOptions = {
  dryRun?: boolean;
  synthesizeIndex?: boolean;
};

export function inferOkfType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes('runbook') || lower.includes('playbook')) {
    return 'Playbook';
  }
  if (lower.includes('metric')) {
    return 'Metric';
  }
  if (lower.includes('api')) {
    return 'API Endpoint';
  }
  return 'Document';
}

function stringifyYamlValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    return value.map((entry) => `- ${stringifyYamlValue(entry)}`).join('\n');
  }
  if (typeof value === 'string') {
    if (/[:#{}[\],&*?|>-]/.test(value) || value.trim() !== value) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return JSON.stringify(value);
}

export function serializeFrontmatter(parsed: Record<string, unknown>, body: string): string {
  const lines = Object.entries(parsed).map(
    ([key, value]) => `${key}: ${stringifyYamlValue(value)}`,
  );
  const yamlBody = lines.join('\n');
  const trimmedBody = body.replace(/^\n+/, '');
  return `---\n${yamlBody}\n---\n\n${trimmedBody}`;
}

export function injectOkfTypeIntoMarkdown(
  source: string,
  filePath: string,
  parsed: Record<string, unknown>,
  body: string,
  hasFrontmatter: boolean,
): string {
  const nextParsed = { ...parsed, type: inferOkfType(filePath) };
  if (hasFrontmatter || Object.keys(parsed).length > 0) {
    return serializeFrontmatter(nextParsed, body);
  }
  return serializeFrontmatter(nextParsed, source);
}

function isEmptyFrontmatterValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  return false;
}

function inferOkfTitleFromBody(body: string, fileName: string): string {
  const headingMatch = /^#\s+(.+)$/m.exec(body);
  if (headingMatch?.[1]?.trim()) {
    return headingMatch[1].trim();
  }
  return fileName.replace(/\.md$/i, '');
}

export type MergeOkfFrontmatterBoilerplateResult = {
  changed: boolean;
  content: string;
};

/** Add missing OKF boilerplate fields without overwriting existing frontmatter values. */
export function mergeOkfFrontmatterBoilerplate(
  source: string,
  filePath: string,
): MergeOkfFrontmatterBoilerplateResult {
  const fileName = filePath.split('/').pop() ?? filePath;
  const role = classifyOkfFile(fileName);
  if (role === 'non_md') {
    return { content: source, changed: false };
  }

  const frontmatter = parseFrontmatter(source);
  if (frontmatter.errors.length > 0) {
    return { content: source, changed: false };
  }

  if (role === 'log') {
    if (frontmatter.body.includes('# Directory Update Log')) {
      return { content: source, changed: false };
    }
    const trimmedBody = frontmatter.body.trimStart();
    const nextBody =
      trimmedBody.length > 0
        ? `# Directory Update Log\n\n${trimmedBody}`
        : '# Directory Update Log\n';
    const content =
      frontmatter.raw.length > 0 ? serializeFrontmatter(frontmatter.parsed, nextBody) : nextBody;
    return { content, changed: true };
  }

  if (role === 'index') {
    return { content: source, changed: false };
  }

  const nextParsed = { ...frontmatter.parsed };
  let changed = false;

  if (isEmptyFrontmatterValue(nextParsed.type)) {
    nextParsed.type = inferOkfType(filePath);
    changed = true;
  }

  if (isEmptyFrontmatterValue(nextParsed.title)) {
    nextParsed.title = inferOkfTitleFromBody(frontmatter.body, fileName);
    changed = true;
  }

  if (!changed) {
    return { content: source, changed: false };
  }

  const body = frontmatter.raw.length > 0 ? frontmatter.body : source;
  return { content: serializeFrontmatter(nextParsed, body), changed: true };
}
