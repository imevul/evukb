import {
  applyFrontmatterFields,
  mergeMarkdownFrontmatter,
  splitMarkdownFrontmatter,
  updateFrontmatterField,
} from '@evu/kb-ui';
import { describe, expect, it } from 'vitest';

describe('frontmatter-sync', () => {
  it('round-trips scalar frontmatter fields with the markdown body', () => {
    const source = '---\ntitle: Alpha\ntags: beta\n---\n\n# Heading\n\nBody text.\n';
    const split = splitMarkdownFrontmatter(source);
    expect(split.fields).toEqual({ title: 'Alpha', tags: 'beta' });
    expect(split.body).toBe('\n# Heading\n\nBody text.\n');

    const updated = applyFrontmatterFields(
      source,
      updateFrontmatterField(split.fields, 'title', 'Updated'),
    );
    expect(updated).toContain('title: Updated');
    expect(updated).toContain('# Heading');
  });

  it('merges fields back into markdown when body has no frontmatter', () => {
    const merged = mergeMarkdownFrontmatter({ status: 'draft' }, '# Title\n');
    expect(merged).toBe('---\nstatus: draft\n---\n\n# Title\n');
  });
});
