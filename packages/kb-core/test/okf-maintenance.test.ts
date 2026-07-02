import { describe, expect, it } from 'vitest';

import {
  mergeIndexIncremental,
  OKF_INDEX_AUTO_BEGIN,
  OKF_INDEX_AUTO_END,
  parseIndexSections,
} from '../src/okf/index-maintenance.js';
import {
  appendLogEntryToContent,
  buildInitialLogBody,
  formatLogEntry,
  OKF_LOG_HEADING,
} from '../src/okf/log-maintenance.js';

describe('mergeIndexIncremental', () => {
  const baseIndex = [
    '# Index',
    '',
    OKF_INDEX_AUTO_BEGIN,
    '- [Alpha](./alpha.md)',
    OKF_INDEX_AUTO_END,
    '',
  ].join('\n');

  it('adds a concept bullet on create', () => {
    const next = mergeIndexIncremental({
      content: baseIndex,
      event: {
        kind: 'create',
        fileName: 'beta.md',
        title: 'Beta',
        description: null,
      },
    });
    expect(next).toContain('[Beta](./beta.md)');
    expect(next).toContain('[Alpha](./alpha.md)');
  });

  it('removes a concept bullet on delete', () => {
    const next = mergeIndexIncremental({
      content: baseIndex,
      event: {
        kind: 'delete',
        fileName: 'alpha.md',
        title: 'Alpha',
        description: null,
      },
    });
    expect(next).not.toContain('alpha.md');
  });

  it('updates an existing bullet on update', () => {
    const next = mergeIndexIncremental({
      content: baseIndex,
      event: {
        kind: 'update',
        fileName: 'alpha.md',
        title: 'Alpha Revised',
        description: 'Updated',
      },
    });
    expect(next).toContain('[Alpha Revised](./alpha.md) — Updated');
  });
});

describe('parseIndexSections', () => {
  it('preserves prefix and suffix around auto markers', () => {
    const content = `# Custom intro

${OKF_INDEX_AUTO_BEGIN}
- [One](./one.md)
${OKF_INDEX_AUTO_END}

Footer note`;
    const sections = parseIndexSections(content);
    expect(sections.hadMarkers).toBe(true);
    expect(sections.prefix).toContain('Custom intro');
    expect(sections.autoBlock).toContain('one.md');
    expect(sections.suffix).toContain('Footer');
  });
});

describe('log maintenance', () => {
  it('formats and appends log entries under date headings', () => {
    const entry = formatLogEntry({
      kind: 'create',
      filePath: 'alpha.md',
      title: 'Alpha',
      actor: { kind: 'admin' },
    });
    const body = appendLogEntryToContent({
      content: buildInitialLogBody(),
      entryLine: entry,
      dateUtc: '2026-06-29',
    });
    expect(body.startsWith(OKF_LOG_HEADING)).toBe(true);
    expect(body).toContain('## 2026-06-29');
    expect(body).toContain('Added [Alpha](./alpha.md)');
  });
});
