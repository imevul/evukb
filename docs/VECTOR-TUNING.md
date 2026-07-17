# Vector Tuning And Benchmark Guidance

Operator guide for larger-scale semantic search with EvuKB’s pgvector (default)
and optional Qdrant backends. Companion to [`SPEC.md`](../SPEC.md) §12 and
[`docs/ENV.md`](./ENV.md).

Related:

- [`docs/BACKUP.md`](./BACKUP.md) — Postgres / optional Qdrant restore order
- [`scripts/verify-qdrant.ts`](../scripts/verify-qdrant.ts) — parity smoke for Qdrant
- [`scripts/benchmark-vector-search.ts`](../scripts/benchmark-vector-search.ts) —
  disposable corpus latency measurements

## Backend choice

| Concern | pgvector (default) | Qdrant (optional) |
| --- | --- | --- |
| Operations | One Postgres database | Extra service + Postgres |
| Local / small team | Simplest path | More moving parts |
| Hybrid search | Semantic + FTS in SQL | Dual query + merge in app |
| Larger vector workloads | Add ANN indexes (below) | Purpose-built HNSW store |
| Backup | Postgres dump + blobs | Postgres, blobs, Qdrant volume |

Stay on **pgvector** until semantic search latency or CPU on
`ORDER BY embedding <=> …` becomes a problem. Move to **Qdrant** when vector
ANN needs dedicated capacity or you want to keep Postgres lighter. Enable with:

```bash
EVUKB_VECTOR_BACKEND=qdrant
EVUKB_QDRANT_URL=http://localhost:6333
```

Use the Docker `qdrant` profile in [`docs/DEVELOPMENT.md`](./DEVELOPMENT.md).

## Current query path (important)

Semantic search (pgvector) runs in
`ChunkRepository.searchSemantic`: cosine distance via
`ORDER BY embedding <=> $query::vector` filtered by `workspace_id` and
`corpus_id`. The default schema stores `embedding vector(1536)` but does **not**
create an HNSW/IVFFlat index. Small corpora stay fine; larger ones benefit from
an ANN index or Qdrant.

Qdrant searches always use HNSW. EvuKB creates collections with Cosine distance,
pointer-only payloads (`workspaceId`, `corpusId`, `chunkId`, `nodeId`, optional
`filePath`), and explicit HNSW defaults (`m=16`, `ef_construct=100`). Chunk text
stays in Postgres.

## Dimension and model changes

- Schema and adapters assume a fixed embedding width (default **1536** for
  `text-embedding-3-small`). Changing `EVUKB_EMBEDDING_DIMENSIONS` or model
  requires a **planned reindex** of affected corpora.
- Qdrant collection names include model and dimensions
  (`evukb_{model_slug}_{dimensions}`). A new model/dimension creates a new
  collection; old vectors are not reused.
- After restore, dimensions and collection names must match what the API is
  configured to embed with (see BACKUP.md).

## pgvector: optional HNSW index

Add an ANN index when semantic p95 from the benchmark climbs sharply as chunk
count grows (often noticeable above tens of thousands of embedded chunks,
workload-dependent).

### Recommended production SQL

Run outside a transaction (or with `CREATE INDEX CONCURRENTLY` on live DBs):

```sql
-- Cosine distance operator class; matches <=> usage in searchSemantic
CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Starting points:

| Parameter | Start | Notes |
| --- | --- | --- |
| `m` | 16 | Higher recall / memory; raise toward 32 if recall is weak |
| `ef_construction` | 64 | Higher = better index quality, slower builds |
| Query `ef_search` | session/`SET hnsw.ef_search = 40` | Raise for recall, lower for latency |

Caveats:

- Index build needs enough `maintenance_work_mem` and disk.
- Filters on `workspace_id` / `corpus_id` still apply; ANN helps the distance
  sort after (or with) those predicates depending on planner choices. Prefer
  measuring with the benchmark after creating the index.
- IVFFlat (`lists`) is an alternative for very large tables with periodic
  rebuilds; HNSW is the usual first choice for EvuKB’s cosine queries.

Do **not** add this index in the default migration for every install: empty and
tiny databases do not need it, and concurrent builds are an operator concern.

### Dev / empty database (non-concurrent)

```sql
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

## Qdrant tuning

Defaults applied when EvuKB creates a collection:

| Setting | Value |
| --- | --- |
| Distance | Cosine |
| `hnsw_config.m` | 16 |
| `hnsw_config.ef_construct` | 100 |

Raise `m` / `ef_construct` on the collection (Qdrant API or UI) only if recall
is weak at your scale; re-upsert or recreate the collection after major HNSW
changes. Always keep **workspace** and **corpus** payload filters (EvuKB
enforces them on every search).

After upgrades, run:

```bash
make verify-qdrant
```

## Running the benchmark

Opt-in; not part of `make verify-dev` or CI.

```bash
# Postgres required
EVUKB_DATABASE_URL=postgres://evukb:evukb@localhost:5432/evukb \
  pnpm benchmark:vector

# Optional: also exercise Qdrant for semantic hits
EVUKB_DATABASE_URL=postgres://evukb:evukb@localhost:5432/evukb \
EVUKB_VECTOR_BACKEND=qdrant \
EVUKB_QDRANT_URL=http://localhost:6333 \
  pnpm benchmark:vector
```

Environment overrides:

| Variable | Purpose | Default |
| --- | --- | --- |
| `EVUKB_BENCHMARK_SIZES` | Comma-separated chunk counts | `1000,5000,20000` |
| `EVUKB_BENCHMARK_DIMENSIONS` | Embedding width for synthetic vectors | `1536` (must match `vector(1536)` for pgvector; other widths only with Qdrant) |
| `EVUKB_BENCHMARK_ITERS` | Timed iterations per size/mode | `7` |
| `EVUKB_BENCHMARK_QUICK` | When `true`, uses sizes `200,1000,2000` | unset |

Build packages first (`pnpm build` or `pnpm typecheck`) so the script can import
`packages/*/dist`.

The script creates a disposable workspace/corpus (random slug), seeds synthetic
chunks with unit vectors, times keyword / semantic / hybrid (keyword+semantic)
queries, prints p50/p95 and hit counts, then deletes the workspace.

### Interpreting results

- **Keyword** should stay relatively flat (GIN FTS).
- **Semantic (pgvector)** growing roughly with chunk count usually means a
  sequential distance scan — consider the HNSW SQL above.
- **Semantic (Qdrant)** should stay flatter as N grows if HNSW is healthy.
- **Hybrid** is keyword then semantic in sequence (merge cost is small); use it
  as a rough end-to-end signal, not a full ranking-strategy load test.

Compare the same size before/after adding a pgvector HNSW index or switching
`EVUKB_VECTOR_BACKEND`.
