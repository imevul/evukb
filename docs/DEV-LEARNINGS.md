# Development Learnings

Use this file for lessons that should change future implementation behavior. Add
entries after novel bugs, migration surprises, failed assumptions, or important
tradeoffs.

## Entry Format

```text
Date:
Area:
Context:
Learning:
Action:
```

## 2026-06-29: Initial Scaffold

Area: repository structure

Context: EvuKB starts as a clean repository with only `SPEC.md`. The parent
projects use pnpm workspaces, Node 22, TypeScript, Biome, Vitest, Docker Compose,
and package-local scripts.

Learning: The scaffold should match that ecosystem immediately so later migration
work does not spend time normalizing tooling. `@evu/kb-ui` is included from the
start because the standalone Web UI and future embeddable UI package are both in
scope.

Action: Keep future packages aligned with the same script surface: `build`,
`typecheck`, and `test`. Add new docs when behavior becomes concrete rather than
letting `SPEC.md` become the only operational guide.

## 2026-06-29: Storage Foundation

Area: schema, migrations, blob storage

Context: The first implementation sprint added Drizzle schema, a real migration
runner, local blob storage, and workspace-scoped repositories on top of the
scaffold.

Learning: pgvector and pgcrypto must be enabled in the migration runner before
Drizzle applies SQL; generated migrations alone are not enough. Repository
isolation tests should run against real Postgres when `EVUKB_DATABASE_URL` is
available, while blob-store safety stays in fast unit tests with temp
directories. `@evu/kb-core` needed explicit `@types/node` because filesystem blob
storage lives in the domain package.

Action: Keep workspace filters mandatory in repository helpers from day one.
Treat cross-workspace reads as release-blocking bugs and cover them with
integration tests whenever Postgres is available.

## 2026-06-29: Corpus and File Manager API

Area: HTTP routes, Fastify composition, file uploads

Context: The second sprint wired workspace-scoped corpus CRUD and managed file
routes on top of Postgres metadata and the local blob store.

Learning: Fastify hooks registered in a sibling plugin do not run for routes
registered in another plugin under the same prefix; workspace context must be
attached on the parent scope before registering route plugins. Workspace lookup
should accept UUIDs or slugs, but only query Postgres by ID when the path segment
matches UUID syntax to avoid invalid-input errors. File upload routes need both
multipart and JSON create paths for tests and simple clients; PUT content saves
need explicit `text/plain` or `application/octet-stream` parsers.

Action: Keep workspace pre-handlers on the prefixed parent register block.
Document accepted content types for file create/save in OpenAPI. Seed the
`local-dev` workspace idempotently and retry on slug conflicts during parallel
startup.

## 2026-06-29: Index and Hybrid Search Pipeline

Area: markdown parsing, FTS migration, indexing, hybrid search

Context: The third sprint added markdown parse/chunk/link utilities, chunk and
link repositories with a Postgres FTS migration, in-process indexing on markdown
file writes, and hybrid keyword search with optional pgvector semantic ranking.

Learning: Generated `tsvector` columns belong in SQL migrations rather than
Drizzle schema alone when using `GENERATED ALWAYS AS`. Raw SQL chunk queries must
map snake_case Postgres rows separately from Drizzle select mappers. Auto-index
should only run for markdown filenames so non-markdown uploads are not marked
failed. Keyword search works without an embedding provider; semantic ranking
activates only when `EVUKB_EMBEDDING_API_KEY` is configured.

Action: Keep indexing side effects out of kb-core. Run corpus stat refresh after
successful node indexing. Use explicit `reindex` routes in tests when asserting
search behavior to avoid races with fire-and-forget indexing.

## 2026-06-29: Ask with Citations API

Area: ask route, chat provider, RAG retrieval

Context: The fourth sprint added corpus-scoped ask over hybrid search with an
OpenAI-compatible chat adapter, structured citations derived from retrieved
chunks, and non-streaming JSON responses.

Learning: Citations must come from `SearchResult.citation`, not from LLM output
parsing. Ask requires a configured chat provider and returns `503` when
`EVUKB_CHAT_API_KEY` is absent, unlike embeddings where keyword search still
works unconfigured. Inject a mock `ChatProvider` in integration tests to avoid
live LLM calls in CI.

Action: Keep prompt/context assembly in `@evu/kb-core`. Reject `stream: true`
until SSE ask is implemented. Use explicit `reindex` in ask integration tests
before asserting retrieval-backed answers.

## 2026-06-29: Minimal Web UI

Area: web app, kb-sdk client, Vite proxy

Context: The fifth sprint added React Router pages for corpus list, file editing,
search, and ask, plus expanded `@evu/kb-sdk` methods and small `@evu/kb-ui`
primitives.

Learning: Prefer same-origin `/api` requests through the Vite dev proxy instead of
browser calls to `localhost:4201`, which require CORS. In Docker dev, set
`VITE_EVUKB_API_PROXY_TARGET=http://evukb-api:4201`. Keep markdown editing as
plain source in a textarea until sanitization and preview exist. Dev bootstrap
uses workspace slug `local-dev`.

Action: Keep fetching in `apps/web` and reusable display primitives in
`@evu/kb-ui`. Surface `EvuKbApiError` codes in ask UI for missing chat config.

## 2026-06-29: MCP Read Tools

Area: kb-server MCP transport, dev auth, read tools

Context: P0 / MIGRATION step 8 added Streamable HTTP MCP at `POST /mcp` with
read-only tools backed by existing HTTP services (corpora, documents, search,
chunks, links, ask).

Learning: MCP tool handlers must call the same services as HTTP routes so
semantics stay identical. Use Streamable HTTP at `/mcp` (stateless,
`enableJsonResponse: true`) rather than SPEC legacy `/sse` + `/messages` until
a target client requires dual-endpoint transport. Until P1 `mcp_tokens` exists,
gate MCP with optional `EVUKB_MCP_DEV_TOKEN` and resolve workspace scope from
`x-evukb-workspace-id` (UUID or slug), falling back to `local-dev` in dev.

Action: Map `ApiError` to MCP tool errors with `isError: true`. Defer write
tools, token CRUD, HTTP `POST /tools/kb`, graph neighborhood, and OKF tools
until scoped auth and backing services land.

## 2026-06-29: Link Graph

Area: kb-core graph types, kb-server link graph service, HTTP/MCP/UI surfaces

Context: P1 started by exposing indexed `knowledge_links` as a corpus-scoped
graph via `GET .../link-graph`, `GET .../nodes/{nodeId}/links`, MCP
`evu.kb.graph_neighborhood`, SDK methods, and a table-based Links UI tab.

Learning: `evu.kb.follow_links` returns outbound edges from one node; link graph
and neighborhood assemble corpus subgraphs from the same indexed links.
Neighborhood traversal resolves internal targets by path when `toNodeId` is not
yet persisted at index time. External URLs stay out of the internal graph view.

Action: Keep graph assembly in `LinkGraphService` and reuse it from HTTP and MCP.
Defer interactive canvas visualization to P2; use table views in v1.

## 2026-06-29: MCP Tokens and Scoped Auth

Area: auth schema, MCP bearer validation, token CRUD, settings UI

Context: P1 added workspace-bound `mcp_tokens` and `api_keys` with SHA-256
hashes (optional `EVUKB_TOKEN_PEPPER`), CRUD HTTP routes, DB-backed MCP auth,
`kb:read` / `kb:write` scopes, SDK helpers, and minimal settings pages.

Learning: Store only hashed secrets; return plaintext once on create. MCP auth
priority is DB bearer, then legacy `EVUKB_MCP_DEV_TOKEN`, then open dev unless
`EVUKB_MCP_REQUIRE_TOKEN` is set. Token workspace is authoritative; a mismatched
`x-evukb-workspace-id` header is forbidden. Pass per-request MCP auth through
`AsyncLocalStorage` so tool handlers see the resolved token context.

Action: Defer global HTTP API-key middleware and write MCP tools until a later
sprint. Empty token scopes still mean read-only for backward compatibility.

## 2026-06-29: Corpus Stats and Link Resolution

Area: kb-core link resolver, index-time link persistence, corpus stats, overview UI

Context: Added shared wikilink path matching in `@evu/kb-core`, persisted
`toNodeId`/`resolved` during indexing with incoming-link patches, corpus-wide
reconcile on reindex-all, `GET .../stats`, SDK helper, and an Overview tab.

Learning: Keep path matching in one kb-core module consumed by indexing and graph
services. Resolve outgoing links when indexing a node and patch incoming links
when the target file path appears. Stats are a read-model over corpus counters,
markdown index statuses, and link resolution counts—not a separate cache.

Action: Reindex corpora after deploying resolver changes to backfill persisted
link targets. Defer index-status badges on Files and job diagnostics to a later
sprint.

## 2026-06-29: Agent Write Tools and HTTP Tool Mirror

Area: MCP write tools, POST /tools/kb, AgentWriteService, audit_log

Context: Added `kb:write`-gated MCP mutation tools and a matching
`POST /api/workspaces/:workspaceId/tools/kb` dispatcher, both routed through
shared `AgentWriteService` with minimal `audit_log` inserts.

