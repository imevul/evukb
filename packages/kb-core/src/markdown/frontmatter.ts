import type { MarkdownParseError, ParsedFrontmatter } from './types.js';

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseSimpleYaml(input: string): {
  parsed: Record<string, unknown>;
  errors: MarkdownParseError[];
} {
  const parsed: Record<string, unknown> = {};
  const errors: MarkdownParseError[] = [];
  let currentKey: string | null = null;

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('- ') && currentKey) {
      const existing = parsed[currentKey];
      const value = trimmed.slice(2).trim();
      if (Array.isArray(existing)) {
        existing.push(parseScalar(value));
      } else {
        parsed[currentKey] = [parseScalar(value)];
      }
      continue;
    }

    const match = /^([^:]+):\s*(.*)$/.exec(trimmed);
    if (!match) {
      errors.push({
        code: 'invalid_yaml_line',
        message: `Could not parse frontmatter line: ${line}`,
      });
      continue;
    }

    const key = match[1]?.trim() ?? '';
    const rawValue = match[2]?.trim() ?? '';
    currentKey = key;
    parsed[key] = parseScalar(rawValue);
  }

  return { parsed, errors };
}

function parseScalar(value: string): unknown {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (value === 'null' || value === '~') {
    return null;
  }
  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return Number.parseFloat(value);
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((part) => parseScalar(part.trim()))
      .filter((part) => part !== '');
  }
  return value;
}

export function parseFrontmatter(source: string): ParsedFrontmatter {
  const match = frontmatterPattern.exec(source);
  if (!match) {
    return {
      raw: '',
      parsed: {},
      body: source,
      errors: [],
    };
  }

  const raw = match[1] ?? '';
  const body = match[2] ?? '';
  const { parsed, errors } = parseSimpleYaml(raw);
  return {
    raw,
    parsed,
    body,
    errors,
  };
}
