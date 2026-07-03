# EvuKB Roadmap

> Companion to [`SPEC.md`](../SPEC.md). This is the durable "what shipped and
> what remains" record for EvuKB. Each task should be small enough for one
> focused implementation session unless it is explicitly marked as a phase gate
> or backlog area.
>
> **Status convention**: `[X]` means landed in the repository. `[ ]` means open.
> If a task is split or partially delivered, keep the parent open and record what
> shipped in the task note. When a change ships, splits, removes, or reschedules a
> roadmap line, update this file in the same change.

## Phase Legend

- **P0 - Foundation**: bootable monorepo, storage, corpus CRUD, file manager, and
  searchable markdown.
- **P1 - Standalone KB product**: ask, links, OKF, sync, settings, diagnostics,
  tokens, and operator UI.
- **P2 - Advanced standalone features**: approvals, multi-corpus workflows,
  Qdrant, ranking strategy expansion, portable import/export, and agent/API
  parity.
- **P3 - Hardening and ecosystem**: release readiness, CI, security hardening,
  package publishing, generic consumer integration guidance, usage/cost
  telemetry, and production deploy polish.
- **Future**: larger scale tuning, backup/restore, richer embeddable UI, agent write
  ACL expansion, and features that intentionally remain outside v1.

---

## P0 - Foundation

Goal: a developer can run the stack, create a corpus, add markdown files, index
chunks, and search them through API/UI surfaces.

| ID | Task | Status |
| --- | --- | --- |
| P0-1 | Repository scaffold: pnpm workspaces, TypeScript project refs, Biome, Vitest, Docker Compose, Make targets, package/app skeletons | [X] |
| P0-2 | `@evu/kb-core` domain contracts for workspace scope, corpora, nodes, chunks, links, citations, search, ask, sync, storage, and settings | [X] |
| P0-3 | `@evu/kb-db` schema, Drizzle migrations, pgvector/pgcrypto setup, workspace-scoped repositories | [X] |
| P0-4 | Local filesystem blob store with workspace/corpus refs and path traversal defenses | [X] |
| P0-5 | Corpus CRUD and managed file API: folders, file create/upload/read/save/rename/move/delete | [X] |
| P0-6 | Markdown pipeline: frontmatter parse, heading-aware chunking, previews, markdown/wikilink/autolink extraction | [X] |
| P0-7 | Indexing and hybrid search: Postgres FTS, pgvector storage, chunk persistence, corpus stats refresh | [X] |
| P0-8 | Minimal Web UI for corpus list, files, and search | [X] |
| P0-9 | MCP read tools for corpora, documents, search, chunks, links, and ask | [X] |
| P0-10 | Quality gate baseline: build, typecheck, lint, unit tests, compose config validation | [X] |

---

## P1 - Standalone KB Product

Goal: EvuKB is useful as a single standalone knowledge product for humans and
agents, with core operator controls and KB/RAG workflows.

| ID | Task | Status |
| --- | --- | --- |
| P1-1 | Ask/RAG API with citations and retrieval traces, plus non-streaming SDK/UI flows | [X] |
| P1-2 | Link graph service, file link panels, corpus graph/neighborhood API, MCP graph tool, and Web graph tab | [X] |
| P1-3 | API keys and MCP tokens with hashed secrets, workspace scope, read/write scopes, settings UI, and auth tests | [X] |
| P1-4 | Corpus stats, index-status diagnostics, reindex-needing workflow, and operator actions | [X] |
| P1-5 | Audit log repository/API/UI for human and agent mutations | [X] |
| P1-6 | OKF v0.1 validation, strict mode, convert-to-OKF, export, index/log maintenance, read_index/list_concepts tools | [X] |
| P1-7 | pg-boss jobs for indexing, corpus reindex, OKF maintenance, citation validation, mount sync, git sync, and scheduled sync tick | [X] |
| P1-8 | OKF citation URL extraction, SSRF-safe validation policy, validation job, and metadata persistence | [X] |
| P1-9 | Mount sync import mode with allowlist and per-file mutability; git sync import mode with server-side cache and secret-backed credentials | [X] |
| P1-10 | Workspace settings, AI provider display/overrides, secrets CRUD/rotation, health probes, failed-job diagnostics, and settings UI | [X] |
| P1-11 | HTTP API-key middleware for production/API-key mode, read/write classification, and workspace scope enforcement | [X] |
| P1-12 | Portable `.evukb` export/import plus generic zip/tar archive import (auto-detect, path validation, operator UI) | [X] |