Learning: Keep write scope separate from read scope: `kb:write` alone cannot call
read MCP tools and `kb:read` alone cannot mutate. Restrict agent create/append
paths to `agent-notes/` in v1; update/delete use node IDs. Append creates the
file (and folder chain) when missing. HTTP `/tools/kb` accepts API keys with
`kb:write`; dev stays open without a bearer like other corpus routes.

Action: Defer mutation approval workflow, audit UI, and path-prefix token scopes
to later sprints. Corpus HTTP file routes remain dev-open; enforce write auth on
MCP write tools and `/tools/kb` only.

## 2026-06-29: Corpus Diagnostics UX

Area: reindex-needing route, SDK reindex helpers, Overview and Files UI actions

Context: Added `POST .../reindex-needing` for pending/stale/failed markdown files,
shared `IndexNodeResult` in kb-core, SDK `reindexNodes`/`reindexCorpus`/
`reindexNeedingAttention`, and operator reindex buttons on Overview and Files.

Learning: Keep synchronous reindex in v1; selection logic belongs in
`IndexService.reindexNeedingAttention` using `needingAttentionIndexStatuses` from
kb-core. Overview warnings can point to the needing-attention action. Align SDK
`IndexStatus` with kb-core before exposing diagnostics in the UI.

Action: Defer pg-boss job queue UI and failed-jobs list until async indexing lands.
Use reindex routes from SDK in any future automation or MCP tool.

## 2026-06-29: Audit Trail UI

Area: audit read API, SDK list helper, settings audit page

Context: Added read-only `GET /api/workspaces/:workspaceId/audit` with limit and
optional action filter, `AuditLogRepository.listByWorkspace`, SDK
`listAuditLog`, and `/settings/audit` table UI for agent write mutations already
recorded by `AgentWriteService`.

Learning: Keep audit reads dev-open in v1 like MCP token and API key list routes;
enforce workspace scope in the repository query, not in the UI. Cap list limits at
200 server-side and default to 50. Actor display uses stored JSON only—no token
name resolution yet.

Action: Defer mutation approval workflow, audit export, production HTTP auth
middleware, and path-prefix token scopes to later sprints.

## 2026-06-29: OKF Foundation

Area: OKF v0.1 validation, corpus formatProfile, diagnostics surfacing

Context: Added `@evu/kb-core` OKF validators (`classifyOkfFile`, `validateOkfV01`),
corpus `settings.formatProfile`, warn-by-default validation on markdown index/save,
`okfIssueCount` in corpus stats, and UI badges on overview/files/links.

Learning: Store `formatProfile` in existing corpus `settings` jsonb to avoid a
migration. Keep OKF validation in kb-core and apply from IndexService/FileManager;
persist `validationIssues` and `okfConformant` on node metadata without blocking
indexing in v1. Generic corpora strip OKF metadata keys on reindex.

Action: Defer OKF index/log auto-maintenance, citation URL queue, and strict
`okfStrict` enforcement.

## 2026-06-29: OKF Convert/Export and MCP Read Tools

Area: OKF convert/export HTTP routes, OkfService, MCP read_index/list_concepts

Context: Added synchronous `POST .../convert-to-okf` and `GET .../export-okf`,
shared `OkfService` in kb-server, SDK client helpers, overview UI actions, and
MCP tools gated by existing `kb:read` scope checks via `withMcpToolContext`.

Learning: Keep convert/index synthesis synchronous in v1—`FileManager.saveContent`
and `IndexService.indexNode` already trigger reindex. Use indexed node metadata
for `list_concepts` and parse blob content only when index status is pending.
Export uses in-memory `fflate` zip of managed corpus files with relative paths.

Action: Defer pg-boss index/log auto-maintenance, HTTP `/tools/kb` read mirror,
portable `.evukb` import/export, and strict `okfStrict` blocking on save.

## 2026-06-29: MCP Fastify Inject and destroySoon

Area: integration tests, MCP HTTP transport

Context: `POST /mcp` via Fastify `inject()` with hijacked replies triggers
`@hono/node-server` timers that call `socket.destroySoon`, which inject mock
sockets do not implement. Vitest reported unhandled errors and failed `pnpm test`
even when all assertions passed.

Learning: Filter this specific unhandled error in `vitest.config.ts`
`onUnhandledError` until MCP transport teardown works with inject mocks or tests
move to a real HTTP listener.

Action: Revisit when adding dedicated MCP e2e tests; do not blanket-ignore other
unhandled errors.

## 2026-06-29: OKF Sync Maintenance and Strict Saves

Area: OKF index/log auto-maintenance, okfStrict enforcement

Context: Added synchronous OKF maintenance after concept mutations via
`OkfMaintenanceService` and `FileManager.onOkfMutation`, incremental index auto
section updates, log append, and save blocking when `settings.okfStrict` is true.

Learning: Use `saveContentInternal` / `createFileInternal` for maintenance writes
to skip strict checks and maintenance recursion while still triggering reindex.
Keep maintenance logic in kb-core; kb-server loads folder nodes and persists index
and log files through `FileManager`.

Action: Defer pg-boss debounced `evu-kb-okf-maintain`, per-corpus
autoRefreshIndex/autoAppendLog toggles, and citation URL validation queue.

## 2026-06-30: pg-boss Jobs and OKF Citation Validation

Area: pg-boss job queue, async indexing, OKF citation URL validation

Context: Sprint 3 moved indexing and OKF maintenance off the request path into
pg-boss queues (`evu-kb-index`, `evu-kb-okf-maintain`, `evu-kb-citation-validate`)
and added SSRF-safe OKF citation URL validation with metadata persistence.

Learning: pg-boss auto-creates the `pgboss` schema on first start; use
`deleteQueuedJobs` under Vitest to avoid cross-test pollution. Multiple
`JobQueueService` instances in parallel test files race on the same queues—run
`fileParallelism: false` in `vitest.config.ts`. Debounced OKF maintenance uses
`sendDebounced` (2s); tests must poll for index/log side effects rather than
assuming synchronous writes. Citation validation runs after index jobs and stores
results in `metadata.citationValidation`, merged into validation warnings.

Action: On server shutdown, `waitForIdle()` before `stop()` so blob temp dirs
are not deleted while jobs still run. Keep URL policy checks in kb-core; DNS
resolution and fetch stay in kb-server only.

## 2026-06-30: Mount and Git Sync Import

Area: sync import services, pg-boss mount/git queues, mutability enforcement

Context: Sprint 4 added mount and git import modes with pg-boss workers
(`evu-kb-mount-sync`, `evu-kb-git-sync`), blob copy import, read-only mutability
for synced/reference nodes, sync HTTP routes, SDK/UI surfacing, and integration
tests.

Learning: Keep sync settings in corpus `settings` jsonb (`importKind`, `mountPath`,
`gitRemoteUrl`, `syncStatus`) without a migration. Gate mount paths with
`EVUKB_MOUNT_ALLOWLIST` and realpath containment checks before copy. Git caches
live under `{EVUKB_GIT_CACHE_ROOT || blobRoot}/.git-cache/{workspaceId}/{corpusId}`.
Use `import/{nodeId}` blob paths for synced files. `FileManager.readContent` must
allow any node with `storageRelPath`; writes use `resolveNodeMutability()`.

Action: Defer scheduled sync, writeback modes, and secrets UI. Use `file://`
git remotes in tests; integration tests set `EVUKB_MOUNT_ALLOWLIST` to a temp dir.

## 2026-06-30: Operator Settings, Secrets, and Scheduled Sync

Area: settings/diagnostics API, secrets CRUD, pg-boss schedule tick, settings UI

Context: Sprint 5 added workspace settings (`GET/PATCH /settings`), AI provider
display (`GET /ai/providers`), health sub-routes, failed-job diagnostics,
encrypted secrets CRUD, and a pg-boss cron worker for scheduled mount/git sync.

Learning: Secrets require `EVUKB_SECRETS_KEY` (32-byte hex or base64); create
fails closed with 503 when missing. pg-boss `schedule(name, cron, {})` drives
`evu-kb-mount-sync-schedule`; skip scheduling under `VITEST=true`. Ranking
settings persist in `workspace.settings.rankingSettings` but search still uses
hybrid RRF v1—label the UI accordingly. Settings precedence for boot hints is
env-only display in v1 (database stores workspace name + ranking only).

Action: Set `EVUKB_SECRETS_KEY` in dev/prod env before using git credential
secrets. Use `EVUKB_SYNC_SCHEDULE_CRON` to override the default `*/5 * * * *`
tick. Failed jobs query filters by workspace id in job payload JSON.

## 2026-06-30: HTTP Auth, Ranking Weights, and Graph Neighborhood

Area: HTTP API-key middleware, weighted hybrid search, graph neighborhood HTTP/UI

Context: Sprint 6 added workspace-scoped HTTP auth (`EVUKB_REQUIRE_API_KEY` or
production), applied workspace/corpus ranking weights in `SearchService`, exposed
`GET .../graph/neighborhood`, and shipped a radial SVG graph tab.

