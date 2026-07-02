import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../src/markdown/frontmatter.js';
import {
  buildSynthesizedIndexBody,
  inferOkfType,
  injectOkfTypeIntoMarkdown,
  mergeOkfFrontmatterBoilerplate,
  serializeFrontmatter,
  synthesizeMissingIndexes,
} from '../src/okf/index.js';

describe('inferOkfType', () => {
  it('maps path heuristics to OKF types', () => {
    expect(inferOkfType('docs/runbook.md')).toBe('Playbook');
    expect(inferOkfType('metrics/latency.md')).toBe('Metric');
    expect(inferOkfType('api/users.md')).toBe('API Endpoint');
    expect(inferOkfType('notes/topic.md')).toBe('Document');
  });
});

describe('serializeFrontmatter', () => {
  it('round-trips simple frontmatter with body', () => {
    const body = '# Title\n\nBody text.\n';
    const serialized = serializeFrontmatter({ type: 'Document', title: 'Title' }, body);
    const parsed = parseFrontmatter(serialized);
    expect(parsed.parsed.type).toBe('Document');
    expect(parsed.parsed.title).toBe('Title');
    expect(parsed.body.trim()).toBe(body.trim());
  });

  it('inserts a blank line after the closing frontmatter fence', () => {
    const serialized = serializeFrontmatter({ type: 'Document' }, '# Title\n');
    expect(serialized).toBe('---\ntype: Document\n---\n\n# Title\n');
  });
});

describe('injectOkfTypeIntoMarkdown', () => {
  it('adds type frontmatter to markdown without existing frontmatter', () => {
    const source = '# Concept\n\nBody.\n';
    const parsed = parseFrontmatter(source);
    const next = injectOkfTypeIntoMarkdown(
      source,
      'concept.md',
      parsed.parsed,
      parsed.body,
      parsed.raw.length > 0,
    );
    const reparsed = parseFrontmatter(next);
    expect(reparsed.parsed.type).toBe('Document');
  });
});

describe('mergeOkfFrontmatterBoilerplate', () => {
  it('adds missing type and title without overwriting existing frontmatter', () => {
    const source = '# Concept\n\nBody.\n';
    const result = mergeOkfFrontmatterBoilerplate(source, 'notes/concept.md');
    expect(result.changed).toBe(true);
    const parsed = parseFrontmatter(result.content);
    expect(parsed.parsed.type).toBe('Document');
    expect(parsed.parsed.title).toBe('Concept');
    expect(parsed.body.trim()).toBe(source.trim());
    expect(result.content).toContain('---\n\n# Concept');
  });

  it('preserves existing type and title values', () => {
    const source = `---
type: Playbook
title: Existing
---
# Body
`;
    const result = mergeOkfFrontmatterBoilerplate(source, 'runbook.md');
    expect(result.changed).toBe(false);
    expect(result.content).toBe(source);
  });

  it('fills only missing type when title is already set', () => {
    const source = `---
title: Existing
---
# Body
`;
    const result = mergeOkfFrontmatterBoilerplate(source, 'notes.md');
    expect(result.changed).toBe(true);
    const parsed = parseFrontmatter(result.content);
    expect(parsed.parsed.type).toBe('Document');
    expect(parsed.parsed.title).toBe('Existing');
  });

  it('adds the OKF log heading when missing', () => {
    const source = '## Entry\n\nUpdated files.\n';
    const result = mergeOkfFrontmatterBoilerplate(source, 'log.md');
    expect(result.changed).toBe(true);
    expect(result.content.startsWith('# Directory Update Log')).toBe(true);
  });
});

describe('synthesizeMissingIndexes', () => {
  it('builds index bodies for folders with concepts but no index.md', () => {
    const indexes = synthesizeMissingIndexes([
      { path: '', name: 'alpha.md', content: '# Alpha\n' },
      { path: 'team', name: 'beta.md', content: '---\ntitle: Beta\n---\n\n# Beta\n' },
    ]);
    expect(indexes).toHaveLength(2);
    expect(indexes[0]?.folderPath).toBe('');
    expect(indexes[0]?.body).toContain('# Index');
    expect(indexes[0]?.body).toContain('alpha.md');
    expect(indexes[1]?.folderPath).toBe('team');
  });

  it('builds synthesized index markdown with auto markers', () => {
    const body = buildSynthesizedIndexBody(
      [{ name: 'alpha.md', title: 'Alpha', description: null }],
      [{ name: 'team', title: 'team' }],
    );
    expect(body).toContain('OKF_INDEX:AUTO:BEGIN');
    expect(body).toContain('[Alpha](./alpha.md)');
  });
});
