const requireDatabase =
  process.argv.includes('--require') || process.env.EVUKB_REQUIRE_DB_TESTS === 'true';

const databaseUrl = process.env.EVUKB_DATABASE_URL;

if (databaseUrl) {
  console.info('Postgres-backed integration tests enabled via EVUKB_DATABASE_URL.');
} else if (requireDatabase) {
  console.error(
    [
      'EVUKB_DATABASE_URL is required for this test gate.',
      'Without it, Postgres-backed repository and server integration suites are skipped.',
      'Example: EVUKB_DATABASE_URL=postgres://evukb:evukb@localhost:5434/evukb pnpm test:ci',
    ].join('\n'),
  );
  process.exit(1);
} else {
  console.warn(
    [
      'Warning: EVUKB_DATABASE_URL is not set.',
      'Postgres-backed repository and server integration suites will be skipped.',
      'Run with EVUKB_DATABASE_URL=postgres://evukb:evukb@localhost:5434/evukb to include them.',
    ].join('\n'),
  );
}
