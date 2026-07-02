import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './migrations',
  schema: './src/schema/index.ts',
  dbCredentials: {
    url: process.env.EVUKB_DATABASE_URL ?? 'postgres://evukb:evukb@localhost:5432/evukb',
  },
});
