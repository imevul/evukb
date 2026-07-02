import { describe, expect, it } from 'vitest';

import { classifyOkfFile, OKF_VALIDATION_CODES, validateOkfV01 } from '../src/okf/index.js';
import {
  isOkfCorpus,
  parseCorpusSettings,
  resolveFormatProfile,
  validateCorpusSettings,
} from '../src/okf/settings.js';

describe('classifyOkfFile', () => {
  it('classifies reserved names', () => {
    expect(classifyOkfFile('index.md')).toBe('index');
    expect(classifyOkfFile('log.md')).toBe('log');
    expect(classifyOkfFile('concept.md')).toBe('concept');
    expect(classifyOkfFile('readme.txt')).toBe('non_md');
  });
});

describe('validateOkfV01', () => {
  it('requires type on concept files', () => {
    const result = validateOkfV01({
      fileName: 'foo.md',
      hasFrontmatter: true,
      frontmatterParseError: null,
      parsed: {},
    });
    expect(result.conformant).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === OKF_VALIDATION_CODES.OKF_MISSING_TYPE),
    ).toBe(true);
  });

  it('passes concept with type', () => {
    const result = validateOkfV01({
      fileName: 'foo.md',
      hasFrontmatter: true,
      frontmatterParseError: null,
      parsed: { type: 'Document' },
    });
    expect(result.conformant).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('warns when index.md has frontmatter', () => {
    const result = validateOkfV01({
      fileName: 'index.md',
      hasFrontmatter: true,
      frontmatterParseError: null,
      parsed: { title: 'Index' },
    });
    expect(
      result.issues.some((issue) => issue.code === OKF_VALIDATION_CODES.OKF_INDEX_FRONTMATTER),
    ).toBe(true);
  });

  it('warns when log.md is missing the required heading', () => {
    const result = validateOkfV01({
      fileName: 'log.md',
      hasFrontmatter: false,
      frontmatterParseError: null,
      parsed: {},
      body: '# Updates\n',
    });
    expect(result.issues.some((issue) => issue.code === OKF_VALIDATION_CODES.OKF_LOG_HEADING)).toBe(
      true,
    );
  });

  it('records frontmatter parse errors on concept files', () => {
    const result = validateOkfV01({
      fileName: 'foo.md',
      hasFrontmatter: true,
      frontmatterParseError: 'Invalid YAML',
      parsed: {},
    });
    expect(result.conformant).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === OKF_VALIDATION_CODES.FRONTMATTER_PARSE),
    ).toBe(true);
  });
});

describe('corpus settings helpers', () => {
  it('defaults to generic format profile', () => {
    expect(resolveFormatProfile({})).toBe('generic');
    expect(isOkfCorpus({})).toBe(false);
  });

  it('parses OKF corpus settings', () => {
    expect(parseCorpusSettings({ formatProfile: 'okf', okfStrict: true })).toEqual({
      formatProfile: 'okf',
      okfStrict: true,
    });
    expect(isOkfCorpus({ formatProfile: 'okf' })).toBe(true);
  });

  it('validates corpus settings values', () => {
    expect(validateCorpusSettings({ formatProfile: 'okf' })).toBeNull();
    expect(validateCorpusSettings({ formatProfile: 'invalid' })).toContain('formatProfile');
  });
});
