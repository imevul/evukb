# Development Guide

Contributor, agent, and operator reference for working in the EvuKB repository
beyond the short [`README.md`](../README.md) quickstart.

Related docs:

- [`SPEC.md`](../SPEC.md) — product and engineering source of truth
- [`docs/ROADMAP.md`](ROADMAP.md) — phase-level shipped/open work
- [`docs/ENV.md`](ENV.md) — full environment variable reference
- [`AGENTS.md`](../AGENTS.md) — agent read order, boundaries, and quality gates

## Current Status

EvuKB is a functional standalone knowledge-base product (P2 standalone complete). The repo
includes corpora and file management, markdown chunking and hybrid search, Ask with
citations, OKF validation/convert/export, mount and git sync, link graphs, workspace
settings and diagnostics UI, API keys and MCP tools, HTTP auth, ranking weights, and
portable `.evukb` corpus export/import, generic zip/tar archive import (Obsidian
vaults, GitHub downloads, etc.), search/ask **KnowledgeFilters** (tags,
file type, OKF type, path allowlist, frontmatter, source/index status) on HTTP,
MCP, SDK, and search UI, plus Ask streaming on `POST /tools/kb`.

P2 standalone is complete: Qdrant vector adapter (optional profile), Ask streaming SSE,
multi-corpus ask, all six ranking strategies (including `reranker_llm`), workspace search,
agent mutation approval, graph neighborhood, portable export/import, and mount sync modes
(`import`, `import_writeback`, `mount_authoritative`).

Remaining P3+ items are optional npm publishing (see [`docs/RELEASE.md`](RELEASE.md)),
git writeback implementation (SYNC-6), and agent write/retrieval
backlog (AGENT-1, AGENT-2). Memory banks are out of scope for EvuKB (see SPEC §16).
Host-specific adapter code belongs in consuming projects, not in EvuKB.

Consumer integration guide: [`docs/INTEGRATION.md`](INTEGRATION.md). Host shapes
(agent orchestration vs platform operator): [`docs/INTEGRATION-HOST-SHAPES.md`](INTEGRATION-HOST-SHAPES.md). Auth details:
[`docs/AUTH.md`](AUTH.md). Backup and restore runbook:
[`docs/BACKUP.md`](BACKUP.md). In-process server embedding:
[`docs/EMBED.md`](EMBED.md). Package import surfaces:
[`docs/PACKAGES.md`](PACKAGES.md). License and distribution policy (MIT;
workspace-only today, no npm publish without maintainer approval):
[`docs/RELEASE.md`](RELEASE.md).

## Repository Layout

```text
apps/
  api/              standalone API process
  web/              standalone Web UI

packages/
  kb-core/          domain contracts and core utilities
  kb-db/            Drizzle schema and migrations
  kb-server/        HTTP, MCP, jobs, and adapter wiring
  kb-sdk/           hand-written TypeScript client + generated OpenAPI types
  kb-ui/            reusable React UI primitives

deploy/
  docker-compose.dev.yml
  docker-compose.yml
  docker-compose.local.example.yml
  local-embed.env.example

docs/
  AUTH.md
  BACKUP.md
  DESIGN.md
  DEV-LEARNINGS.md
  DEVELOPMENT.md
  EMBED.md
  ENV.md
  GIT-WRITEBACK.md
  INTEGRATION.md
  INTEGRATION-HOST-SHAPES.md
  MCP-AGENT-GUIDE.md
  MIGRATION.md
  PACKAGES.md
  RELEASE.md
  ROADMAP.md
```

## Extended Development Workflow

### Docker stack (default)

[`make dev`](../README.md) is enough to run the product. Use `make up` instead
if you want the same stack detached in the background. The API runs migrations
on startup; a separate `make migrate` is not required for Docker-only dev.

### Host-side checks (contributors)

Install dependencies on the host, then run checks while Postgres is up (start
the stack with `make dev` or `make up`):

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For Postgres-backed integration tests, point at the dev database:

```bash
EVUKB_DATABASE_URL=postgres://evukb:evukb@localhost:5432/evukb pnpm test:ci
```

Run `make migrate` on the host only when you need to apply migrations outside
the API container (for example before a host-run API or one-off DB tooling).

Default dev ports:

