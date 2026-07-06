# Environment Variable Reference

This is the consolidated reference for all `EVUKB_*` environment variables that
the code actually reads. It was built from the implementation (search
`process.env.EVUKB_` under `packages/` and `apps/`) and cross-checked against
[`.env.example`](../.env.example). When this document and the code disagree, the
code wins — update this file in the same change.

Settings precedence (most specific wins): per-request override → corpus
settings → workspace settings → `EVUKB_*` environment defaults → built-in
defaults. Workspace encrypted secrets override process env for AI provider
keys. See [`SPEC.md` §8](../SPEC.md) and [`docs/AUTH.md`](./AUTH.md).

## API process

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_HOST` | API bind host | `0.0.0.0` |
| `EVUKB_API_PORT` | API port | `4201` |
| `EVUKB_WEB_ORIGIN` | Allowed Web origin for CORS | `http://localhost:4200` |
| `EVUKB_LOG_LEVEL` | Fastify logger level (`fatal`…`trace`) | `info` |
| `EVUKB_API_PROXY_TARGET` | Target for the Web app's same-origin `/api` proxy (Vite dev/preview) | `http://localhost:4201` |
| `EVUKB_BOOTSTRAP_WORKSPACE_SLUG` | In production, ensure this workspace slug exists on API startup (idempotent). Unset to disable | unset (prod compose defaults to `local-dev`) |
| `EVUKB_BOOTSTRAP_WORKSPACE_NAME` | Display name when bootstrapping the production workspace | slug value |

## Storage and limits

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_DATABASE_URL` | Postgres connection string | — (required) |
| `EVUKB_BLOB_ROOT` | Local corpus blob directory | `.evukb/corpus-store` |
| `EVUKB_MAX_UPLOAD_BYTES` | Maximum compressed upload size in bytes | 100 MiB |
| `EVUKB_MAX_ARCHIVE_IMPORT_BYTES` | Maximum total uncompressed bytes inside an imported archive (zip-bomb defense) | 500 MiB |

## Vector backend

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_VECTOR_BACKEND` | Vector index backend: `pgvector` or `qdrant` | `pgvector` |
| `EVUKB_QDRANT_URL` | Qdrant HTTP URL when the backend is `qdrant` | `http://localhost:6333` |

## Auth and secrets

Auth is fail-closed: without `EVUKB_ALLOW_OPEN_AUTH=true`, HTTP and MCP
requests require credentials even outside production. See
[`docs/AUTH.md`](./AUTH.md) for the full model.

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_ALLOW_OPEN_AUTH` | Explicit dev-only opt-in for unauthenticated HTTP/MCP access; ignored in production | unset (auth enforced) |
| `EVUKB_REQUIRE_API_KEY` | Force API-key auth on workspace routes even when the open-auth opt-in is set | `false` |
| `EVUKB_TOKEN_PEPPER` | Required (non-empty) whenever auth is enforced; mixed into API-key and MCP-token hashes | — |
| `EVUKB_SECRETS_KEY` | 32-byte hex key for workspace secret encryption | — |

## MCP

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_MCP_DEV_TOKEN` | Static dev MCP bearer token (dev only) | — |
| `EVUKB_MCP_REQUIRE_TOKEN` | Require an MCP token even when open auth is allowed | `false` |
| `EVUKB_MCP_ENABLE_ASK` | Register the `evu.kb.ask` MCP tool (capable agents should prefer `search` + `list_documents`) | `false` |

## Embeddings and chunking

Env values form the environment layer of the settings resolver; workspace and
corpus settings override them.

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_EMBEDDING_PROVIDER` | Default embedding provider id | `openai-compatible` |
| `EVUKB_EMBEDDING_API_KEY` | Default embedding provider API key | — |
| `EVUKB_EMBEDDING_BASE_URL` | Embedding provider base URL (OpenAI-compatible) | `https://api.openai.com/v1` |
| `EVUKB_EMBEDDING_MODEL` | Default embedding model | `text-embedding-3-small` |
| `EVUKB_EMBEDDING_BATCH_SIZE` | Max texts per `/embeddings` request (use `1` for strict self-hosted servers) | `8` |
| `EVUKB_EMBEDDING_MAX_RETRIES` | Retries for transient embedding HTTP failures (429/5xx) | `3` |
| `EVUKB_CHUNKING_STRATEGY` | Markdown chunking: `headings`, `headings_subsplit`, or `headings_subsplit_capped` | `headings` |
| `EVUKB_CHUNK_MAX_TOKENS` | Max estimated tokens per chunk when the capped strategy is active | `512` |
| `EVUKB_INDEX_FRONTMATTER_SUMMARY` | Prepend an indexed frontmatter summary as the first chunk (requires reindex) | `false` |

