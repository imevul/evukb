# Custom ranking strategy example

Reference package for EvuKB ranking strategy plugins (F-4). Depends only on
`@evu/kb-core` and demonstrates **two** registration patterns:

| Strategy | ID | Pattern |
| --- | --- | --- |
| Agent notes boost | `boost_agent_notes_v1` | Preset (`createPresetRankingStrategy`) |
| Docs prefix preference | `prefer_docs_prefix_v1` | Custom `rank()` function |

## Source layout

- [`src/strategies/preset-boost-agent-notes.ts`](./src/strategies/preset-boost-agent-notes.ts) — preset wrapper around `rankHybridDefaultV1` with `agent-notes/` path boost
- [`src/strategies/custom-prefer-docs-prefix.ts`](./src/strategies/custom-prefer-docs-prefix.ts) — custom `rank()` that multiplies scores for `docs/` paths
- [`src/index.ts`](./src/index.ts) — re-exports both; default export is `boostAgentNotesV1Strategy`

## Unit tests

Golden fixtures assert stable top-hit ordering for each strategy:

```bash
pnpm test
# or filter:
pnpm exec vitest run examples/custom-ranking-strategy
```

See [`test/fixtures/golden.ts`](./test/fixtures/golden.ts).

## Install options

In **local dev** (`pnpm dev` / Docker Compose dev), `apps/api` registers both example
strategies at boot when `NODE_ENV` is not `production` (override with
`EVUKB_REGISTER_EXAMPLE_RANKING_STRATEGIES=false`). They appear under **Settings → Ranking →
Installed ranking strategies** without a separate API call.

### 1. Boot-time (embed hosts)

Import strategies and pass an extended registry to `createEvuKbServer`:

```typescript
import { createEvuKbServer } from '@evu/kb-server';
import { createRankingStrategyRegistry } from '@evu/kb-core';
import boostAgentNotesV1Strategy, {
  preferDocsPrefixV1Strategy,
} from '../examples/custom-ranking-strategy/src/index.ts';

const rankingRegistry = createRankingStrategyRegistry({
  extensions: [boostAgentNotesV1Strategy, preferDocsPrefixV1Strategy],
});

const server = await createEvuKbServer({ rankingRegistry });
```

### 2. Operator API — preset (standalone)

Requires `EVUKB_ENABLE_RANKING_PLUGIN_RELOAD=true` and a **`kb:admin`** API key.

```bash
export EVUKB_ENABLE_RANKING_PLUGIN_RELOAD=true

curl -sS \
  -H "Authorization: Bearer $EVUKB_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/custom-ranking-strategy/integration/register-boost-agent-notes-preset.request.json \
  "http://localhost:4201/api/workspaces/local-dev/settings/ranking/strategies"
```

Preset registration works for strategies expressible as hybrid weight templates
(no custom `rank()` code).

### 3. Operator API — importPath (custom rank)

Custom `rank()` strategies must be loaded from an allowlisted module path:

```bash
export EVUKB_ENABLE_RANKING_PLUGIN_RELOAD=true
export EVUKB_RANKING_PLUGIN_ALLOWLIST=/absolute/path/to/evukb/examples/custom-ranking-strategy/src

curl -sS \
  -H "Authorization: Bearer $EVUKB_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq --arg path "$(pwd)/examples/custom-ranking-strategy/src/strategies/custom-prefer-docs-prefix.ts" \
    '.importPath = $path' \
    examples/custom-ranking-strategy/integration/register-prefer-docs-import-path.request.json)" \
  "http://localhost:4201/api/workspaces/local-dev/settings/ranking/strategies"
```

The module must export `default` or `strategy` as a `RankingStrategy`.

### 4. Web UI (standalone dev)

On **Settings → Ranking**, the **Reference examples** table lists strategies from this package
that are not yet installed. Click **Install** (requires `EVUKB_ENABLE_RANKING_PLUGIN_RELOAD=true`
and `kb:admin`; open dev auth includes admin).

### 5. End-to-end smoke

1. Register a strategy (UI **Install**, boot-time, preset, or importPath).
2. Confirm it appears in `GET /api/workspaces/{id}/settings/ranking/strategies` (requires `kb:read`).
3. Set workspace or corpus `rankingStrategyId` to the strategy ID (Ranking settings UI or workspace/corpus API).
4. Run search on content where the path boost should reorder hits (e.g. `agent-notes/` or `docs/` files).

## Uninstall

`DELETE .../settings/ranking/strategies/:id` with `{ "confirm": true }` and a **`kb:admin`** key. Affected corpora fall back to the workspace default; workspace default resets to `hybrid_default_v1` when it referenced the removed strategy.

Preview usage first:

```bash
curl -sS \
  -H "Authorization: Bearer $EVUKB_ADMIN_API_KEY" \
  "http://localhost:4201/api/workspaces/local-dev/settings/ranking/strategies/boost_agent_notes_v1/usage"
```