Learning: Keep HTTP auth dev-open by default; classify `POST .../search` and
`POST .../ask` as read routes. Empty API-key scopes allow GET/HEAD only; `kb:read`
includes search/ask POST. Ranking precedence is request override, then corpus, then
workspace, with keyword/semantic/pathBoost weights on hybrid RRF v1. Graph UI uses
SVG radial layout without adding a graph library.

Action: Set `EVUKB_REQUIRE_API_KEY=true` (or deploy to production) before exposing
the API publicly. Seed initial API keys out-of-band when auth is required. Use the
Graph tab or `?nodeId=` query param to deep-link neighborhoods from Links.

## 2026-06-30: Portable Export/Import and Operator Polish

Area: `.evukb` portable zip, failed-job retry, secret rotation, corpus-reindex worker

Context: Sprint 7 added portable corpus export/import (manifest v1 under
`.evukb/manifest.json` plus `files/`), `POST /jobs/:id/retry`, `PATCH /secrets/:id`
rotate, and wired the `evu-kb-corpus-reindex` queue so `reindex-all` enqueues one
background job that fans out index work.

Learning: Reject zip entries with `..`, absolute paths, or unexpected `.evukb` paths
before extraction. Portable import uses `sourceType: import` and
`evukb-portable:<path>` source refs; stable node IDs are best-effort when IDs
conflict across paths. Job retry must verify `workspaceId` in pg-boss payload.
Import/export runs in-process—respect `EVUKB_MAX_UPLOAD_BYTES` on import.

Action: Use corpus Overview **Export portable** / **Import portable** for backups.
Retry failed jobs from Diagnostics. Set `EVUKB_SECRETS_KEY` before rotating git
credentials. Large corpora may need raised upload limits for portable import.

## 2026-06-30: Ranking Boosts and Multi-Corpus Ask

Area: hybrid ranking v1 boosts, workspace ask over corpusIds[], searchAcrossCorpora

Context: Sprint 8 wired recency, OKF citation, and exact-title boosts into
`rankHybridDefaultV1`; added workspace `POST /ask` with `corpusIds[]` (max 10),
SDK `askWorkspace`, MCP optional `corpusIds`, and `/ask` UI with corpus multi-select.

Learning: Boost multipliers apply after path boost:
`(weightedKeyword + weightedSemantic) * pathBoost * recency * okf * title`.
Recency uses `1 + recencyBoost * exp(-ageDays / 30)` when `indexedAt` is present.
OKF citation boost triggers when heading path contains `Citations` or body matches
OKF citation block heuristics. Exact title boost requires normalized query equals
node frontmatter/title. `searchAcrossCorpora` runs per-corpus search (preserving
corpus ranking settings), merges by score descending, tie-breaks by `corpusId` then
`chunkId`, and slices to limit. Single-corpus ask delegates to `askCorpora`.

Action: Tune boosts via workspace/corpus ranking settings; expect N sequential corpus
searches for multi-corpus ask (cap 10). Use `/ask` or `askWorkspace` when questions
span corpora; keep single-corpus routes for backward compatibility.

## 2026-06-30: Workspace Search and OKF Body Boost Heuristic

Area: workspace POST /search, OKF citation body detection, shared maxMultiCorpora

Context: Sprint 9 exposed `searchAcrossCorpora` via workspace `POST /search` with
`corpusIds[]`, SDK `searchWorkspace`, MCP optional `corpusIds`, and `/search` UI.
Added `isOkfCitationChunkContent` for OKF citation boost when chunk body contains
HTTP citation URLs. Introduced shared `maxMultiCorpora` for ask and search caps.

Learning: Workspace search reuses the same merge semantics as ask retrieval:
per-corpus hybrid search, global score sort, tie-break by `corpusId` then `chunkId`.
HTTP auth treats `POST .../search` as read (same suffix rule as corpus search).
OKF body heuristic may boost chunks with bare HTTP links outside OKF docs; keep
`okfCitationBoost` at 0 unless intentional.

Action: Use `/search` or `searchWorkspace` for cross-corpus keyword/semantic lookup;
use `/ask` when LLM synthesis is needed. Tune OKF citation boost carefully when
enabling body URL detection.

## 2026-06-30: Agent Mutation Approval

Area: mutationApprovalPolicy, pending approval queue, MCP/HTTP write gating

Context: Sprint 10 added workspace/corpus mutation approval policy, the
`mutation_approval_requests` table, pending responses from MCP/HTTP write tools,
and operator approve/reject routes plus settings UI.

Learning: Default policy: append never, create/update/delete always.
Corpus `agentMutationApprovalPolicy` overrides workspace settings; `inherit` falls
back to workspace. Gated writes return `{ ok: false, pendingApproval: true,
approvalId, preview }` without mutating. Approve applies the stored request with
status transition pending → applied; reject leaves content unchanged. Approve/reject
requires `kb:write` when API auth is enforced.

Action: Set all actions to `never` in workspace settings for frictionless local dev.
Use `/settings/approvals` to review pending agent writes in standalone mode.

## 2026-06-30: Qdrant Vector Adapter and Ask Streaming

Area: VectorStore wiring, Qdrant optional backend, Ask SSE

Context: Sprint 11 introduced `PgVectorStore` and `QdrantVectorStore` behind
`EVUKB_VECTOR_BACKEND`, refactored indexing/search to use the shared `VectorStore`
contract, added `/health/vector-store`, and enabled Ask streaming over SSE for HTTP,
SDK, and Web UI.

Learning: Default backend remains pgvector with embeddings in Postgres. Qdrant stores
pointer-only payloads (`workspaceId`, `corpusId`, `chunkId`, `nodeId`, optional
`filePath`) in collections named `evukb_{model}_{dimensions}`; chunk bodies stay in
Postgres. Switching backends requires reindex. Ask stream emits SSE events
`metadata` → `token`* → `done` with event name `ask`. MCP ask stays non-streaming.

Action: Enable Qdrant with `docker compose --profile qdrant up` and
`EVUKB_VECTOR_BACKEND=qdrant`. Reindex corpora after switching backends. Use
streaming ask in UI or SDK `askWorkspaceStream`; fall back to JSON ask if SSE fails.

## 2026-06-30: HTTP Read Tools, Provider Overrides, OpenAPI SDK Types

Area: kb tools, AI providers, OpenAPI pipeline

Context: Sprint 12 unified MCP and HTTP read tools through `kb-tool-handlers.ts` and
`KbToolService`, added workspace AI provider overrides (`model`/`baseUrl` only in
`workspace.settings.aiProviders`), and committed OpenAPI spec + `openapi-typescript`
output under `packages/kb-sdk`.

Learning: HTTP read actions require `kb:read` (or `kb:write`); writes still require
`kb:write`. Read responses use `{ ok: true, action, result }`. Provider resolution
merges env API keys with workspace DB overrides for model/baseUrl; never persist keys
in workspace settings. `KbToolService` is wired after runtime construction via
`setRuntime()` to avoid circular init with `EvuKbRuntime`.

Action: Regenerate committed artifacts with `pnpm generate-openapi &&
pnpm generate-types` before merging OpenAPI route changes. CI `verify-dev` runs
`scripts/verify-openapi-sdk.ts` to catch drift.

## 2026-06-30: KnowledgeFilters on Search and Ask

Area: kb-core filters, SearchService post-filter, HTTP/MCP/SDK/UI parity

Context: Sprint 13 added optional `filters` on search, workspace search, ask, and
`POST /tools/kb` read actions. Dimensions are tags (any match, case-insensitive),
file type (`markdown`, `md`, mime strings), and OKF frontmatter `type`.

Learning: Filters apply after hybrid candidate merge by loading indexed node
metadata (`node.metadata.frontmatter` from index time). Vector hits have no node
metadata in the vector store, so semantic paths are post-filtered after
`listByIds`. When filters are active, search fetches `limit * 2` candidates before
ranking to reduce sparse results. Workspace isolation is unchanged—filters never
cross corpora or workspaces.

Action: Use Advanced filters on corpus/workspace search pages or pass `filters` in
SDK/MCP/API bodies. Unindexed nodes are excluded from search regardless of filters.
Defer path allowlist, arbitrary frontmatter fields, and indexed-status filters to a
follow-up sprint.

## 2026-06-30: KnowledgeFilters v2 and Agent Polish

Area: filter dimensions, SQL keyword pre-filter, tools/kb ask SSE, ranking registry, mount_authoritative spike

Context: Sprint 14 extended KnowledgeFilters with pathAllowlist, frontmatter fields,
sourceTypes, and indexStatus; added optional `JOIN knowledge_nodes` in keyword search;
Ask filter UI parity; SSE ask on `POST /tools/kb`; ranking strategy registry stub;
env-gated `mount_authoritative` sync mode.

Learning: Keep fileTypes post-filter only (mime/extension normalization stays in kb-core).
Use `filtersNeedSqlJoin` to decide keyword JOIN path; vector hits still post-filter.
Ranking registry resolves corpus/request strategy IDs and rejects unknown plugins early.
`mount_authoritative` deletes managed files not present in the latest mount scan—enable only
with `EVUKB_ENABLE_MOUNT_AUTHORITATIVE=true`.