- Web: `http://localhost:4200`
- API: `http://localhost:4201`
- Postgres: `localhost:5432`
- Qdrant, optional profile: `localhost:6333`
- Ollama, optional profile: `localhost:11434`

## Commands

| Command | Purpose |
| --- | --- |
| `make dev` | Start the dev Docker Compose stack in the foreground |
| `make dev-local-embed` | Start the dev stack with the optional Ollama embedding sidecar (`local-embed` profile) |
| `make up` | Start the dev stack in the background |
| `make down` | Stop the dev stack |
| `make prod` | Start the production Docker Compose stack (`deploy/docker-compose.yml`) |
| `make lint` / `make typecheck` / `make build` | Run the corresponding workspace check |
| `make test` | Run workspace tests, warning when DB-backed suites will skip |
| `make verify-dev` | Build, test, and validate the dev compose config |
| `make verify-qdrant` | Optional: run Qdrant integration and vector-backend parity tests (requires Postgres + Qdrant) |
| `make migrate` | Apply Drizzle migrations to the configured Postgres database |
| `make generate-openapi` | Write OpenAPI spec to `packages/kb-sdk/openapi/evukb.openapi.json` |
| `make api-docs` | Regenerate Redoc HTML at `docs/api/index.html` (served at `GET /api-reference`) |
| `pnpm generate-types` | Regenerate TypeScript types from the OpenAPI spec |
| `pnpm test:ci` | Fail fast unless `EVUKB_DATABASE_URL` is set, then run all Vitest suites |

### Operator UI routes

Default dev workspace: `local-dev`.

- Settings: `/settings` (workspace, AI providers, ranking, secrets)
- Diagnostics: `/diagnostics` (health probes, failed jobs, retry)

### Optional Qdrant verification

Default `make verify-dev` does not require Qdrant. When validating the optional Qdrant vector
backend (local or in a separate CI job), start the Qdrant profile and run `verify-qdrant`:

```bash
docker compose --project-directory . -f deploy/docker-compose.dev.yml --profile qdrant up -d qdrant
EVUKB_DATABASE_URL=postgres://evukb:evukb@localhost:5432/evukb \
EVUKB_QDRANT_URL=http://localhost:6333 \
make verify-qdrant
```

This runs `qdrant-integration.test.ts` and `vector-backend-parity.test.ts` with
`EVUKB_VECTOR_BACKEND=qdrant`. GitHub Actions exposes this as an optional manual
workflow path through the `run_qdrant` dispatch input.

### Optional local embeddings

Default `make dev` does not start a local embedding server. To opt in, use the
`local-embed` compose profile (Ollama sidecar with an OpenAI-compatible
`/v1/embeddings` endpoint):

```bash
make dev-local-embed
# or start only the sidecar alongside an existing stack:
docker compose --project-directory . -f deploy/docker-compose.dev.yml \
  --profile local-embed up -d ollama
```

Pull an embedding model (replace `<model>` with your choice):

```bash
docker compose --project-directory . -f deploy/docker-compose.dev.yml \
  --profile local-embed exec ollama ollama pull <model>
```

Copy [`deploy/local-embed.env.example`](../deploy/local-embed.env.example) into
your root `.env` (or use [`deploy/docker-compose.local.example.yml`](../deploy/docker-compose.local.example.yml)
overrides), then restart the API container.

**Dimension constraint:** pgvector stores vectors as `vector(1536)`. Verify the
model output size before indexing — common local models (for example
`nomic-embed-text` at 768) will fail at index time. `EVUKB_EMBEDDING_DIMENSIONS`
is not read by server code today; see [`docs/ENV.md`](ENV.md).

Verify the sidecar before reindexing:

```bash
curl -sS http://localhost:11434/v1/embeddings \
  -H "Authorization: Bearer local" \
  -H "Content-Type: application/json" \
  -d '{"model":"<model>","input":["test"]}' | jq '.data[0].embedding | length'
# Must be 1536 for the default pgvector backend
```

Set `EVUKB_EMBEDDING_API_KEY` to any non-empty dummy value (for example `local`)
when using self-hosted servers that do not require auth. Use
`EVUKB_EMBEDDING_BATCH_SIZE=1` if the server rejects multi-text batches.

For llama.cpp or other self-hosted servers, see
[`docs/DEV-LEARNINGS.md`](DEV-LEARNINGS.md) and override endpoints via
`deploy/docker-compose.local.yml` instead of the Ollama profile.

