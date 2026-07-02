# EvuKB Consumer Integration Guide

This guide explains how host applications, agent runtimes, and operator tools
integrate with EvuKB as a **generic remote knowledge-base service**. EvuKB owns
corpora, indexing, search, Ask with citations, audit, and KB mutation policy.
Host platforms own user identity, tenancy mapping, orchestration, and any
parent-project-specific adapters.

Related docs:

- [`AUTH.md`](./AUTH.md) — API keys, MCP tokens, scopes, production gates
- [`PACKAGES.md`](./PACKAGES.md) — supported `@evu/kb-*` import surfaces and stability tiers
- [`RELEASE.md`](./RELEASE.md) — MIT license and no-npm-publish policy
- [`INTEGRATION-HOST-SHAPES.md`](./INTEGRATION-HOST-SHAPES.md) — agent orchestration vs platform operator responsibility splits
- [`SPEC.md`](../SPEC.md) — product contracts (§25 shared tool actions, §30 consumer integration)
- [`EMBED.md`](./EMBED.md) — in-process `@evu/kb-server` bootstrap and lifecycle
- [`GIT-WRITEBACK.md`](./GIT-WRITEBACK.md) — accepted git writeback design (SYNC-5)
- [`ROADMAP.md`](./ROADMAP.md) — P3-11 / CI-* tracking
- [`examples/integration/`](../examples/integration/) — reusable JSON fixtures (CI-5)

> **Transport note:** MCP uses **Streamable HTTP** at `{apiOrigin}/mcp`
> (`POST`/`GET`). Older SPEC §24 references to `/sse` and `/messages` are stale.

---

## 1. Consumption modes

| Mode | Best for | Base path |
| --- | --- | --- |
| OpenAPI HTTP | Any language, explicit REST control | `/api/workspaces/{workspaceId}/…` |
| `@evu/kb-sdk` | TypeScript/JavaScript host apps | Same routes via `EvuKbClient` |
| MCP Streamable HTTP | IDE/agent harnesses with tool discovery | `/mcp` |
| `POST /tools/kb` | JSON action bridge for agent runtimes | `/api/workspaces/{workspaceId}/tools/kb` |

Pick one primary surface per integration. All read/write paths enforce the same
workspace scope and capability checks.

---

## 2. Workspace mapping

Every KB operation is scoped to a workspace:

```http
GET /api/workspaces/{workspaceId}/knowledge-corpora
Authorization: Bearer <api-key>
```

- `{workspaceId}` may be a UUID or workspace slug.
- Dev bootstrap commonly uses slug `local-dev` (see Web `VITE_EVUKB_WORKSPACE_ID`).
- Host apps typically map their tenant/org identifier to an EvuKB workspace record
  and store the EvuKB workspace id or slug for subsequent calls.

Create workspaces through your deployment bootstrap or admin flows; corpora live
under `/api/workspaces/{workspaceId}/knowledge-corpora`.

---

## 3. Authentication and scopes

See [`AUTH.md`](./AUTH.md) for the full v1 auth model.

| Actor | Header | Scope |
| --- | --- | --- |
| HTTP / SDK / `POST /tools/kb` | `Authorization: Bearer <api-key>` | `kb:read` or `kb:write` |
| MCP | `Authorization: Bearer <mcp-token>` plus `x-evukb-workspace-id: <workspaceId>` | token scopes |

Production deployments should set `EVUKB_REQUIRE_API_KEY=true` so workspace
routes reject unauthenticated requests.

---

## 4. Base URLs

Default dev stack:

- API: `http://localhost:4201`
- Web UI: `http://localhost:4200` (proxies API when configured)
- MCP: `http://localhost:4201/mcp`

When the Web UI runs on a different origin than the API, configure
`VITE_EVUKB_API_BASE_URL` (Web) or pass an explicit `baseUrl` to `EvuKbClient`.

---

## 5. TypeScript SDK quickstart

```typescript
import { EvuKbClient } from '@evu/kb-sdk';

const client = new EvuKbClient({
  baseUrl: 'http://localhost:4201',
  apiKey: process.env.EVUKB_API_KEY,
});

const workspaceId = 'local-dev';
const corpora = await client.listCorpora(workspaceId);
const corpusId = corpora[0]?.id;

const hits = await client.searchWorkspace(workspaceId, {
  query: 'alpha fixture',
  corpusIds: [corpusId],
  limit: 5,
});

const answer = await client.askWorkspace(workspaceId, {
  question: 'What is the alpha fixture?',
  corpusIds: [corpusId],
  responseMode: 'concise',
});
```

Streaming Ask:

```typescript
for await (const event of client.askWorkspaceStream(workspaceId, {
  question: 'Summarize the alpha fixture.',
  corpusIds: [corpusId],
})) {
  if (event.type === 'token') process.stdout.write(event.delta);
}
```

OpenAPI artifact: [`packages/kb-sdk/openapi/evukb.openapi.json`](../packages/kb-sdk/openapi/evukb.openapi.json)

Regenerate types after API changes:

```bash
pnpm generate-openapi
pnpm generate-types
```

---

## 6. MCP integration (Streamable HTTP)

MCP server URL: `{apiOrigin}/mcp`

Required headers:

