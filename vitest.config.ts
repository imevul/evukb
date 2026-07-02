import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

import { codemirrorResolve, uiwReactCodemirrorResolve } from './apps/web/vite-codemirror.js';

const kbUiNodeModules = fileURLToPath(new URL('./packages/kb-ui/node_modules', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@codemirror/lang-markdown': codemirrorResolve('@codemirror/lang-markdown', 'index.js'),
      '@codemirror/search': codemirrorResolve('@codemirror/search', 'index.js'),
      '@codemirror/state': codemirrorResolve('@codemirror/state', 'index.js'),
      '@codemirror/view': codemirrorResolve('@codemirror/view', 'index.js'),
      '@evu/kb-core/archive/heuristics': fileURLToPath(
        new URL('./packages/kb-core/src/archive/heuristics.ts', import.meta.url),
      ),
      '@evu/kb-core/okf/browser': fileURLToPath(
        new URL('./packages/kb-core/src/okf/browser.ts', import.meta.url),
      ),
      '@evu/kb-sdk': fileURLToPath(new URL('./packages/kb-sdk/src/index.ts', import.meta.url)),
      '@evu/kb-ui': fileURLToPath(new URL('./packages/kb-ui/src/index.ts', import.meta.url)),
      '@uiw/react-codemirror': uiwReactCodemirrorResolve(),
    },
  },
  test: {
    coverage: {
      exclude: ['**/*.d.ts'],
      include: ['packages/kb-core/src/**/*.{ts,tsx}', 'packages/kb-server/src/**/*.{ts,tsx}'],
      reporter: ['text', 'lcov'],
      // Ratchet: measured 73% stmts / 60% branches / 77% funcs / 73% lines on
      // 2026-07-02 with the DB-backed suite. Raise as coverage improves.
      thresholds: {
        branches: 57,
        functions: 73,
        lines: 70,
        statements: 70,
      },
    },
    env: {
      // Tests exercise the dev-mode open-auth path unless a test opts back in
      // to enforcement via EVUKB_REQUIRE_API_KEY / EVUKB_MCP_REQUIRE_TOKEN.
      EVUKB_ALLOW_OPEN_AUTH: 'true',
      // Enforced-auth tests need a pepper for token hashing at startup.
      EVUKB_TOKEN_PEPPER: 'test-pepper',
    },
    deps: {
      moduleDirectories: ['node_modules', kbUiNodeModules],
    },
    environment: 'node',
    environmentMatchGlobs: [
      ['apps/web/test/a11y/**', 'jsdom'],
      ['packages/kb-ui/test/components/**', 'jsdom'],
    ],
    fileParallelism: false,
    include: ['apps/**/test/**/*.test.{ts,tsx}', 'packages/**/test/**/*.test.{ts,tsx}'],
    onUnhandledError(error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('socket.destroySoon is not a function')) {
        return false;
      }
    },
  },
});
