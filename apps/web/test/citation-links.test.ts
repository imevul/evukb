import { describe, expect, it } from 'vitest';

import { isSafeCitationUrl } from '../src/citation-links.js';

describe('isSafeCitationUrl', () => {
  it('allows http and https URLs', () => {
    expect(isSafeCitationUrl('https://example.com/doc')).toBe(true);
    expect(isSafeCitationUrl('http://internal.host/page?a=1')).toBe(true);
  });

  it('rejects non-http protocols and malformed URLs', () => {
    expect(isSafeCitationUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeCitationUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeCitationUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeCitationUrl('vbscript:msgbox')).toBe(false);
    expect(isSafeCitationUrl('not a url')).toBe(false);
    expect(isSafeCitationUrl('')).toBe(false);
  });
});