---

## P2 - Advanced Standalone Features

Goal: complete the advanced standalone KB feature set without coupling EvuKB to
host automation or generic platform runtime concepts.

| ID | Task | Status |
| --- | --- | --- |
| P2-1 | Extended `KnowledgeFilters` across HTTP, MCP, SDK, `POST /tools/kb`, corpus search/ask, and workspace search/ask | [X] |
| P2-2 | Workspace-level multi-corpus search and ask with deterministic merge semantics and UI flows | [X] |
| P2-3 | Ranking strategy registry with `hybrid_default_v1`, `keyword_only`, `semantic_only`, `recency_boosted`, `citation_boosted`, and `reranker_llm` | [X] |
| P2-4 | Search/ask ranking overrides, workspace/corpus ranking settings, boost goldens, and OpenAPI/SDK parity | [X] |
| P2-5 | Agent write tools and `POST /tools/kb` write mirror with audit, capability checks, and `agent-notes/` policy | [X] |
| P2-6 | Mutation approval policy, pending approval queue, approve/reject API, MCP/HTTP pending responses, and settings UI | [X] |
| P2-7 | Ask streaming over SSE for HTTP, SDK, Web, and `POST /tools/kb` | [X] |
| P2-8 | Optional Qdrant vector backend behind the same `VectorStore` contract, pointer-only payloads, health probe, and parity verification script | [X] |
| P2-9 | Mount sync `import_writeback` with managed save/delete mirroring, drift warnings, and env gate | [X] |
| P2-10 | Mount sync `mount_authoritative` with env gate, managed-file deletion pass, and integration coverage | [X] |
| P2-11 | Golden fixture pattern for ranking, links, OKF, and citation extraction behavior | [X] |
| P2-12 | OpenAPI spec generation, generated SDK types, and drift verification script | [X] |

### P2 Notes

- Git sync is import-only in P2. Git-sourced files are read-only in EvuKB, and
  writeback to a git repository is not implied by mount writeback.
- Prior internal implementations have been used as a reference, but
  host-specific adapter code is not an EvuKB deliverable.

---

## P3 - Hardening And Ecosystem

Goal: prepare EvuKB for reliable standalone use, generic remote-service
integration, and optional npm/package consumption.

