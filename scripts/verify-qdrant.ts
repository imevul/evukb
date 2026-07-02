import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const qdrantUrl = process.env.EVUKB_QDRANT_URL;

const qdrantStartHint =
  'docker compose --project-directory . -f deploy/docker-compose.dev.yml --profile qdrant up -d qdrant';

async function assertQdrantReachable(url: string): Promise<void> {
  const healthUrl = `${url.replace(/\/$/, '')}/healthz`;
  try {
    const response = await fetch(healthUrl);
    if (!response.ok) {
      throw new Error(`Qdrant health check failed with status ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach Qdrant at ${healthUrl}: ${message}. Start it with: ${qdrantStartHint}`,
    );
  }
}

async function main(): Promise<void> {
  if (!databaseUrl || !qdrantUrl) {
    console.error('verify-qdrant requires EVUKB_DATABASE_URL and EVUKB_QDRANT_URL.');
    console.error(`Start Qdrant: ${qdrantStartHint}`);
    process.exit(1);
  }

  await assertQdrantReachable(qdrantUrl);

  const testFiles = [
    'packages/kb-server/test/qdrant-integration.test.ts',
    'packages/kb-server/test/vector-backend-parity.test.ts',
  ];

  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...testFiles], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      EVUKB_VECTOR_BACKEND: 'qdrant',
      EVUKB_DATABASE_URL: databaseUrl,
      EVUKB_QDRANT_URL: qdrantUrl,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.info('Qdrant integration and vector-backend parity tests passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