> `EVUKB_EMBEDDING_DIMENSIONS` appears in `.env.example` and the dev compose
> file but is **not read by server code today**. Embedding dimensions resolve
> from workspace/corpus provider settings with a built-in default of 1536.

### Optional local embedding sidecar (dev compose)

The dev compose file includes an optional Ollama service under the
`local-embed` profile. It is **not** started by default (`make dev`). When
opted in, point `EVUKB_EMBEDDING_BASE_URL` at the sidecar (for example
`http://ollama:11434/v1` from inside compose, or `http://localhost:11434/v1`
from a host-run API). Set `EVUKB_EMBEDDING_API_KEY` to any non-empty dummy
value for self-hosted servers that ignore auth. Use `EVUKB_EMBEDDING_BATCH_SIZE=1`
for strict self-hosted batching. See [`docs/DEVELOPMENT.md`](./DEVELOPMENT.md)
and [`deploy/local-embed.env.example`](../deploy/local-embed.env.example).

## Ask / chat provider

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_CHAT_PROVIDER` | Default chat provider id | `openai-compatible` |
| `EVUKB_CHAT_API_KEY` | Ask / chat provider API key (required for `/ask` and `reranker_llm`) | — |
| `EVUKB_CHAT_BASE_URL` | Chat provider base URL (OpenAI-compatible) | `https://api.openai.com/v1` |
| `EVUKB_CHAT_MODEL` | Default chat model | `gpt-4o-mini` |

## Search

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_RANKING_STRATEGY` | Environment-layer default ranking strategy, used when no workspace/corpus/request value is set | `hybrid_default_v1` |

## Sync

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_MOUNT_ALLOWLIST` | Comma-separated allowed mount roots for shared-mount import | — (no mounts allowed) |
| `EVUKB_ENABLE_IMPORT_WRITEBACK` | Allow the `import_writeback` sync mode (managed saves/deletes mirror to mount) | `false` |
| `EVUKB_ENABLE_MOUNT_AUTHORITATIVE` | Allow the `mount_authoritative` sync mode (deletes managed files missing from mount) | `false` |
| `EVUKB_GIT_CACHE_ROOT` | Server-side git clone/fetch cache root | falls back to blob root |
| `EVUKB_SYNC_SCHEDULE_CRON` | Cron for the scheduled mount/git sync tick | `*/5 * * * *` |
| `EVUKB_ENABLE_GIT_WRITEBACK` | Reserved gate for git writeback (SYNC-5 design accepted, SYNC-6 not implemented; see [`docs/GIT-WRITEBACK.md`](./GIT-WRITEBACK.md)) | `false` |

## Web app (browser config)

These variables configure the Web UI in `apps/web`. In Docker production (`make prod`),
the web container writes them into `/config.js` at startup from root `.env` — no image
rebuild is required when they change. During local Vite dev (`make dev`), Vite reads
them from `.env` at dev-server time.

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_EVUKB_API_BASE_URL` | Browser API origin; empty uses same-origin `/api` via the Vite preview proxy | empty |
| `VITE_EVUKB_WORKSPACE_ID` | Initial default workspace slug when no browser selection exists (`localStorage` key `evukb_selected_workspace` overrides after first use) | `local-dev` |
| `VITE_EVUKB_MCP_BASE_URL` | MCP base URL shown in the in-app MCP setup guide | derived from API origin |
| `VITE_EVUKB_API_PROXY_TARGET` | Alternative to `EVUKB_API_PROXY_TARGET` for the Vite dev/preview proxy | `http://localhost:4201` |

Split-host production also requires `EVUKB_WEB_ORIGIN` on the API process (see API process
table above) so cross-origin browser requests from the Web UI are allowed.

## Container timezone (Docker Compose)

| Variable | Purpose | Default |
| --- | --- | --- |
| `TZ` | Linux timezone for API/web containers (logs, server-side `Date`, cron ticks) | `UTC` |

Set in Compose as `TZ: ${TZ:-UTC}` on `evukb-api` and `evukb-web`. This does **not**
control how timestamps are rendered in the Web UI — operators configure that per browser
under **Settings → Preferences** (`localStorage` key `evukb_display_preferences`).