Action: Pass extended `filters` on search/ask/tools/MCP. Use `askKbToolStream` for agent SSE.
Set env flag before selecting mount_authoritative in corpus sync settings. Only
`hybrid_default_v1` ranking is active until future strategies ship.

## 2026-06-30: Mount Authoritative UI and Ranking Strategies

Area: mount sync polish, ranking registry retrieval legs, settings boot hints

Context: Sprint 15 added mount mode UI on corpus create/edit, `bootHints.mountAuthoritativeEnabled`,
`mount_authoritative` integration test, and activated `semantic_only` + `keyword_only` ranking
strategies with corpus/workspace strategy selection UI.

Learning: Ranking strategies carry a `retrieval` profile (`keyword` / `semantic` booleans).
SearchService skips retrieval legs accordingly; `semantic_only` rejects when no embedding provider
is configured. Strategy resolution order: request → corpus column → workspace
`settings.rankingStrategyId` → default. Ask retrieval traces read `ranking.strategyId` from search
hits, not a SearchService stub. Mount authoritative UI must gate on boot hint—server rejects
`mount_authoritative` without `EVUKB_ENABLE_MOUNT_AUTHORITATIVE=true`.

Action: Enable env flag and confirm boot hint before offering authoritative mount mode. Pick
ranking strategy on corpus overview or workspace ranking settings. Use `keyword_only` when
embeddings are unavailable; `semantic_only` requires a healthy embedding provider.

## 2026-06-30: Ranking Strategies v2 and Search/Ask OpenAPI Parity

Area: recency_boosted/citation_boosted strategies, OpenAPI settings/search/ask contracts, search/ask UI

Context: Sprint 16 registered `recency_boosted` and `citation_boosted` (hybrid retrieval with
strategy-default boost weights), documented bootHints/availableStrategies/rankingStrategyId in
OpenAPI, aligned kb-sdk search/ask types, and added per-query strategy override on search/ask UI.

Learning: Named boost strategies apply defaults via `??` in rank wrappers so workspace/corpus/request
overrides still win. Ask `rankingStrategyId` must pass through `ask()` → `askCorpora()` →
`searchAcrossCorpora`. Search/ask UI uses empty string for inherit; only send override when set.
OpenAPI settings response schema documents runtime shape returned by settings routes.

Action: Use recency_boosted/citation_boosted for OKF or freshness-heavy corpora. Override strategy
per query on search/ask pages. Regenerate OpenAPI after contract changes; biome ignores generated SDK paths.

## 2026-06-30: Agent Tool Parity and MCP Filters v2

Area: MCP evu.kb.search/ask, POST /tools/kb, kb-core SearchToolRequest/AskToolRequest

Context: Sprint 17 extended MCP filter schemas to full KnowledgeFilters v2 (pathAllowlist, frontmatter,
sourceTypes, indexStatus) and added rankingStrategyId (plus rankingSettings on search) to agent tools,
MCP tools, OpenAPI /tools/kb, and kb-sdk kb-tools types.

Learning: Shared MCP zod schemas live under kb-server `mcp/schemas/` to keep search/ask tools aligned.
Handler pass-through must cover kb-tool-routes ask SSE and workspace POST /search (corpus search already
had rankingStrategyId). Validate unknown rankingStrategyId in kb-tool-handlers via registry.resolve.
Resolution order unchanged: request → corpus → workspace → default.

Action: Agents can pass v2 filters and ranking overrides on MCP and POST /tools/kb. Use rankingSettings
on search tool only (ask matches HTTP — strategy id without per-ask weight overrides).

## 2026-06-30: reranker_llm, kb-db Filter JOIN Test, import_writeback Spike

Area: ranking registry postRank, SearchService LLM rerank, kb-db integration test, mount writeback

Context: Sprint 18 registered `reranker_llm` (`postRank: 'llm'`) with hybrid retrieval and ChatProvider
reorder in SearchService, added kb-db integration coverage for `searchKeyword` SQL JOIN filters, and
shipped an env-gated `import_writeback` mount mode spike via MountWritebackService + FileManager hook.

Learning: Keep LLM rerank logic in kb-server (`llm-reranker.ts`); kb-core only marks strategies with
`postRank: 'llm'`. `reranker_llm` requires chat provider like `semantic_only` requires embeddings.
Writeback mirrors managed saves only; no delete sync or conflict policy in the spike. Gate
`import_writeback` with `EVUKB_ENABLE_IMPORT_WRITEBACK=true` and mount allowlist validation.

Action: Use `reranker_llm` when chat is configured. Enable writeback env + boot hint before selecting
import_writeback. Run kb-db integration tests with `EVUKB_DATABASE_URL` set.

## 2026-06-30: import_writeback v1, Qdrant Hardening, Docs Hygiene

Area: mount writeback delete sync, Qdrant integration/parity tests, README/SPEC cleanup

Context: Sprint 19 promoted `import_writeback` from spike to v1 with managed delete propagation
(`maybeDeleteWritebackManagedFile`), documented KB-wins conflict policy in kb-core, added
`describeIfQdrant` integration and pgvector/Qdrant semantic parity tests, refreshed README env docs,
and added reranker_llm integration coverage with a reversing chat mock.

Learning: Extract shared writeback target resolution in MountWritebackService for save/delete parity.
Qdrant parity tests seed deterministic 1536-dim unit vectors via ChunkRepository + Qdrant upsert;
skip when `EVUKB_QDRANT_URL` is unset. Remove shipped features from SPEC §33 deferred list.

Action: Enable `EVUKB_ENABLE_IMPORT_WRITEBACK=true` for writeback corpora. Run Qdrant tests with
`docker compose --profile qdrant up -d qdrant` and both `EVUKB_DATABASE_URL` + `EVUKB_QDRANT_URL`.

## 2026-06-30: Mount Sync Hardening, Ask/Rerank Polish, Docs Hygiene

Area: mount_authoritative integration test, writeback drift stats warnings, ranking golden fixtures,
ask reranker_llm coverage, SPEC/README P2 status

Context: Sprint 20 added mount_authoritative integration coverage, corpus stats warnings when
import_writeback managed files differ from mount mirror, golden ranking fixtures in kb-core tests,
stronger llm-reranker prompts with filePath, ask-path reranker_llm integration test, and SPEC §31/§33
hygiene (P2 standalone complete, Qdrant support decision).

Learning: Writeback drift detection belongs in CorpusStatsService with mountAllowlist injection;
comparison helpers stay pure in kb-core. Ask already forwards rankingStrategyId — add integration
tests for rerank trace. Golden fixtures live under `packages/kb-core/test/fixtures/ranking-golden.ts`.

Action: Check corpus stats warnings after external mount edits on writeback corpora. Use golden
fixtures when changing ranking strategy behavior.

## 2026-06-30: Qdrant Verify Script, Golden Fixtures for Citations/OKF/Links

Area: verify-qdrant script, kb-core golden fixture suites, README optional CI notes

Context: Sprint 21 added `scripts/verify-qdrant.ts` with env gate, Qdrant health preflight, and
targeted vitest for Qdrant integration/parity tests (not wired into default `verify-dev`). Expanded
golden fixtures under `packages/kb-core/test/fixtures/` for links, OKF validation/classification,
and citations (OKF extraction, URL policy, deriveAskCitations).

Learning: Keep Qdrant verification opt-in so default gates pass without the compose profile.
Golden fixture pattern mirrors `ranking-golden.ts`: typed case arrays + dedicated `*-golden.test.ts`
iterators. Workspace isolation golden remains future work.

Action: Run `make verify-qdrant` when Postgres and Qdrant are up. Add golden cases when changing
link resolution, OKF validation, or citation extraction behavior.

## 2026-06-30: CI and Honest DB Test Gates

Area: CI, integration tests, pg-boss diagnostics

Context: P3 hardening added GitHub Actions CI, `pnpm test:ci`, and a DB test
preflight so Postgres-backed suites fail fast in CI instead of silently skipping.

Learning: Running the previously optional DB suites exposed stale fixtures and a
pg-boss schema drift bug. `POST /tools/kb` must be classified as a read-capable
HTTP route before the tool route enforces per-action write scopes. pg-boss v12
uses `completed_on`, not `completedon`, in `pgboss.job`. File fixtures should
create parent folders before using nested paths, or use root paths when folder
behavior is not under test.

Action: Use `pnpm test:ci` with `EVUKB_DATABASE_URL` for release gates. Keep
local `pnpm test` warning when DB suites skip, and prefer out-of-band API-key
seeding in auth-required integration tests.

## 2026-06-30: Sprint 22 (of ~28) Isolation, Deploy, And SDK Parity

Area: workspace isolation golden tests, production Web proxy, SDK mutation methods

Context: Sprint 22 (of ~28) added isolation golden fixtures in kb-core, a cross-surface
integration matrix in kb-server (HTTP, indexed search/ask, MCP, tools/kb), production
Web same-origin `/api` proxy via Vite preview + `EVUKB_API_PROXY_TARGET`, and SDK
`deleteCorpus` / `renameNode` / `moveNode` / `deleteNodes` parity with OpenAPI.

