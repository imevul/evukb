# EvuKB MCP Agent Guide

This guide is for **capable outer agents** (Cursor, Claude Code, custom orchestrators)
that connect to EvuKB over MCP Streamable HTTP and **already have their own LLM**.

EvuKB owns indexing, retrieval, citations, and mutation policy. The outer agent owns
synthesis, tool loops, and follow-up reasoning.

Related: [`INTEGRATION.md`](./INTEGRATION.md), [`INTEGRATION-HOST-SHAPES.md`](./INTEGRATION-HOST-SHAPES.md) Pattern 1.

---

## Which tool when?

| User intent | Prefer | Avoid |
| --- | --- | --- |
| Prose / architecture / “what does doc X say?” | `evu.kb.search` → `evu.kb.read_chunk` or `evu.kb.get_document` | `evu.kb.ask` when you already have an LLM |
| Inventory / rollups (`os`, `virtual`, tags, path) | `evu.kb.list_documents` with filters/fields, or `evu.kb.search` with filters and no query | `evu.kb.ask` |
| OKF corpora only | `evu.kb.list_concepts`, `evu.kb.read_index` | `evu.kb.list_concepts` on non-OKF corpora |
| Writes | `evu.kb.create_document`, `append_document`, etc. under `agent-notes/` | — |

### `evu.kb.search`

Hybrid keyword + semantic search over **indexed chunk bodies**. Prefer this for capable MCP
clients: retrieve passages, then synthesize locally.

- Use `pathPrefix` to scope folders (e.g. `Areas/Servers`).
- Use `filters.frontmatter` for exact/glob metadata matches on indexed nodes.
- **Metadata-only discovery:** omit `query` when `filters` and/or `pathPrefix` are set;
  EvuKB returns one representative hit per matching node (`matchKind: metadata`).

### `evu.kb.list_documents`

Corpus **file inventory** (not semantic search). Use for structured rollups when you want
tabular metadata without chunk wrappers.

- Optional `pathPrefix`, `filters`, `limit`/`offset`, and `fields` to project frontmatter keys.
- Read `frontmatter` on each returned row; parse values client-side (e.g. Ubuntu version ranges).

### `evu.kb.ask`

Optional convenience RAG using **EvuKB’s configured chat model**. Prefer `search` when the
MCP client has its own LLM — avoids a redundant LLM hop and double billing.

MCP `ask` is **opt-in** via `EVUKB_MCP_ENABLE_ASK=true` (default off). HTTP/Web Ask is unchanged.

### `evu.kb.list_concepts`

**OKF corpora only** (`formatProfile: okf` in corpus settings). Not for generic Obsidian vaults.

---

## Obsidian-style vaults

Class-based notes often store inventory in YAML frontmatter (`type`, `hostname`, `os`,
`virtual`, `tags`) with Obsidian boilerplate in the body. Frontmatter is **not** in chunk
text by default; use inventory tools or metadata-only search.

Example workspace header:

```http
x-evukb-workspace-id: local-dev
```

Example server inventory path: `Areas/Servers`

### List servers with projected fields

```json
{
  "name": "evu.kb.list_documents",
  "arguments": {
    "corpusId": "YOUR_CORPUS_ID",
    "pathPrefix": "Areas/Servers",
    "filters": { "frontmatter": { "type": "server" } },
    "fields": ["hostname", "os", "virtual"]
  }
}
```

Parse `os` client-side for version comparisons (EvuKB filters are exact/glob, not semver ranges).

### Metadata-only search (no prose query)

```json
{
  "name": "evu.kb.search",
  "arguments": {
    "corpusId": "YOUR_CORPUS_ID",
    "pathPrefix": "Areas/Servers",
    "filters": { "frontmatter": { "type": "server", "virtual": "false" } }
  }
}
```

---

## Recommended flow

1. `evu.kb.corpora.list` — resolve corpus ID if unknown.
2. Structured question → `list_documents` or metadata-only `search`.
3. Prose question → `search` with `query`, then `read_chunk` / `get_document`.
4. Synthesize answer in the outer agent with citations from hit `filePath` / chunk IDs.

---

## MCP setup

See [`INTEGRATION.md`](./INTEGRATION.md) §6 for Streamable HTTP URL, bearer token, and workspace header.

For Cursor: prefer `search` + `list_documents` over `ask`; set `EVUKB_MCP_ENABLE_ASK=false`
on the EvuKB server unless you need server-side RAG on MCP.
