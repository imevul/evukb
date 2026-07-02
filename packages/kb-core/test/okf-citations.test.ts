import { describe, expect, it } from 'vitest';

import { evaluateCitationUrlPolicy } from '../src/okf/citation-policy.js';
import {
  extractCitationUrls,
  extractOkfCitationsSection,
  extractOkfCitationUrlsFromBody,
} from '../src/okf/citations.js';

describe('extractOkfCitationsSection', () => {
  it('extracts the citations section until the next heading', () => {
    const body = [
      '# Concept',
      '',
      'Body text.',
      '',
      '## Citations',
      '',
      '- [Example](https://example.com/doc)',
      '',
      '## See also',
      '',
      '- [[other]]',
    ].join('\n');

    expect(extractOkfCitationsSection(body)).toBe('- [Example](https://example.com/doc)');
  });

  it('returns null when no citations heading exists', () => {
    expect(extractOkfCitationsSection('# Title\n\nNo citations here.')).toBeNull();
  });
});

describe('extractCitationUrls', () => {
  it('collects markdown, autolink, and bare URLs', () => {
    const section = [
      '- [Doc](https://example.com/doc)',
      '- <https://example.org/page>',
      'See https://example.net/reference',
    ].join('\n');

    expect(extractCitationUrls(section)).toEqual([
      'https://example.com/doc',
      'https://example.org/page',
      'https://example.net/reference',
    ]);
  });
});

describe('extractOkfCitationUrlsFromBody', () => {
  it('returns URLs only from the citations section', () => {
    const body = [
      '# Concept',
      '',
      'Reference https://ignored.example/not-in-section',
      '',
      '## Citations',
      '',
      '- [Allowed](https://allowed.example/ok)',
    ].join('\n');

    expect(extractOkfCitationUrlsFromBody(body)).toEqual(['https://allowed.example/ok']);
  });
});

describe('evaluateCitationUrlPolicy', () => {
  it('allows public https URLs', () => {
    expect(evaluateCitationUrlPolicy('https://example.com/doc')).toEqual({ allowed: true });
  });

  it('blocks localhost and private IP literals', () => {
    expect(evaluateCitationUrlPolicy('http://127.0.0.1/secret').allowed).toBe(false);
    expect(evaluateCitationUrlPolicy('http://192.168.1.10/internal').allowed).toBe(false);
    expect(evaluateCitationUrlPolicy('http://localhost/admin').allowed).toBe(false);
  });

  it('blocks non-http schemes and invalid URLs', () => {
    expect(evaluateCitationUrlPolicy('file:///etc/passwd').allowed).toBe(false);
    expect(evaluateCitationUrlPolicy('not-a-url').allowed).toBe(false);
  });
});
