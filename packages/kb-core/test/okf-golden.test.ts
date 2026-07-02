import { describe, expect, it } from 'vitest';

import { classifyOkfFile, validateOkfV01 } from '../src/okf/index.js';
import { okfClassifyGoldenCases, okfValidateGoldenCases } from './fixtures/okf-golden.js';

describe('okf golden fixtures', () => {
  for (const goldenCase of okfClassifyGoldenCases) {
    it(`classifies ${goldenCase.id}`, () => {
      expect(classifyOkfFile(goldenCase.fileName)).toBe(goldenCase.expectedRole);
    });
  }

  for (const goldenCase of okfValidateGoldenCases) {
    it(`validates ${goldenCase.id}`, () => {
      const result = validateOkfV01(goldenCase.input);
      expect(result.conformant).toBe(goldenCase.expectedConformant);
      expect(result.issues.map((issue) => issue.code)).toEqual(goldenCase.expectedIssueCodes);
    });
  }
});
