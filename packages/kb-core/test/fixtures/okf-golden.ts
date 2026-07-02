import type { OkfFileRole, OkfValidationInput } from '../../src/okf/types.js';
import { OKF_VALIDATION_CODES } from '../../src/okf/types.js';

export type OkfClassifyGoldenCase = {
  id: string;
  fileName: string;
  expectedRole: OkfFileRole;
};

export type OkfValidateGoldenCase = {
  id: string;
  input: OkfValidationInput;
  expectedConformant: boolean;
  expectedIssueCodes: string[];
};

export const okfClassifyGoldenCases: OkfClassifyGoldenCase[] = [
  { id: 'index-md', fileName: 'index.md', expectedRole: 'index' },
  { id: 'log-md', fileName: 'log.md', expectedRole: 'log' },
  { id: 'concept-md', fileName: 'concept.md', expectedRole: 'concept' },
  { id: 'non-md', fileName: 'readme.txt', expectedRole: 'non_md' },
];

export const okfValidateGoldenCases: OkfValidateGoldenCase[] = [
  {
    id: 'concept-missing-type',
    input: {
      fileName: 'foo.md',
      hasFrontmatter: true,
      frontmatterParseError: null,
      parsed: {},
    },
    expectedConformant: false,
    expectedIssueCodes: [OKF_VALIDATION_CODES.OKF_MISSING_TYPE],
  },
  {
    id: 'concept-with-type',
    input: {
      fileName: 'foo.md',
      hasFrontmatter: true,
      frontmatterParseError: null,
      parsed: { type: 'Document' },
    },
    expectedConformant: true,
    expectedIssueCodes: [],
  },
  {
    id: 'index-with-frontmatter-warning',
    input: {
      fileName: 'index.md',
      hasFrontmatter: true,
      frontmatterParseError: null,
      parsed: { title: 'Index' },
    },
    expectedConformant: true,
    expectedIssueCodes: [OKF_VALIDATION_CODES.OKF_INDEX_FRONTMATTER],
  },
];