Learning: Enable `EVUKB_REQUIRE_API_KEY` only after seeding isolation fixtures so
unauthenticated setup routes stay reachable. MCP `get_document` cross-workspace denial
surfaces as `node_not_found`, not `corpus_not_found`. Fixed-name `local-dev` corpus
fixtures in integration tests flake when the dev workspace accumulates data—prefer
`randomUUID()` suffixes for corpus names.

Action: Run isolation golden integration tests in CI via `pnpm test:ci`. For production
compose, rely on `EVUKB_API_PROXY_TARGET` rather than runtime `VITE_*` env on the Web
container. Regenerate OpenAPI types when adding SDK client methods.

## 2026-06-30: Sprint 23 (of ~27) Security, Config, And Telemetry Foundations

Area: security invariant tests, env/auth docs, usage telemetry schema and index recording

Context: Sprint 23 (of ~27) added portable zip limits, blob symlink escape checks,
security invariant unit tests, aligned `.env.example`/README/SPEC with `EVUKB_CHAT_*`
env names, documented headless API-key auth in `docs/AUTH.md`, defined
`OperationUsage`/`UsageRecord` in kb-core, `usage_records` migration in kb-db, and
records embed usage from index jobs when a provider is configured.

Learning: Citation validation blocks private IPs before fetch (status `blocked`);
timeouts surface as `unreachable`, not `error`. Blob store symlink escapes must be
checked on read via `realpath`, not only on write. Portable zip limits belong in
kb-core constants and are enforced in `portable-service` before extraction.

Action: Wire `UsageRecordRepository` through server bootstrap. Ask/rerank usage and
HTTP/UI diagnostics remain P3-12/COST-3–6 backlog. Run security invariant tests in CI.

## 2026-07-01: Sprint 27 (of ~27) Embeddable Server And Git Writeback Design

Area: `@evu/kb-server` embedding guide, SYNC-5 git writeback design acceptance

Context: Sprint 27 (of ~27) added [`docs/EMBED.md`](./EMBED.md) for in-process
`createEvuKbServer` bootstrap, lifecycle/shutdown, auth, env, and MCP on the same
Fastify instance; optional embed contract test in kb-server. Accepted git writeback
design in [`docs/GIT-WRITEBACK.md`](./GIT-WRITEBACK.md) with kb-core design golden
invariants; updated SPEC §20 pointer. SYNC-6 implementation remains open.

Learning: `EvuKbRuntime` is useful for advanced hosts but should stay experimental
until P3-10 documents package surfaces. Git writeback must stay separate from mount
`import_writeback` and fail closed on conflicts; env gate pattern matches existing
mount writeback. Design golden tests keep SYNC-6 scope honest without a database.

Action: Link EMBED.md from README/INTEGRATION. Run `packages/kb-core/test/git-writeback-design.test.ts`
when changing writeback design. Do not implement push/commit until SYNC-6 is scoped.

## 2026-07-01: Sprint 26 (of ~27) Graph Polish, A11y Baseline, And Backup Guide

Area: link-graph UX, accessibility regression tests, operator backup runbook

Context: Sprint 26 (of ~27) finished P3-13d with interactive graph nodes (click,
keyboard activation, edge legend, file deep-links), vitest-axe baseline coverage on
key operator surfaces, and [`docs/BACKUP.md`](./BACKUP.md) for Postgres, blobs,
secret inventory, optional Qdrant, portable export, and restore order.

Learning: SVG `role="img"` cannot contain focusable graph nodes — use `role="group"`
instead. jsdom a11y tests need `matchMedia`, `ResizeObserver`, and
`HTMLDialogElement.showModal` shims plus mocked kb-client data. Vitest include
pattern must cover `*.test.tsx` so kb-ui component tests actually run.

Action: Run `pnpm test apps/web/test/a11y` in CI. Expand a11y coverage page-by-page
only when regressions appear — baseline is not full WCAG certification. Keep backup
command examples aligned with `deploy/docker-compose.yml` volume names.

## 2026-07-01: Sprint 25 (of ~27) Integration Guide And UI Trace Polish

Area: consumer integration docs, trace diagnostics UI, frontmatter editor panel

Context: Sprint 25 (of ~27) added [`docs/INTEGRATION.md`](./INTEGRATION.md) covering
workspace mapping, auth/scopes, SDK quickstart, MCP Streamable HTTP at `/mcp`, and
`POST /tools/kb` action examples; shipped reusable fixtures under
`examples/integration/` with contract validation tests. Operator UI now shows
collapsible search ranking traces (including rerank `operationUsage`), Ask retrieval
diagnostics with stream `done` usage capture, and a markdown frontmatter side panel
synced with the CodeMirror body editor via `@evu/kb-core/okf/browser` exports.

Learning: When splitting frontmatter from the editor body, CodeMirror must edit the
body slice only or operators see duplicated YAML. MCP transport in SPEC §24 is stale;
integration docs should follow `register-mcp.ts` Streamable HTTP. kb-ui trace types stay
local to avoid pulling kb-core into the UI package.

Action: Link INTEGRATION.md from README and keep fixtures aligned with `kbReadActions`.
P3-13d graph polish and a11y tests remain open. Run `pnpm test
packages/kb-core/test/integration-fixtures.test.ts` when changing fixture shapes.

## 2026-07-02: Outer-agent MCP retrieval-first surfaces

Area: MCP tool routing, inventory APIs, metadata-only search, frontmatter indexing

Context: Cursor and other capable MCP clients were defaulting to `evu.kb.ask`, which
adds a redundant LLM hop and fails on Obsidian-style frontmatter inventory queries
(`os`, `hostname`, `virtual`) because chunk text excludes YAML frontmatter by default.

Learning: Prefer `evu.kb.search` and `evu.kb.list_documents` for outer agents; keep MCP
`ask` behind `EVUKB_MCP_ENABLE_ASK` (default false). Extend `list_documents` with
`pathPrefix`, `filters`, `fields`, and pagination for structured rollups. Allow empty
`search` queries when `filters` or `pathPrefix` scope metadata-only discovery
(`matchKind: metadata`). Refresh `metadata.frontmatter` on markdown save; optional
`EVUKB_INDEX_FRONTMATTER_SUMMARY=true` prepends a summary chunk at index time (requires
reindex). Document routing in [`docs/MCP-AGENT-GUIDE.md`](./MCP-AGENT-GUIDE.md).

Action: Point Cursor MCP setup at the agent guide. Use inventory tools for server/OS
rollups; parse version ranges client-side (filters stay exact/glob).

## 2026-07-01: Sprint 24 (of ~27) Usage And Cost Telemetry

Area: chat usage contract, Ask/rerank recording, usage HTTP/SDK, Diagnostics UI

Context: Sprint 24 (of ~27) extended `ChatCompletionResult` and stream `done` events
with optional token usage and latency, parsed from OpenAI-compatible SSE via
`stream_options.include_usage`. `AskService` and `SearchService` record `ask` and
`rerank` rows through `UsageRecordRepository`; responses expose non-secret
`operationUsage` on Ask answers and search ranking traces when LLM reranking ran.
Added `GET /usage/recent` and `GET /usage/summary`, SDK client methods, and a Usage
section on Diagnostics (7-day aggregate cards plus recent records table).

Learning: OpenAI streaming omits usage unless `stream_options: { include_usage: true }`
is set; the final SSE chunk carries `usage`, not token deltas. LLM reranking should
return usage alongside reordered hits so search can persist one row per rerank call
without a second provider request. Multi-corpus ask omits `corpusId` on usage rows when
more than one corpus is in scope.

Action: Regenerate OpenAPI after adding usage routes (`pnpm generate-openapi`). Usage
aggregate SQL groups by `operationType` with Drizzle `sum()`/`count()`; extend groupBy
only when new dimensions are needed. Cross-workspace usage access remains blocked by
existing workspace auth middleware on all workspace-scoped routes.

## 2026-06-30: Operator Console Design System And Files UX (P3-13a–c)

Area: kb-ui theme tokens, web shell, corpus file manager, CodeMirror editor

Context: Phase 1 replaced the centered light-only page shell with an operator-console
layout (sidebar, header, `--evukb-*` tokens, light/dark/system preference).
Phase 2 rewrote `CorpusFilesPage` with tree navigation (breadcrumbs, context menu,
drag/drop move) and a CodeMirror markdown editor (theme sync, status bar, Mod-s save).

Learning: `@uiw/react-codemirror` `onUpdate` receives `ViewUpdate`, not `EditorView`.
With `exactOptionalPropertyTypes`, pass `NavLink` `end` only when defined (conditional
spread). Node 22 exposes a broken experimental `localStorage` global in Vitest even
under `@vitest-environment jsdom`; theme tests must stub `window.localStorage`.
Deleting `dist/` without clearing `tsconfig.tsbuildinfo` makes `tsc` emit nothing while
exiting 0—`.dockerignore` already excludes `**/*.tsbuildinfo` for the same reason.

Action: Import `@evu/kb-ui/theme/tokens.css` and `components.css` from `apps/web`.
Use `window.localStorage` in browser theme code. Clear stale `*.tsbuildinfo` when
dist output disappears. P3-13d (frontmatter panel, trace panels, graph polish) remains
open on the roadmap.

