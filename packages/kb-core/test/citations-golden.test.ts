import { describe, expect, it } from 'vitest';

import { deriveAskCitations } from '../src/ask/index.js';
import { evaluateCitationUrlPolicy } from '../src/okf/citation-policy.js';
import {
  extractCitationUrls,
  extractOkfCitationsSection,
  extractOkfCitationUrlsFromBody,
} from '../src/okf/citations.js';
import {
  citationBodyUrlsGoldenCases,
  citationPolicyGoldenCases,
  citationSectionGoldenCases,
  citationUrlsGoldenCases,
  deriveAskCitationsGoldenCases,
} from './fixtures/citations-golden.js';

describe('citations golden fixtures', () => {
  for (const goldenCase of citationSectionGoldenCases) {
    it(`extracts citations section for ${goldenCase.id}`, () => {
      expect(extractOkfCitationsSection(goldenCase.body)).toBe(goldenCase.expectedSection);
    });
  }

  for (const goldenCase of citationUrlsGoldenCases) {
    it(`extracts citation URLs for ${goldenCase.id}`, () => {
      expect(extractCitationUrls(goldenCase.section)).toEqual(goldenCase.expectedUrls);
    });
  }

  for (const goldenCase of citationBodyUrlsGoldenCases) {
    it(`extracts body citation URLs for ${goldenCase.id}`, () => {
      expect(extractOkfCitationUrlsFromBody(goldenCase.body)).toEqual(goldenCase.expectedUrls);
    });
  }

  for (const goldenCase of citationPolicyGoldenCases) {
    it(`evaluates citation URL policy for ${goldenCase.id}`, () => {
      expect(evaluateCitationUrlPolicy(goldenCase.url).allowed).toBe(goldenCase.expectedAllowed);
    });
  }

  for (const goldenCase of deriveAskCitationsGoldenCases) {
    it(`derives ask citations for ${goldenCase.id}`, () => {
      expect(deriveAskCitations(goldenCase.chunks)).toEqual(goldenCase.expectedCitations);
    });
  }
});
