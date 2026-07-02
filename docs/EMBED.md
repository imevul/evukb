# Embedding `@evu/kb-server`

Guide for host applications that run EvuKB **in-process** as a Fastify server
instead of using the standalone `apps/api` process or remote HTTP-only integration.

Related docs:

- [`docs/INTEGRATION.md`](./INTEGRATION.md) — remote HTTP, SDK, MCP, `/tools/kb`
- [`docs/PACKAGES.md`](./PACKAGES.md) — supported `@evu/kb-*` import surfaces
- [`docs/RELEASE.md`](./RELEASE.md) — license and distribution policy
- [`docs/AUTH.md`](./AUTH.md) — API keys, MCP tokens, `EVUKB_REQUIRE_API_KEY`
- [`apps/api/src/index.ts`](../apps/api/src/index.ts) — minimal reference shell
- [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) — Docker Compose env defaults

## When to embed vs standalone

| Approach | Use when |
| --- | --- |
| **Standalone `apps/api`** | Default deployment; Docker Compose; separate API/Web processes |
| **Embed `createEvuKbServer`** | Host app already owns Node lifecycle and wants KB routes on the same port/process |
| **Remote HTTP / SDK / MCP client** | Host is another language or process; no in-process Node dependency |

Embedding does **not** include the operator Web UI (`apps/web`). Hosts either use
EvuKB's standalone web app against the embedded API or build their own UI via SDK.

## Minimal bootstrap

Reference implementation ([`apps/api/src/index.ts`](../apps/api/src/index.ts)):

```typescript
import { createEvuKbServer } from '@evu/kb-server';

const server = await createEvuKbServer({
  blobRoot: process.env.EVUKB_BLOB_ROOT,
  connectionString: process.env.EVUKB_DATABASE_URL,
  bootstrapDevWorkspace: false,
});

await server.listen({
  host: process.env.EVUKB_HOST ?? '0.0.0.0',
  port: Number.parseInt(process.env.EVUKB_API_PORT ?? '4201', 10),
});
```

Production hosts should set `bootstrapDevWorkspace: false` and ensure workspace
rows exist in Postgres (or run bootstrap once in staging).

## `EvuKbServerOptions`

| Option | Type | Purpose |
| --- | --- | --- |
| `blobRoot` | `string` | Filesystem root for corpus blobs (`EVUKB_BLOB_ROOT`) |
| `connectionString` | `string` | Postgres URL; defaults from `EVUKB_DATABASE_URL` |
| `bootstrapDevWorkspace` | `boolean` | When true (non-prod default), ensures dev workspace slug |
| `chatProvider` | `ChatProvider \| null` | Override Ask chat provider; `null` disables Ask |
| `scope` | `KnowledgeWorkspaceScope` | Default scope metadata (not a multi-tenant bypass) |
| `logger` | `boolean` | Fastify logger (default `true`) |
| `maxUploadBytes` | `number` | Upload limit override |

If `connectionString` or `blobRoot` is missing, the server starts in **degraded**
mode: health routes work; workspace KB routes are not registered.

## Supported embed API (stability)

| Export | Stability | Notes |
| --- | --- | --- |
| `createEvuKbServer` | **Supported entry** | Primary embed function |
| `EvuKbServerOptions` | Supported | Option bag for bootstrap |
| `EvuKbHealth` | Supported | `/health` response shape |
| `EvuKbRuntime` | **Experimental** | In-process service graph on `server.evuKbRuntime` |
| Individual `*Service` exports | Experimental | Prefer HTTP/SDK until P3-10 package surfaces ship |

`server.evuKbRuntime` exposes repositories and services for advanced hosts. Field
names may change between minor versions until public package surfaces are documented
(P3-10).

## Lifecycle and graceful shutdown

On startup, `createEvuKbServer`:

1. Runs Drizzle migrations (`migrateLatest`)
2. Wires pg-boss job workers (index, sync, OKF maintenance, etc.)
3. Registers HTTP, MCP (`/mcp`), and health routes

On shutdown, register cleanup before exit:

```typescript
process.on('SIGTERM', () => {
  void server.close();
});

await server.close();
```

The server `onClose` hook:

- Waits for pg-boss idle (`jobQueue.waitForIdle()`)
- Stops the job queue
- Closes the database pool

Hosts embedding EvuKB should call `server.close()` during their own shutdown
sequence so in-flight index/sync jobs can finish.

## Authentication

EvuKB v1 is **headless / API-key oriented**. The host owns end-user identity.

- HTTP: `Authorization: Bearer <api-key>` on workspace routes when
  `EVUKB_REQUIRE_API_KEY=true`
- MCP: bearer token + `x-evukb-workspace-id` header
- Workspace id in URL path: `/api/workspaces/{workspaceId}/…`

The host must mint scoped EvuKB API keys or MCP tokens; see [`docs/AUTH.md`](./AUTH.md).
EvuKB does not provide SSO or session cookies in v1.

## Required environment

Minimum for full runtime:

| Variable | Required | Purpose |
| --- | --- | --- |
| `EVUKB_DATABASE_URL` | Yes | Postgres + pgvector |
| `EVUKB_BLOB_ROOT` | Yes | Corpus file storage |
| `EVUKB_REQUIRE_API_KEY` | Prod recommended | Reject unauthenticated workspace routes |
| `EVUKB_CHAT_API_KEY` | For Ask | Chat provider |
| `EVUKB_EMBEDDING_API_KEY` | For semantic search | Embedding provider |
| `EVUKB_VECTOR_BACKEND` | Optional | `pgvector` (default) or `qdrant` |
| `EVUKB_WEB_ORIGIN` | When browser clients call API | CORS allow-origin |

See [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) and [`deploy/docker-compose.dev.yml`](../deploy/docker-compose.dev.yml)
for the full list.

## MCP on the same server

MCP Streamable HTTP is registered on the **same Fastify instance** at `/mcp`
(`POST`/`GET`). Clients use the same origin as the HTTP API, for example:

```text
http://localhost:4201/mcp
```

See [`docs/INTEGRATION.md`](./INTEGRATION.md) §6 for JSON-RPC tool shapes.

## Health checks

| Route | Purpose |
| --- | --- |
| `GET /health` | Aggregate API + DB + blob status |
| `GET /health/db` | Postgres probe |
| `GET /health/blob-store` | Blob root probe |
| `GET /health/providers` | Embedding/chat configuration |
| `GET /health/vector-store` | pgvector or Qdrant backend |
| `GET /version` | Service name and version string |

Use these for orchestrator readiness probes when embedding.

## Contract test

Option keys on `EvuKbServerOptions` are checked in
[`packages/kb-server/test/embed-contract.test.ts`](../packages/kb-server/test/embed-contract.test.ts).

## Out of scope

- npm package publishing (P3-1)
- Custom Fastify auth hooks or host JWT middleware (use API keys)
- Embedding `apps/web` React bundle
- Git writeback implementation (see [`docs/GIT-WRITEBACK.md`](./GIT-WRITEBACK.md))