## 2026-07-01: UI/UX Consistency Pass

Area: design-system CSS, route layout hierarchy, dark-mode token usage

Context: After the operator-console shell migration, screenshot review exposed recurring
visual drift: duplicate headings under tabs, wide content everywhere, unstyled page
classes, raw destructive buttons, and graph SVG colors that did not follow theme
tokens.

Learning: Keep common visual vocabulary in `@evu/kb-ui/theme/components.css`; reserve
`apps/web/src/styles.css` for app-specific visualizations and editor overrides. Route
layouts should own broad context titles, while corpus tabs should not repeat the active
tab as an `h2`. Use `Button` variants for semantic actions, and use `--evukb-*` tokens
for SVG/chart-like graphics.

Action: Audit new pages for missing class styles, raw action buttons, hard-coded colors,
and accidental `AppContent wide` usage before considering UI work complete.

## 2026-07-01: Tailwind + shadcn Design Migration

Area: Tailwind tooling, kb-ui primitives, token layer, theme switching, Biome CSS

Context: The hand-rolled `--evukb-*` plain-CSS system was replaced with a Tailwind +
shadcn-style system with shadcn HSL tokens (`:root` + `.dark`), rebuilt
`@evu/kb-ui` primitives (`Button` via CVA, `Card`, `Input`/`Textarea`/`Label`, `Switch`,
`Alert`, `Badge`/`StatusBadge`, `Table`, `AppShell`, `DetailTabs`), and `Switch` as the
default boolean control.

Learning:
- Monorepo Tailwind wiring: `apps/web` owns the Tailwind/PostCSS build and its
  `tailwind.config.js` `content` globs must include `../../packages/kb-ui/src/**/*.{ts,tsx}`
  so utility classes used inside kb-ui primitives are emitted. A Vite dev alias
  (`/^@evu\/kb-ui$/` → `packages/kb-ui/src/index.ts`) keeps HMR and class scanning
  reliable while the production `tsc -b` + package `exports` path still resolves `dist`.
- Theme switching moved from `data-theme` attribute to a `.dark` class
  (`darkMode: ['class']`); the `index.html` FOUC script and `applyDocumentColorScheme`
  both `classList.toggle('dark', …)`.
- Tailwind's `@tailwind base` preflight strips heading/link sizing, so raw page
  headings need base element styles in `@layer base`.
- Biome 2.5 CSS: set `css.parser.tailwindDirectives: true` to parse `@apply`, and turn
  off `suspicious.noUnknownAtRules` so `@tailwind` is accepted.
- `lucide-react` is at `1.x` (not `0.x`) — confirm exports rather than assuming a version.

Sandbox note: this workspace's pre-existing per-package `node_modules` are owned by a
different (namespaced) uid, so `pnpm --filter <pkg> add` fails on symlink creation. Adding
deps at the writable workspace root still resolves everywhere via Node's upward directory
walk; the consuming package manifests were updated by hand and Docker (`--frozen-lockfile=false`)
relinks them correctly.

Action: When touching shared UI, add classes through kb-ui primitives (scanned by Tailwind)
and keep the structural `.evukb-*` compatibility classes on HSL tokens in
`apps/web/src/styles.css` under `@layer components`. Prefer `Switch` for booleans and `Alert`
for banners. Vite dev aliases `@evu/kb-ui` and `@evu/kb-sdk` to package source; production
still builds through `dist/`, so run `pnpm --filter @evu/kb-sdk build` after SDK changes if
you are not using the dev server alias path.

## 2026-07-01: Docker Compose `.env` Not Loaded From Repository Root

Area: dev compose, AI provider env vars

Context: `make dev` runs `docker compose -f deploy/docker-compose.dev.yml up`. Compose
defaults the project directory to the compose file's folder (`deploy/`), so it looks for
`deploy/.env` — not the repository root `.env` that README documents. Interpolation like
`${EVUKB_EMBEDDING_API_KEY:-}` therefore stayed empty and the API container received blank
keys and default OpenAI base URLs, so AI Providers showed `not-configured` despite a valid
root `.env`.

Learning: Variable substitution uses the **project directory** `.env`, not necessarily where
the compose file lives. With `-f deploy/...`, you must pass `--project-directory .` from the
repo root (or place a separate `.env` under `deploy/`).

Action: All `package.json` compose scripts now use
`docker compose --project-directory . -f deploy/...`. Compose build contexts and bind mounts
in `deploy/docker-compose*.yml` must use `.` (repo root), not `..` — with
`--project-directory .`, `..` resolves to the parent of the repository and breaks Docker builds.
Pass auth and provider vars explicitly in `deploy/docker-compose.dev.yml` (`EVUKB_SECRETS_KEY`,
`EVUKB_TOKEN_PEPPER`, `EVUKB_*_API_KEY`, etc.); listing them is required for interpolation into
the API container even when they exist in root `.env`.
After changing env vars, recreate `evukb-api` so the container environment is refreshed.

## 2026-07-17: Sprint 30 (of ~32) Vector Tuning And Benchmarks

Area: F-5 pgvector/Qdrant scale guidance and opt-in latency benchmark

Context: Sprint 30 (of ~32) added [`docs/VECTOR-TUNING.md`](./VECTOR-TUNING.md),
`scripts/benchmark-vector-search.ts` (`pnpm benchmark:vector` /
`make benchmark-vector`), and explicit Qdrant HNSW defaults (`m=16`,
`ef_construct=100`) on collection create. Default schema still has no pgvector
ANN index; operators add HNSW via documented SQL when semantic latency grows.

Learning:
- `ChunkRepository` list/map paths omit embeddings, so benchmarks that also
  upsert to Qdrant must pass vectors at seed time rather than re-loading chunks.
- `CREATE INDEX … HNSW` belongs in operator runbooks (`CONCURRENTLY` on live DBs),
  not the default migration, so tiny installs stay light.
- Root scripts cannot import `@evu/*` or `@qdrant/*` by package name; use
  `packages/*/dist` (and `createQdrantVectorStore` / REST cleanup for Qdrant).
- `knowledge_chunks.embedding` is `vector(1536)`; `EVUKB_BENCHMARK_QUICK`
  only shrinks chunk counts. Non-1536 dims require the Qdrant backend path.
- Quote `EVUKB_SYNC_SCHEDULE_CRON` in `.env` (`'*/5 * * * *'`); unquoted `*/…`
  expands via the shell when sourcing and can set the cron to a random filename.
- With `EVUKB_MCP_DEV_TOKEN` set, MCP requires that bearer even when
  `EVUKB_ALLOW_OPEN_AUTH=true`. Host `pnpm test` against a polluted shell env
  (real embedding keys, MCP dev token, `EVUKB_QDRANT_URL` without Qdrant)
  produces false integration failures; prefer a minimal clean env for the suite.

Action: Link VECTOR-TUNING from ENV/DEVELOPMENT when discussing backends. Run
`pnpm build` then `EVUKB_BENCHMARK_QUICK=true pnpm benchmark:vector` after
Postgres is up; use `make verify-qdrant` for adapter parity, not the benchmark.

## 2026-07-17: Sprint 29 (of ~32) Git Writeback Implementation

Area: SYNC-6 git corpus writeback (commit/push jobs, mutability, operator UI)

Context: Sprint 29 (of ~32) implemented env-gated git writeback per
[`docs/GIT-WRITEBACK.md`](./GIT-WRITEBACK.md): `GitWritebackService`,
`evu-kb-git-writeback` jobs, corpus settings, git-file mutability when active,
fail-closed `writeback_blocked`, audit, and corpus overview controls.

Learning:
- Git import still uses shallow clone/`FETCH_HEAD`; writeback should create an
  explicit branch (`checkout -B`) before committing, especially feature branches
  `evukb/writeback/{corpusId}`.
- Default-branch commits must stay opt-in (`gitWritebackAllowDefaultBranch`) so
  operators are not surprised by pushes to `main`.
- Mutability for `sourceType=git` needs corpus+env context on both file-manager
  assert paths and `GET .../nodes` presentation; list routes must load corpus
  settings before attaching `mutability`.
- Enqueue writeback only after a successful KB save so agent approval continues
  to gate content that never lands in git.

Action: Set `EVUKB_ENABLE_GIT_WRITEBACK=true` only when operators need writeback.
Prefer feature-branch mode or scoped deploy keys. Run
`packages/kb-server/test/git-writeback-service.test.ts` and the git-writeback
integration suite when changing commit/push policy.

## 2026-07-01: Sprint 28 — Release Readiness (MIT, No Publish Yet)

Area: licensing, distribution policy, package surface documentation

Context: P3-1 and P3-10 closed the remaining P3 core items before optional P3-15
(public docs site). User constraint: MIT license, but **no npm publishing** until
explicit maintainer approval.

Learning:
- `"license": "MIT"` on root and all `@evu/kb-*` packages is separate from
  `"private": true`; SPDX metadata can be honest while registry publish stays off.
- `docs/PACKAGES.md` is the hub for supported `exports` paths; `docs/RELEASE.md`
  states distribution via git/Docker only and forbids publish CI without opt-in.