| ID | Task | Status |
| --- | --- | --- |
| P3-1 | Finalize project license, package versions, publishability metadata, and OSS release policy | [X] |
| P3-2 | Add CI for lint, typecheck/build, unit tests, DB integration tests, OpenAPI/SDK drift, compose validation, and optional Qdrant verification | [X] |
| P3-3 | Make default test gates honest: run Postgres-backed integration tests in CI and fail or warn loudly when release-blocking suites are skipped | [X] |
| P3-4 | Add workspace isolation golden coverage across HTTP, service, DB, vector, blob, MCP, and tool surfaces (note: shipped as kb-core golden fixtures plus an HTTP-level integration golden in kb-server; there are no dedicated vector- or SQL-layer isolation goldens) | [X] |
| P3-5 | Add security invariant tests for symlink escapes, upload limits, markdown sanitization, zip bomb limits, binary indexing policy, and citation validation timeouts (note: markdown sanitization is only tested in `kb-ui` markdown-safety tests) | [X] |
| P3-6 | Align documented env/config with implementation, including provider env names, embedding dimensions, ranking defaults, and full settings precedence (note: initial alignment was incomplete; the consolidated code-verified reference now lives in [`docs/ENV.md`](./ENV.md)) | [X] |
| P3-7 | Implement or explicitly defer standalone human auth: local password login, browser API-key flow, or documented headless/API-key-only mode | [X] |
| P3-8 | Fix production Web/API deployment so static assets can reliably reach the API without relying on runtime-only Vite env values | [X] |
| P3-9 | Complete SDK coverage for all stable OpenAPI operations, including corpus delete and node rename/move/bulk delete | [X] |
| P3-10 | Narrow and document public package surfaces for `@evu/kb-core`, `@evu/kb-server`, `@evu/kb-sdk`, and `@evu/kb-ui` | [X] |
| P3-11 | Add generic consumer integration guide: workspace mapping, token scopes, MCP `/mcp` transport, `POST /tools/kb`, SDK examples, and OpenAPI examples | [X] |
| P3-12 | Add usage and cost telemetry for embeddings, Ask generation, and `reranker_llm`; expose operation metadata and aggregate usage through HTTP/SDK/UI diagnostics | [X] |
| P3-13a | Operator-console shell, design tokens, light/dark/system theme, kb-ui primitives, layout migration | [X] |
| P3-13b | Tree file manager on corpus Files tab (breadcrumbs, folders, context menu, drag/drop, index/source badges) | [X] |
| P3-13c | CodeMirror markdown editor with theme sync, status bar, search, Mod-s save | [X] |
| P3-13d | Remaining UI polish: frontmatter panel, search ranking trace, Ask retrieval trace, richer graph, a11y tests (note: the axe a11y baseline covers ~5 screens — app shell/knowledge list, corpus search, corpus graph, file editor modal, API keys settings — not the full UI) | [X] |
| P3-13e | Tailwind + shadcn design migration: HSL token layer, `.dark` class theme, rebuilt kb-ui primitives, `Switch`-by-default, `Alert` banners, spacing rhythm | [X] |
| P3-14 | Add generic backup/restore guidance for Postgres, blobs, config, secret inventory, and optional Qdrant snapshots | [X] |
| P3-15 | Public docs site or generated API reference, if/when the project is released publicly | [X] |

---

## Consumer Integration Backlog

EvuKB should remain a generic KB product. Consumer-specific adapter code belongs
in the consuming project unless the adapter is generic and has no dependency on
host-specific platform concepts.

| ID | Task | Status |
| --- | --- | --- |
| CI-1 | Generic remote-service guide for any host application using OpenAPI/SDK/MCP | [X] |
| CI-2 | Generic `POST /tools/kb` examples for agent runtimes that need a JSON action bridge | [X] |
| CI-3 | Document agent orchestration host shape: outbound KB adapter, run capabilities, budgets, sandboxing, and optional pre-run injection — [`INTEGRATION-HOST-SHAPES.md`](./INTEGRATION-HOST-SHAPES.md) Pattern 1 | [X] |
| CI-4 | Document platform operator host shape: proxy/deep-link to EvuKB, org auth, extension lifecycle, service maps — [`INTEGRATION-HOST-SHAPES.md`](./INTEGRATION-HOST-SHAPES.md) Pattern 2 | [X] |
| CI-5 | Add contract tests or example fixtures that host projects can reuse without importing host-specific code | [X] |
| CI-6 | MCP agent guide, retrieval-first tool routing, and `EVUKB_MCP_ENABLE_ASK` opt-in for outer agents | [X] |
| CI-7 | Inventory `list_documents` filters/fields, metadata-only `search`, frontmatter refresh on save, optional frontmatter summary chunks | [X] |

---

## Sync And Writeback Backlog

