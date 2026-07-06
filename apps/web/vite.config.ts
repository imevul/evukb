import type { ClientRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { codemirrorAlias, uiwReactCodemirrorAlias } from './vite-codemirror.js';

export function resolveEvuKbApiProxyTarget(env: Record<string, string>): string {
  return (
    process.env.EVUKB_API_PROXY_TARGET ?? env.VITE_EVUKB_API_PROXY_TARGET ?? 'http://localhost:4201'
  );
}

export function resolveWebProxyBearerToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const webApiKey = env.EVUKB_WEB_API_KEY?.trim();
  if (webApiKey) {
    return webApiKey;
  }
  const operatorKey = env.EVUKB_OPERATOR_API_KEY?.trim();
  return operatorKey || null;
}

function injectWebProxyAuthorization(proxyReq: ClientRequest): void {
  if (proxyReq.getHeader('authorization')) {
    return;
  }
  const bearer = resolveWebProxyBearerToken();
  if (bearer) {
    proxyReq.setHeader('authorization', `Bearer ${bearer}`);
  }
}

export function createEvuKbApiProxy(proxyTarget: string) {
  return {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          injectWebProxyAuthorization(proxyReq);
        });
        proxy.on('proxyRes', (proxyRes) => {
          const contentType = proxyRes.headers['content-type'];
          if (typeof contentType === 'string' && contentType.includes('text/event-stream')) {
            proxyRes.headers['cache-control'] = 'no-cache';
            proxyRes.headers['x-accel-buffering'] = 'no';
          }
        });
      },
    },
    '/health': {
      target: proxyTarget,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          injectWebProxyAuthorization(proxyReq);
        });
      },
    },
  } as const;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = resolveEvuKbApiProxyTarget(env);
  const apiProxy = createEvuKbApiProxy(proxyTarget);

  return {
    plugins: [react()],
    resolve: {
      alias: [
        codemirrorAlias('@codemirror/lang-markdown', 'index.js'),
        codemirrorAlias('@codemirror/search', 'index.js'),
        codemirrorAlias('@codemirror/state', 'index.js'),
        codemirrorAlias('@codemirror/view', 'index.js'),
        uiwReactCodemirrorAlias(),
        {
          // Dev-only: point the bare package specifier at kb-ui source so Tailwind
          // reliably scans classes and primitives hot-reload. Subpaths like
          // `@evu/kb-ui/theme/tokens.css` keep resolving through package exports.
          find: /^@evu\/kb-ui$/,
          replacement: fileURLToPath(new URL('../../packages/kb-ui/src/index.ts', import.meta.url)),
        },
        {
          // Dev-only: use kb-sdk source so client fixes hot-reload without rebuilding dist.
          find: /^@evu\/kb-sdk$/,
          replacement: fileURLToPath(
            new URL('../../packages/kb-sdk/src/index.ts', import.meta.url),
          ),
        },
        {
          find: /^@evu\/kb-core\/okf\/browser$/,
          replacement: fileURLToPath(
            new URL('../../packages/kb-core/src/okf/browser.ts', import.meta.url),
          ),
        },
        {
          find: /^@evu\/kb-core\/archive\/heuristics$/,
          replacement: fileURLToPath(
            new URL('../../packages/kb-core/src/archive/heuristics.ts', import.meta.url),
          ),
        },
      ],
    },
    server: {
      port: 4200,
      proxy: apiProxy,
    },
    preview: {
      host: '0.0.0.0',
      port: 4200,
      // Docker prod sits behind a reverse proxy; the Host header is the public hostname.
      allowedHosts: true,
      proxy: apiProxy,
    },
  };
});