- `@evu/kb-server` stable embed surface is `createEvuKbServer` + options/health
  types; `EvuKbRuntime` and individual services remain experimental exports.
- A lightweight `package-surface.test.ts` in kb-core keeps `exports` keys aligned
  with PACKAGES.md without importing every package at runtime.

Action: Before any future npm release, update RELEASE.md, remove `private: true`
deliberately, and add chosen release tooling in a dedicated change — not ad hoc.

## 2026-07-01: Reusable KB UI extraction (`@evu/kb-ui` feature composites)

Area: `@evu/kb-ui`, `apps/web` route shells, F-2 decision

Context: Operator feature UIs (file manager, search, ask, links, graph) were
implemented as large pages in `apps/web` with partial kb-ui primitives. Goal:
embeddable composites without visual change.

Learning:
- **SDK-aware hooks** (`useCorpusFileManager`, `useAskStream`, `useLinkGraph`) accept
  `EvuKbClient` + `workspaceId`; pages keep routing/deep links only.
- **Navigation stays in apps** via render props (`renderViewGraphAction`,
  `renderCenterLinks`) — kb-ui must not import React Router.
- Co-locate feature CSS in `@evu/kb-ui/theme/components.css` (raw rules: graph,
  CodeMirror, viewport). Tailwind `@apply` layout for legacy `evukb-file-*` classes
  stays in the host app's `styles.css` inside `@layer components` — importing
  `@layer` CSS outside the Tailwind pipeline breaks Vite builds.
- `ColorSchemeProvider` moved to kb-ui so CodeMirror and host apps share theme context.
- Vite 8 / Rolldown resolves some `@codemirror/*` packages to `.d.ts`; alias them to
  `dist/index.js` via `apps/web/vite-codemirror.ts`, resolving from kb-ui's dependency
  graph with `createRequire` (not `apps/web/node_modules`, which is empty in Docker).
- `@evu/kb-ui` shell primitives (`AppShell`, `DetailTabs`) need `react-router-dom` as a
  peer + dev dependency so `tsc` succeeds in clean Docker installs.

Action: New operator features should land in kb-ui composites/hooks first; keep
`apps/web` pages as thin wiring shells. Document exports in `PACKAGES.md`.

## 2026-07-01: Corpus index status SSE (in-process hub)

Area: `@evu/kb-server`, `@evu/kb-sdk`, `@evu/kb-ui`, file manager, corpus overview

Context: File manager and corpus overview showed stale `indexStatus` while pg-boss
index jobs ran in the background. Ask already streams over SSE; there is no WebSocket
infrastructure in EvuKB.

Learning:
- **SSE fits notify-only feeds** (server → client index transitions). WebSockets add
  bidirectional complexity without benefit here.
- **`CorpusIndexEventHub`** is an in-process pub/sub keyed by workspace + corpus.
  `IndexService` and `FileManagerService` publish `{ nodeId, indexStatus,
  previousIndexStatus }` after status writes so clients can patch local state without
  refetching full node lists or stats.
- **Clients patch in place** via `patchNodeIndexStatus` and `patchIndexStatusCounts`;
  `useCorpusIndexEventSubscription` wraps the SDK stream with abort-on-unmount.
- **Multi-instance caveat:** the hub is process-local. Horizontal API scaling would
  need a shared pub/sub bridge (for example Redis) before SSE subscribers on different
  replicas receive all events.

Action: Prefer SSE for future server-push operator diagnostics. If API replicas are
added, replace or augment the in-process hub before relying on live index badges in
production multi-node deployments.

Follow-up (same day):
- **One SSE connection per corpus tab:** mount `CorpusIndexEventProvider` in
  `KnowledgeLayout` and fan out via `useCorpusIndexEventSubscription` listeners. Avoids
  duplicate streams when switching Overview ↔ Files.
- **Vite dev proxy:** disable buffering for `text/event-stream` responses (`cache-control`,
  `x-accel-buffering`) or SSE events arrive late/batched.
- **React update loops:** do not put `URLSearchParams` objects in effect deps (use
  `searchParams.get(...)` strings). Graph neighborhood loading must bail out when size
  unchanged and when the same node/depth is already in flight. Overview stats patches
  must return the previous state object when counts are unchanged. CodeMirror status bar
  updates must compare before `setState` and ignore view updates that only reconfigure.
- **kb-sdk dev resolution:** never commit compiled `*.js` / `*.d.ts` under
  `packages/kb-sdk/src/`. Vite aliases `@evu/kb-sdk` to `src/index.ts`, but TypeScript
  import specifiers use `.js` extensions — stale `src/client.js` shadows `client.ts` and
  drops methods like `subscribeCorpusIndexEvents`. Output belongs in `dist/` only.

## 2026-07-02: Dev Compose Frozen Lockfile After Manual package.json Edits

Area: `make dev`, docker-compose.dev.yml, pnpm lockfile

Context: Dev compose sets `CI=true`, so container startup runs `pnpm install` with
frozen lockfile. Editing a workspace `package.json` by hand (for example adding
`fflate` to `apps/web/package.json`) without updating `pnpm-lock.yaml` makes both
`evukb-api` and `evukb-web` exit immediately with `ERR_PNPM_OUTDATED_LOCKFILE`.

Learning:
- Image build already uses `--frozen-lockfile=false`; runtime install did not.
- Host `node_modules` owned by Docker can make a full host `pnpm install` fail with
  `EACCES`; use `--lockfile-only` to sync the lockfile without touching modules.
- `pnpm install --frozen-lockfile --lockfile-only` is a reliable drift check that
  ignores host install permission issues.

Action:
- `scripts/ensure-lockfile-sync.sh` runs before `pnpm run dev` / `up` and refreshes
  the lockfile when drift is detected.
- Dev compose service commands use `pnpm install --no-frozen-lockfile` so containers
  can still install if the preflight step was skipped.

## 2026-07-01: Generic Archive Import Detection

Area: corpus import, portable `.evukb`, legacy zip/tar uploads

Context: Operators wanted to import non-portable archives (Obsidian vault zips, GitHub
downloads) into a new corpus with the same folder layout as the source archive, while
keeping portable `.evukb` import semantics unchanged.

Learning: After unzip, detect portable format via `.evukb/manifest.json`. If absent, apply
two heuristics before generic tree import: (1) unwrap when the archive contains exactly one
inner `.evukb`/`.zip` portable file, (2) strip a single shared top-level folder when every
entry lives under it and there are no root files. Generic import creates **managed** nodes
(editable) and uses the same zip-bomb entry/byte limits as portable import. Client-side
`.gz`/`.tar.gz` normalization only repacks to zip for transport; detection and tree import
run server-side on `POST …/import`.

Action: Extend `POST …/import` (do not add a second endpoint). Return `mode:
'portable' | 'archive'` so UI can omit link-restore stats for generic imports. Document
`EVUKB_MAX_UPLOAD_BYTES` for large legacy archives. Autostrip `.git/` zip entries before
import and surface a warning count in the import result.

## 2026-07-02: Self-Hosted Embedding Limits (llama.cpp)

Area: indexing, embeddings, diagnostics

Context: Failed index jobs showed `Embedding request failed with status 500` from a
self-hosted llama.cpp server (`--embeddings`, `--pooling mean`). The API body reported
`input (589 tokens) is too large to process` with default physical batch size 512 (`-ub
512`), even though EvuKB chunk token estimates were lower. After raising `-b`/`-ub`, jobs
failed with HTTP 503 and body `no available server` when the upstream llama-server was
down or overloaded.

Learning:
- `-c` (context size) is not the same as `-ub`/`--ubatch-size` (physical batch size). For
  embedding mode, set `-b` and `-ub` to the same value and keep both above the longest
  chunk the corpus produces.
- EvuKB sends all markdown chunks for a file in one or more `/embeddings` calls; a single
  oversized code block can fail the whole file index.
- A 503 with `no available server` usually means the reverse proxy has no healthy
  llama-server backend (crashed after config change, OOM, or all slots busy with `-np 2`).

Action: Batch embedding requests in `OpenAiEmbeddingProvider` via
`EVUKB_EMBEDDING_BATCH_SIZE` (default 8), retry transient failures with
`EVUKB_EMBEDDING_MAX_RETRIES`, and include the response body in error messages. For
strict self-hosted servers, use `EVUKB_EMBEDDING_BATCH_SIZE=1` and ensure llama-server is
healthy before retrying failed jobs.

## 2026-07-02: Shared Dev Database Breaks Integration Tests (pg-boss Workers)

Area: test infrastructure, pg-boss, integration suite

Context: During the project-review fix pass, `kb-server` integration tests failed
intermittently with `TypeError`s and assertion errors when run against the same
PostgreSQL instance the dev compose stack uses. The running dev API's pg-boss workers
consumed jobs that tests enqueued (and vice versa), so index jobs "vanished" and
`waitForJobIdle` raced.

Learning: pg-boss queues are named globally per database, so any other process with
workers on `evu-kb-*` queues silently competes with test runs. This also means two
concurrent local test runs can interfere with each other's jobs, though full-suite runs
were stable in practice because tests create isolated workspaces.