### Production Web deployment

The production compose stack serves the Web UI through Vite preview with a
same-origin `/api` proxy. Build the Web image with an empty `VITE_EVUKB_API_BASE_URL`
(default) and set `EVUKB_API_PROXY_TARGET=http://evukb-api:4201` at runtime in
[`deploy/docker-compose.yml`](../deploy/docker-compose.yml).

For split-host deployments where the browser must call a separate API origin, pass
`VITE_EVUKB_API_BASE_URL` as a Docker build `ARG` when building `apps/web/Dockerfile`.

Workspace isolation golden tests live under `packages/kb-core/test/isolation-golden.test.ts`
and `packages/kb-server/test/integration/isolation.integration.test.ts`.

## Runtime Defaults

Copy `.env.example` to `.env` at the **repository root** for local overrides. EvuKB uses the `EVUKB_*`
environment prefix. The dev/prod compose scripts pass `--project-directory .` so this root
`.env` is loaded when you run `make dev`, `make up`, or `make prod`. After changing provider
keys or base URLs, recreate the API container (`make down && make dev`, or restart
`evukb-api`). Local corpus data defaults to `.evukb/corpus-store/`, which is ignored by git.

The consolidated, code-verified env-var reference is [`docs/ENV.md`](ENV.md). The most common operator vars:

| Variable | Purpose |
| --- | --- |
| `EVUKB_DATABASE_URL` | Postgres connection string |
| `EVUKB_BLOB_ROOT` | Local corpus blob directory |
| `EVUKB_ALLOW_OPEN_AUTH` | Explicit dev-only opt-in for unauthenticated HTTP/MCP access; auth is fail-closed without it and it is ignored in production |
| `EVUKB_TOKEN_PEPPER` | Required (non-empty) whenever auth is enforced; mixed into API key / MCP token hashes |
| `EVUKB_SECRETS_KEY` | 32-byte hex key for workspace secret encryption |
| `EVUKB_EMBEDDING_API_KEY` | Default embedding provider API key |
| `EVUKB_CHAT_API_KEY` | Ask / chat provider API key (required for `/ask`) |
| `EVUKB_VECTOR_BACKEND` | Vector index backend: `pgvector` (default) or `qdrant` |
| `EVUKB_MAX_UPLOAD_BYTES` | Maximum compressed upload size in bytes (default 100 MiB) |
| `EVUKB_MAX_ARCHIVE_IMPORT_BYTES` | Maximum total uncompressed bytes inside an imported archive (default 500 MiB) |

Settings precedence (most specific wins): per-request override → corpus settings →
workspace settings → `EVUKB_*` environment defaults. AI provider keys follow the same
pattern: workspace encrypted secrets override process env when configured.

Standalone v1 auth is API-key and MCP-token oriented; see [`docs/AUTH.md`](AUTH.md).

Active ranking strategies: `hybrid_default_v1` (default), `semantic_only`, `keyword_only`,
`recency_boosted`, `citation_boosted`, `reranker_llm` (requires chat provider). Set per corpus
(`rankingStrategyId`), workspace default (`settings.rankingStrategyId`), or per search/ask request
override.

Mount sync modes are:

- `import`: mount files import into KB as read-only `shared_mount` nodes.
- `import_writeback`: managed KB file saves/deletes mirror to the mount when
  `EVUKB_ENABLE_IMPORT_WRITEBACK=true`; KB wins on the next save/delete and
  external mount edits are reported as drift.
- `mount_authoritative`: mount is the source of truth when
  `EVUKB_ENABLE_MOUNT_AUTHORITATIVE=true`.

Git sync is import-only: EvuKB clones/fetches into a server-side cache, imports
files into the corpus, and keeps git-sourced nodes read-only. Git writeback is a
future explicit design task, not part of mount writeback.

## Package Boundaries

- `@evu/kb-core` owns stable domain contracts and pure knowledge utilities.
- `@evu/kb-db` owns schema, migrations, and typed database helpers.
- `@evu/kb-server` owns route, MCP, job, and adapter composition.
- `@evu/kb-sdk` owns the hand-written HTTP client, generated OpenAPI types, and API auth helpers.
- `@evu/kb-ui` owns reusable React primitives for EvuKB UI surfaces.
- `apps/api` and `apps/web` are standalone product processes, not reusable
  domain libraries.
