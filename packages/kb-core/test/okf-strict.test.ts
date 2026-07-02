import { describe, expect, it } from 'vitest';

import {
  formatOkfStrictSaveError,
  isOkfStrictEnabled,
  okfStrictSaveBlocked,
} from '../src/okf/strict.js';
import { OKF_VALIDATION_CODES } from '../src/okf/types.js';

describe('okfStrict', () => {
  it('detects strict mode on OKF corpora only', () => {
    expect(isOkfStrictEnabled({ formatProfile: 'okf', okfStrict: true })).toBe(true);
    expect(isOkfStrictEnabled({ formatProfile: 'okf' })).toBe(false);
    expect(isOkfStrictEnabled({ formatProfile: 'generic', okfStrict: true })).toBe(false);
  });

  it('blocks saves when non-conformant under strict mode', () => {
    expect(
      okfStrictSaveBlocked(
        { formatProfile: 'okf', okfStrict: true },
        {
          okfConformant: false,
          validationIssues: [
            {
              code: OKF_VALIDATION_CODES.OKF_MISSING_TYPE,
              severity: 'warning',
              message: 'missing type',
            },
          ],
          okfWarnings: ['missing type'],
        },
      ),
    ).toBe(true);
  });

  it('blocks saves on error-severity issues under strict mode', () => {
    expect(
      okfStrictSaveBlocked(
        { formatProfile: 'okf', okfStrict: true },
        {
          okfConformant: true,
          validationIssues: [
            {
              code: OKF_VALIDATION_CODES.FRONTMATTER_PARSE,
              severity: 'error',
              message: 'bad yaml',
            },
          ],
          okfWarnings: ['bad yaml'],
        },
      ),
    ).toBe(true);
  });

  it('allows warn-only issues when strict is off', () => {
    expect(
      okfStrictSaveBlocked(
        { formatProfile: 'okf' },
        {
          okfConformant: false,
          validationIssues: [
            {
              code: OKF_VALIDATION_CODES.OKF_MISSING_TYPE,
              severity: 'warning',
              message: 'missing type',
            },
          ],
          okfWarnings: ['missing type'],
        },
      ),
    ).toBe(false);
  });

  it('formats validation errors for API responses', () => {
    expect(
      formatOkfStrictSaveError([
        { code: 'okf.missing_type', severity: 'warning', message: 'missing type' },
      ]),
    ).toContain('missing type');
  });
});
