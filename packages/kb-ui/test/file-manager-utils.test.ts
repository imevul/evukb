import { describe, expect, it } from 'vitest';

import {
  buildFileTreeBreadcrumbs,
  buildFileTreeListEntries,
  formatFileTreeBytes,
  isInvalidMoveTarget,
  nodeFolderPath,
} from '../src/file-manager-utils.js';

describe('file manager utils', () => {
  const nodes = [
    {
      id: 'root-folder',
      parentId: null,
      name: 'docs',
      path: '',
      nodeType: 'folder' as const,
      fullPath: 'docs',
    },
    {
      id: 'nested',
      parentId: 'root-folder',
      name: 'guide.md',
      path: 'docs',
      nodeType: 'file' as const,
      fullPath: 'docs/guide.md',
    },
  ];

  it('builds breadcrumbs from parent chain', () => {
    expect(buildFileTreeBreadcrumbs(nodes, 'root-folder')).toEqual([
      { id: null, label: 'Root' },
      { id: 'root-folder', label: 'docs' },
    ]);
  });

  const rootFolder = nodes[0];
  if (!rootFolder) {
    throw new Error('expected fixture node');
  }

  it('builds list entries with parent row', () => {
    expect(
      buildFileTreeListEntries({
        folderChildren: [rootFolder],
        showParentRow: true,
      }),
    ).toEqual([{ kind: 'parent' }, { kind: 'node', node: rootFolder, selectableIndex: 0 }]);
  });

  it('blocks invalid move targets', () => {
    expect(isInvalidMoveTarget(nodes, 'root-folder', 'root-folder')).toBe(true);
    expect(isInvalidMoveTarget(nodes, 'root-folder', null)).toBe(false);
  });

  it('formats byte sizes with binary units', () => {
    expect(formatFileTreeBytes(undefined)).toBe('—');
    expect(formatFileTreeBytes(0)).toBe('0 B');
    expect(formatFileTreeBytes(512)).toBe('512 B');
    expect(formatFileTreeBytes(1536)).toBe('1.5 KiB');
    expect(formatFileTreeBytes(1024 * 1024)).toBe('1 MiB');
    expect(formatFileTreeBytes(5 * 1024 * 1024)).toBe('5 MiB');
  });

  it('formats node folder paths', () => {
    expect(nodeFolderPath({ path: 'docs', name: 'guide.md' })).toBe('docs/guide.md');
    expect(nodeFolderPath({ path: '', name: 'docs' })).toBe('docs');
  });
});