Action: Run the suite against a dedicated throwaway Postgres (e.g. a
`pgvector/pgvector:pg17` container on port 5434) via
`EVUKB_DATABASE_URL=postgres://evukb:evukb@localhost:5434/evukb pnpm test`. Never point
tests at the dev compose database while `make dev` is up.

## 2026-07-02: In-Place tsc Emit Shadows .ts Sources in Vitest

Area: test infrastructure, coverage, TypeScript build

Context: A stray tsc invocation emitted `.js`/`.d.ts`/`.map` files directly into
`packages/kb-core/src/` (they are gitignored, so invisible in `git status`). kb-core
tests import sources as `../src/foo.js`, and Vite resolves that to a real `foo.js` when
one exists — so tests silently executed the stale emitted JS instead of the current
`.ts` sources. It also inflated the v8 coverage report: the `.map` files crashed the
uncovered-file pass (PARSE_ERROR), which dropped never-imported files from the
denominator and reported ~73% when the true number at the time was lower.

Learning: With NodeNext-style `.js` import specifiers, any in-place emit shadows the
TypeScript sources for every Vitest run. Coverage `include` globs must be restricted to
`**/*.{ts,tsx}` (plus a `**/*.d.ts` exclude) or artifacts get parsed as source.

Action: If test behavior or coverage numbers look inexplicably stale or inflated, run
`find packages/*/src -name "*.js" -o -name "*.map"` and delete any hits. Never run bare
`tsc` inside a package; use the package build script (outDir dist).

## 2026-07-02: Sharing Types Between kb-server and kb-sdk via kb-core

Area: package boundaries, typed errors

Context: The review asked to share `ApiErrorCode` between the server's `ApiError` and
the SDK's `EvuKbApiError` so clients can switch on stable error codes. kb-sdk must stay
client-only and previously had zero workspace dependencies.

Learning: A type-only import from `@evu/kb-core` is erased at compile time, so kb-sdk
can depend on kb-core for shared contract types without pulling Node-specific runtime
code into browser bundles. The kb-sdk `tsconfig.json` needed a project `references`
entry for kb-core, or `tsc --build` fails with TS6059/TS6307 rootDir errors when the
path alias resolves to kb-core sources. Type the SDK's code field as
`ApiErrorCode | (string & {})` so unknown codes from newer servers still parse.

## 2026-07-03: F-1 Memory Banks — Out Of Scope

Area: product boundary, agent writes, host integration

Context: Brainstorm on whether full memory banks belong in EvuKB (ROADMAP F-1).
Standalone EvuKB does not need cross-session agent memory. Host platforms own run
lifecycle and memory injection. A separate EvuMemory project remains an option if
memory infrastructure is needed later.

Decision:
- Memory banks are **not** in EvuKB; knowledge-only mission unchanged.
- `agent-notes/` remains the only agent write path today (`assertAgentNotesPath`).
- Operators can isolate agent writes in a dedicated corpus (e.g. vault synced via mount/git).
- Standalone and embedded deployment are equally valid; combined vault + agent host is a supported pattern.

Roadmap follow-ups:
- **AGENT-1:** workspace + corpus settings for including `agent-notes/` in Ask/search (default true).
- **AGENT-2:** path ACLs so agents can CRUD approved paths outside `agent-notes/`.
- Per-agent workspace isolation needs operational testing before ACL scoping.

Action: Updated `SPEC.md` §16 and §31, `docs/ROADMAP.md`, `docs/DEVELOPMENT.md`,
`docs/INTEGRATION-HOST-SHAPES.md`.

## 2026-07-03: F-4 Ranking Strategy Plugin API

Area: ranking registry, kb:admin auth, operator plugin reload

Context: Shipped mutable `RankingStrategyRegistry`, `PostRankHandlerRegistry`, kb:admin-gated
plugin routes, unregister remediation, and `examples/custom-ranking-strategy/`.

Learning:
- Keep `kb:write` agent-only; plugin admin uses separate `kb:admin` scope.
- Corpus `ranking_strategy_id` is NOT NULL — uninstall remediation sets corpora to workspace
  fallback (or `hybrid_default_v1` when workspace default was the removed strategy).
- Custom `rank()` cannot be JSON-registered; presets and allowlisted `importPath` only.
- `examples/custom-ranking-strategy/` splits preset (`boost_agent_notes_v1`) and custom
  `rank()` (`prefer_docs_prefix_v1`) with golden tests under `examples/**/test/` included
  in root Vitest.
- In-memory registry reload is per API process; multi-replica deploys need rolling restart or
  boot-time registration.

Action: See `packages/kb-core/src/search/ranking-registry.ts`,
`packages/kb-server/src/services/ranking-strategy-plugin-service.ts`, `docs/EMBED.md`.

---

Area: display preferences, timestamp formatting

Context: Ported 02m8-style per-browser display prefs instead of server `EVUKB_DISPLAY_*` env vars.

Learning:
- Web UI timestamps use `DisplayPreferencesProvider` + `formatDateTime()` (`Intl`) in
  `@evu/kb-ui`; prefs live in `localStorage` (`evukb_display_preferences`) with per-field
  **System setting** default.
- Docker Compose `TZ` (default `UTC`) is separate: it affects container logs and server-side
  `Date`, not how the browser renders ISO timestamps from the API.
- Prefer `useFormatDateTime()` over scattered `toLocaleString()` so operator prefs apply
  consistently across pages and `CorpusMultiSelect`.

Action: See `packages/kb-ui/src/display/`, Settings → Preferences route, `docs/ENV.md`.

---

## 2026-07-04: AGENT-1 + AGENT-2 — Retrieval Toggle And Write Path ACLs

Area: agent writes, search, credentials, settings

Context: ROADMAP AGENT-1/2 shipped in one sprint after P3-15 API reference.

Decision:
- **AGENT-1:** `includeAgentNotesInRetrieval` on workspace (default true) and optional
  corpus override; `SearchService` filters chunk hits via `shouldIncludePathInRetrieval`
  after existing knowledge filters.
- **AGENT-2:** `agentWritePathPrefixes` on workspace (default `['agent-notes']`), optional
  corpus narrowing, optional `write_path_prefixes` on API keys and MCP tokens; effective
  prefixes use restrictive intersection in `resolveAgentWritePathPrefixes`.
- `AgentWriteService` loads workspace + corpus settings and credential record per write.

Learning:
- Keep ACL resolution in `AgentWriteService` rather than duplicating checks in MCP and HTTP
  routes — both call the same service.
- Corpus prefix validation needs workspace settings at PATCH time; `corpus-routes` loads
  workspace before `validateCorpusSettings`.
- Credential `writePathPrefixes` stored as jsonb; omit/null means inherit all workspace
  prefixes for that token.

Action: See `packages/kb-core/src/agent-retrieval/`, `packages/kb-core/src/agent-write/path-policy.ts`,
  migration `0004_credential_write_path_prefixes.sql`, workspace/corpus/credential UI settings.

---

## 2026-07-06: Biome And Generated API Reference HTML

Area: CI, lint

Context: `pnpm lint` failed with ~900 diagnostics from `docs/api/index.html` (Redocly output).

Learning: Generated API reference HTML is not source code; Biome a11y rules do not apply.
Exclude `docs/api` in `biome.json` alongside `packages/kb-sdk/openapi` and generated SDK types.

Action: Run `pnpm lint` before every push; regenerate API docs with `pnpm api-docs` when needed,
  not as part of routine lint fixes.

---

## 2026-07-18: Evu Theme Adoption In kb-ui

Area: UI theme / tokens

Context: Applied shared Evu Theme (`imevul/evu_theme`) to EvuKB via `@evu/kb-ui`
`tokens.css` + shell chrome. Surfaces stay neutral; signature indigo primary is
reserved for active nav, CTAs, switch-on, focus, and tab underlines. Links use
`--secondary`.

Learning:
- Prefer a single token source in `packages/kb-ui/src/theme/tokens.css`; apps
  consume it and map Tailwind colors — do not keep a second conflicting palette
  in `apps/web`.
- Dual-read `evu-color-scheme` with legacy `evukb-color-scheme` during migration;
  FOUC in `index.html` must check both and set `data-evu-palette`.
- Keep graph-specific channels (`--graph-node*`) as extensions on the Evu base.

Action: When restyling sibling Evu apps, follow `evu_theme/APPLY.md` path B and
  preserve each app’s shell IA (sidebar vs topnav).

---

## 2026-07-18: Evu Theme Elevated Outline Buttons

Area: UI theme / buttons

Context: Latest `evu_theme` made outline/default buttons elevated `--card` chips
so they stay distinct from recessed `bg-background` input wells and badges inside
`muted/55` fieldsets. Transparent-on-panel secondary actions looked like holes.

Learning: Keep `Button` `default`/`outline`/`dangerOutline` on `bg-card` with a
foreground-tinted border + light shadow; reserve `ghost`/`quiet` for chrome only.
Nested action groups must use `bg-muted/55` (not `/20`) — otherwise card-fill
buttons match the group and look flat in dark mode.

Action: Sync `@evu/kb-ui` `buttonVariants` and `.evukb-file-input-label` when
pulling theme updates; grep for `bg-muted/20` on panels that host outline buttons.
