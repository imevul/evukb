import { describe, expect, it } from 'vitest';
import {
  applyFrontmatterEntries,
  entriesToFrontmatterFields,
  reorderFrontmatterEntries,
} from '../src/file-manager/frontmatter-sync.js';

describe('frontmatter-sync entries', () => {
  it('preserves entry order when converting to fields', () => {
    const fields = entriesToFrontmatterFields([
      { key: 'z', value: '1' },
      { key: 'a', value: '2' },
    ]);
    expect(Object.keys(fields)).toEqual(['z', 'a']);
  });

  it('reorders entries', () => {
    const entries = [
      { key: 'title', value: 'A' },
      { key: 'type', value: 'Document' },
      { key: 'status', value: 'draft' },
    ];
    expect(reorderFrontmatterEntries(entries, 0, 2)).toEqual([
      { key: 'type', value: 'Document' },
      { key: 'status', value: 'draft' },
      { key: 'title', value: 'A' },
    ]);
  });

  it('applies ordered entries back to markdown', () => {
    const source = '---\ntitle: Old\n---\n\n# Body\n';
    const updated = applyFrontmatterEntries(source, [
      { key: 'type', value: 'Document' },
      { key: 'title', value: 'New' },
    ]);
    expect(updated.indexOf('type: Document')).toBeLessThan(updated.indexOf('title: New'));
    expect(updated).toContain('# Body');
  });
});
