import { describe, expect, it } from 'vitest';

import { parseSseEvents } from '../src/sse.js';

describe('parseSseEvents', () => {
  it('parses named SSE events with JSON payloads', () => {
    const payload = 'event: ask\ndata: {"type":"token","delta":"Hi"}\n\n';
    const events = parseSseEvents(payload, 'ask');
    expect(events).toEqual([{ event: 'ask', data: '{"type":"token","delta":"Hi"}' }]);
  });

  it('parses corpus index SSE events', () => {
    const payload =
      'event: index\ndata: {"kind":"node_status","nodeId":"node-1","indexStatus":"indexed","previousIndexStatus":"indexing","at":"2026-01-01T00:00:00.000Z"}\n\n';
    const events = parseSseEvents(payload, 'index');
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]?.data ?? '{}')).toMatchObject({
      nodeId: 'node-1',
      indexStatus: 'indexed',
    });
  });
});
