import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildOpenApiDocument } from './openapi/index.js';

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../kb-sdk/openapi/evukb.openapi.json',
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`, 'utf8');
console.info(`Wrote OpenAPI spec to ${outputPath}`);