```http
Authorization: Bearer <mcp-token>
x-evukb-workspace-id: <workspace-id-or-slug>
Accept: application/json, text/event-stream
Content-Type: application/json
```

**Agent routing:** capable MCP clients (Cursor, etc.) should prefer `evu.kb.search` and
`evu.kb.list_documents` over `evu.kb.ask` when the client has its own LLM. See
[`MCP-AGENT-GUIDE.md`](./MCP-AGENT-GUIDE.md).

Example Cursor config (see also Web **Settings → MCP tokens** setup guide):

```json
{
  "mcpServers": {
    "evukb": {
      "url": "http://localhost:4201/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_TOKEN",
        "x-evukb-workspace-id": "local-dev"
      }
    }
  }
}
```

### Tool catalog (read)

- `evu.kb.corpora.list`
- `evu.kb.search`
- `evu.kb.ask`
- `evu.kb.read_chunk`
- `evu.kb.list_documents`
- `evu.kb.get_document`
- `evu.kb.follow_links`
- `evu.kb.read_index`
- `evu.kb.list_concepts`
- `evu.kb.graph_neighborhood`

Write tools (`evu.kb.create_document`, `append_document`, `update_document`,
`delete_document`) require `kb:write` scope and may return pending approval
responses when mutation policy requires it.

**MCP ask opt-in:** `evu.kb.ask` is omitted from MCP unless `EVUKB_MCP_ENABLE_ASK=true`
(default false). See [`MCP-AGENT-GUIDE.md`](./MCP-AGENT-GUIDE.md) for outer-agent routing.

### JSON-RPC `tools/call` example

Fixture: [`examples/integration/mcp-tools-call-search.request.json`](../examples/integration/mcp-tools-call-search.request.json)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "evu.kb.search",
    "arguments": {
      "corpusId": "YOUR_CORPUS_ID",
      "query": "alpha fixture",
      "limit": 5
    }
  }
}
```

---

## 7. `POST /tools/kb` action bridge

Single JSON endpoint mirroring MCP read/write actions:

```http
POST /api/workspaces/{workspaceId}/tools/kb
Authorization: Bearer <api-key>
Content-Type: application/json
```

### Read examples

List corpora — fixture [`tools-kb-list-corpora.request.json`](../examples/integration/tools-kb-list-corpora.request.json):

```json
{ "action": "list_corpora" }
```

Search — fixture [`tools-kb-search.request.json`](../examples/integration/tools-kb-search.request.json):

```json
{
  "action": "search",
  "corpusId": "YOUR_CORPUS_ID",
  "query": "alpha fixture",
  "limit": 5
}
```

Ask — fixture [`tools-kb-ask.request.json`](../examples/integration/tools-kb-ask.request.json):

```json
{
  "action": "ask",
  "corpusIds": ["YOUR_CORPUS_ID"],
  "question": "What is the alpha fixture?",
  "responseMode": "concise"
}
```

Streaming Ask: add `"stream": true` — response is SSE (`text/event-stream`).

### Write actions

Write actions (`create_document`, `append_document`, `update_document`,
`delete_document`) require `kb:write`. Responses may be:

- `{ "ok": true, … }` on success
- `{ "ok": false, "status": "pending_approval", … }` when approval policy applies

Approve/reject via `/api/workspaces/{workspaceId}/approvals`.

SDK equivalents: `client.executeKbTool()`, `client.askKbToolStream()`.

---

## 8. KnowledgeFilters and ranking

Search and Ask accept optional `filters` (tags, file types, path allowlist,
frontmatter fields, source/index status) and `rankingStrategyId` overrides.
See OpenAPI `KnowledgeFilters` schema and workspace/corpus ranking settings.

---

## 9. Errors and workspace isolation

- HTTP errors use `{ "error": "…", "code": "…" }` (`EvuKbApiError` in SDK).
- Cross-workspace access is denied across HTTP, MCP, `/tools/kb`, blob reads,
  and vector queries.
- Isolation expectations are encoded in
  [`packages/kb-core/test/fixtures/isolation-golden.ts`](../packages/kb-core/test/fixtures/isolation-golden.ts).

---

## 10. Contract fixtures and testing

Reusable request/response JSON lives under [`examples/integration/`](../examples/integration/).

Validate fixtures in CI:

```bash
pnpm test packages/kb-core/test/integration-fixtures.test.ts
```

Host projects can copy these fixtures into their own contract tests without
importing EvuKB server code.

---

## 12. In-process embedding

When the host application runs Node and owns the HTTP server lifecycle, embed
`@evu/kb-server` instead of calling a remote API. See [`EMBED.md`](./EMBED.md)
for `createEvuKbServer`, shutdown, auth, env, and MCP on the same port.

---

## 13. Host integration shapes

For responsibility splits when integrating as an **agent orchestration host** or
**platform operator host**, see [`INTEGRATION-HOST-SHAPES.md`](./INTEGRATION-HOST-SHAPES.md).

## 14. Out of scope for this guide

- Billing, budgets, or cross-workspace usage reports beyond EvuKB telemetry export
- Git writeback implementation (design: [`GIT-WRITEBACK.md`](./GIT-WRITEBACK.md); SYNC-6)

Host-specific adapters belong in consuming projects unless they are generic and
free of host-runtime concepts.
