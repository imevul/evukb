import { parseFrontmatter, serializeFrontmatter } from '@evu/kb-core/okf/browser';

export type FrontmatterFields = Record<string, string>;

export type FrontmatterEntry = {
  key: string;
  value: string;
};

export function frontmatterFieldsToEntries(fields: FrontmatterFields): FrontmatterEntry[] {
  return Object.entries(fields).map(([key, value]) => ({ key, value }));
}

export function entriesToFrontmatterFields(entries: FrontmatterEntry[]): FrontmatterFields {
  const fields: FrontmatterFields = {};
  for (const { key, value } of entries) {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      continue;
    }
    fields[trimmedKey] = value;
  }
  return fields;
}

export function applyFrontmatterEntries(source: string, entries: FrontmatterEntry[]): string {
  return applyFrontmatterFields(source, entriesToFrontmatterFields(entries));
}

export function reorderFrontmatterEntries(
  entries: FrontmatterEntry[],
  fromIndex: number,
  toIndex: number,
): FrontmatterEntry[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= entries.length) {
    return entries;
  }
  const next = [...entries];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return entries;
  }
  const clampedTo = Math.max(0, Math.min(toIndex, next.length));
  next.splice(clampedTo, 0, moved);
  return next;
}

export function splitMarkdownFrontmatter(source: string): {
  fields: FrontmatterFields;
  body: string;
  hasFrontmatter: boolean;
} {
  const parsed = parseFrontmatter(source);
  const fields: FrontmatterFields = {};
  for (const [key, value] of Object.entries(parsed.parsed)) {
    if (value === null || value === undefined) {
      fields[key] = '';
    } else if (typeof value === 'object') {
      fields[key] = JSON.stringify(value);
    } else {
      fields[key] = String(value);
    }
  }
  return {
    fields,
    body: parsed.body,
    hasFrontmatter: parsed.raw.length > 0,
  };
}

export function mergeMarkdownFrontmatter(fields: FrontmatterFields, body: string): string {
  const parsed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      continue;
    }
    parsed[trimmedKey] = value;
  }
  if (Object.keys(parsed).length === 0) {
    return body;
  }
  return serializeFrontmatter(parsed, body);
}

export function updateFrontmatterField(
  fields: FrontmatterFields,
  key: string,
  value: string,
): FrontmatterFields {
  const next = { ...fields };
  if (!key.trim()) {
    return next;
  }
  next[key] = value;
  return next;
}

export function removeFrontmatterField(fields: FrontmatterFields, key: string): FrontmatterFields {
  const next = { ...fields };
  delete next[key];
  return next;
}

export function applyFrontmatterFields(source: string, fields: FrontmatterFields): string {
  const { body } = splitMarkdownFrontmatter(source);
  return mergeMarkdownFrontmatter(fields, body);
}
