import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { kbReadActions } from '@evu/kb-core';
import { describe, expect, it } from 'vitest';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/integration');

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtureDir, name), 'utf8')) as T;
}

describe('integration fixtures', () => {
  it('uses valid kb read actions in tools/kb request fixtures', () => {
    const listCorpora = readFixture<{ action: string }>('tools-kb-list-corpora.request.json');
    const search = readFixture<{ action: string }>('tools-kb-search.request.json');
    const ask = readFixture<{ action: string }>('tools-kb-ask.request.json');
    const inventory = readFixture<{ action: string }>(
      'tools-kb-list-documents-inventory.request.json',
    );
    const metadataSearch = readFixture<{ action: string }>(
      'tools-kb-search-metadata-only.request.json',
    );

    expect(kbReadActions).toContain(listCorpora.action);
    expect(kbReadActions).toContain(search.action);
    expect(kbReadActions).toContain(ask.action);
    expect(kbReadActions).toContain(inventory.action);
    expect(kbReadActions).toContain(metadataSearch.action);
  });

  it('uses the MCP search tool name in the JSON-RPC fixture', () => {
    const payload = readFixture<{
      method: string;
      params: { name: string; arguments: Record<string, unknown> };
    }>('mcp-tools-call-search.request.json');

    expect(payload.method).toBe('tools/call');
    expect(payload.params.name).toBe('evu.kb.search');
    expect(payload.params.arguments.query).toBe('alpha fixture');
  });
});
