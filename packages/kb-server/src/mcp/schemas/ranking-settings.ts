import { z } from 'zod';

export const rankingSettingsSchema = z.object({
  keywordWeight: z.number().optional(),
  semanticWeight: z.number().optional(),
  recencyBoost: z.number().optional(),
  okfCitationBoost: z.number().optional(),
  exactTitleBoost: z.number().optional(),
  exactPathBoost: z.number().optional(),
  pathBoosts: z.record(z.string(), z.number()).optional(),
});
