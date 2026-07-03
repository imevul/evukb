# EvuKB Examples

Reusable, host-agnostic request/response fixtures that consumers can
copy into their own integration code or contract tests (roadmap item CI-5).
The full integration walkthrough lives in
[`docs/INTEGRATION.md`](../docs/INTEGRATION.md).

## `integration/`

JSON fixtures for the two agent-facing surfaces: the HTTP JSON tool bridge
(`POST /api/workspaces/{workspaceId}/tools/kb`) and MCP over Streamable HTTP
(`POST {apiOrigin}/mcp`).

| File | Shows |
| --- | --- |
| `tools-kb-list-corpora.request.json` | Minimal `list_corpora` action for `POST /tools/kb` |
| `tools-kb-list-corpora.response.json` | Matching response shape (`ok`, `action`, `corpora`) |
| `tools-kb-search.request.json` | Basic corpus `search` action with a query and limit |
| `tools-kb-search-metadata-only.request.json` | Metadata-only `search` (no query) using `pathPrefix` and frontmatter filters |
| `tools-kb-list-documents-inventory.request.json` | Inventory-style `list_documents` with `pathPrefix`, frontmatter filters, and selected frontmatter `fields` |
| `tools-kb-ask.request.json` | Non-streaming `ask` action across corpora with `responseMode` |
| `mcp-tools-call-search.request.json` | JSON-RPC `tools/call` envelope for the `evu.kb.search` MCP tool |

The corpus IDs in the fixtures are placeholders
(`00000000-0000-4000-8000-000000000001`). Run `list_corpora` first and
substitute a real corpus ID.

## Running the `tools-kb-*` fixtures

Send them to the tool route with an API key (`kb:read` scope suffices for the
read actions shown here):

```bash
curl -sS \
  -H "Authorization: Bearer $EVUKB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/integration/tools-kb-list-corpora.request.json \
  "http://localhost:4201/api/workspaces/local-dev/tools/kb"
```

In dev with `EVUKB_ALLOW_OPEN_AUTH=true`, the `Authorization` header can be
omitted.

## Running the `mcp-*` fixture

MCP uses Streamable HTTP at `/mcp` with a bearer MCP token and a workspace
header:

```bash
curl -sS \
  -H "Authorization: Bearer $EVUKB_MCP_TOKEN" \
  -H "x-evukb-workspace-id: local-dev" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d @examples/integration/mcp-tools-call-search.request.json \
  "http://localhost:4201/mcp"
```

Most MCP clients (IDE harnesses, agent frameworks) only need the server URL
and headers; the JSON-RPC fixture documents the wire shape for hand-rolled
clients. See [`docs/MCP-AGENT-GUIDE.md`](../docs/MCP-AGENT-GUIDE.md) for tool
routing guidance.

## `custom-ranking-strategy/`

Reference ranking strategy plugin package (SPEC §13, F-4). Shows preset and
custom `rank()` patterns with golden tests and operator API fixtures.

| Path | Shows |
| --- | --- |
| [`custom-ranking-strategy/README.md`](./custom-ranking-strategy/README.md) | Boot-time, preset, and importPath registration |
| `custom-ranking-strategy/integration/register-boost-agent-notes-preset.request.json` | `POST .../settings/ranking/strategies` preset body |
| `custom-ranking-strategy/integration/register-prefer-docs-import-path.request.json` | importPath body (substitute absolute path under allowlist) |
| `custom-ranking-strategy/test/` | Golden tests run via root `pnpm test` |

Requires `EVUKB_ENABLE_RANKING_PLUGIN_RELOAD=true` and a **`kb:admin`** API key
for register/unregister routes.