| ID | Task | Status |
| --- | --- | --- |
| SYNC-1 | Mount `import`: mount-to-KB import with read-only `shared_mount` files | [X] |
| SYNC-2 | Mount `import_writeback`: managed KB saves/deletes mirror to mount, KB wins on next save/delete, external mount edits reported as drift | [X] |
| SYNC-3 | Mount `mount_authoritative`: mount is source of truth, sync can remove managed files missing from mount | [X] |
| SYNC-4 | Git `import`: clone/fetch remote, import repository tree, mark git files read-only, record last commit SHA | [X] |
| SYNC-5 | Git writeback design: branch/commit/push semantics, conflict policy, author identity, protected branch handling, approval requirements, and tests | [X] |
| SYNC-6 | Git writeback implementation, only after SYNC-5 is accepted | [ ] |

---

## Usage And Cost Telemetry Backlog

Goal: expose the provider cost of KB-owned operations without importing host
budget systems.

| ID | Task | Status |
| --- | --- | --- |
| COST-1 | Define `UsageRecord`/`OperationUsage` contracts for provider, model, operation type, token/character counts, request count, latency, estimated cost, and currency | [X] |
| COST-2 | Record embedding/indexing usage: chunks, dimensions, provider/model, request count, input token or character estimate, and estimated cost when pricing metadata exists | [X] |
| COST-3 | Record Ask chat usage from provider responses when available, including prompt/completion/total tokens and latency | [X] |
| COST-4 | Record `reranker_llm` usage separately from ordinary search so clients can identify paid reranking | [X] |
| COST-5 | Expose operation-level usage metadata on Ask/Search traces or a stable companion endpoint without returning secrets | [X] |
| COST-6 | Add aggregate usage endpoints and UI diagnostics by workspace, corpus, operation type, provider, model, and time range | [X] |

---

## Agent Write And Retrieval Backlog

| ID | Task | Status |
| --- | --- | --- |
| AGENT-1 | Workspace setting to include `agent-notes/` in Ask/search context (default **true**), with per-corpus override | [X] |
| AGENT-2 | Configurable agent write path ACLs beyond `agent-notes/` (path prefixes, token/corpus grants) so agents can CRUD approved corpus paths | [X] |

Notes:

- Workspace `agentWritePathPrefixes` defaults to `['agent-notes']`; corpus and credential layers may narrow further.
- Operators who want full isolation today can dedicate a corpus to agent writes (e.g. mount/git Obsidian vault used by humans elsewhere) and exclude `agent-notes/` from retrieval on other corpora.
- Per-agent isolation within a workspace needs further operational testing before scoping design.

---

## Future And Open Decisions

| ID | Task | Status |
| --- | --- | --- |
| F-1 | Decide whether full memory banks belong in EvuKB or remain owned by host agent platforms (decision: **not in EvuKB**; host platforms or a separate EvuMemory project if needed; see SPEC §16) | [X] |
| F-2 | Decide whether `@evu/kb-ui` ships as a package or remains app-local until proven reusable | [X] |
| F-3 | Stabilize embeddable `@evu/kb-server` for host applications that bring their own auth/process lifecycle | [X] |
| F-4 | Add ranking strategy plugin API after core ranking contracts settle (mutable registry, kb:admin plugin API, post-rank handlers, example package) | [X] |
| F-5 | Larger-scale vector tuning and benchmark guidance for pgvector and Qdrant | [ ] |
| F-6 | External HTTP import and Obsidian vault sync, if they stay within the KB boundary | [ ] |
| F-7 | OKF v0.2 adapter if the upstream OKF spec changes | [ ] |

## Replanning Checkpoints

After each phase ships:

- Validate open items against current user feedback and the product boundary in
  `SPEC.md`.
- Move newly discovered work into this roadmap instead of silently expanding
  existing tasks.
- Update `SPEC.md`, `SECURITY.md`, or `DESIGN.md` in the same change when a
  roadmap decision changes architecture, security, or UI direction.
