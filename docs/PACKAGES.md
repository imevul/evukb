# EvuKB Package Surfaces

This document lists **supported import paths** for each `@evu/kb-*` workspace package.
Use only paths declared in each package's `exports` field. Deep imports into
`packages/*/src/...` are unsupported and may break without notice.

Related docs:

- [`RELEASE.md`](./RELEASE.md) — MIT license, no npm publish without approval
- [`INTEGRATION.md`](./INTEGRATION.md) — remote HTTP, SDK, MCP, `/tools/kb`
- [`EMBED.md`](./EMBED.md) — in-process `createEvuKbServer` bootstrap
- [`README.md`](../README.md) — monorepo layout and quickstart

---

## Stability tiers

| Tier | Meaning |
| --- | --- |
| **Stable** | Intended for external consumers; breaking changes require semver major |
| **Experimental** | Exported but may change; pin to git commits or wait for stable release |
| **Internal-advanced** | For hosts embedding the full server stack; not a general app SDK |

---

## Workspace consumption

Inside this monorepo, dependents use `"workspace:*"` in `package.json`. External
projects should **clone and build** from git or deploy via Docker until a maintainer
approves npm publishing (see [`RELEASE.md`](./RELEASE.md)).

Vite dev aliases in `apps/web` may resolve `@evu/kb-ui` and `@evu/kb-sdk` to package
**source** for HMR. Production builds and any external consumer must use published
`dist/` outputs via the `exports` map.

---

## `@evu/kb-core`

Domain contracts and knowledge-base utilities. No HTTP, auth middleware, job queues,
or UI dependencies.

| Export | Stability | Purpose |
| --- | --- | --- |
| `@evu/kb-core` | Stable | IDs, scopes, markdown/OKF helpers, search filters, agent tool contracts, blob path safety |
| `@evu/kb-core/okf/browser` | Stable | Browser-safe OKF/frontmatter utilities (no Node-only APIs) |
| `@evu/kb-core/archive/heuristics` | Stable | Browser-safe archive detection (zip signature, root-prefix stripping) |

```typescript
import { asWorkspaceId, kbReadActions } from '@evu/kb-core';
import { parseFrontmatter } from '@evu/kb-core/okf/browser';
```

---

## `@evu/kb-db`

Drizzle schema, SQL migrations, and repository layer. Ships migration SQL in the
package for hosts that embed `@evu/kb-server`.

| Export | Stability | Purpose |
| --- | --- | --- |
| `@evu/kb-db` | Internal-advanced | `createDb`, repositories, `migrateLatest`, dev bootstrap helpers |
| `@evu/kb-db/migrate` | Internal-advanced | CLI-oriented migrate entry |
| `@evu/kb-db/schema` | Internal-advanced | Drizzle table definitions for advanced hosts |

Most integrators should **not** import `@evu/kb-db` directly. Use `@evu/kb-server`
for in-process embedding or HTTP/SDK for remote access.

---

## `@evu/kb-server`

HTTP routes, MCP, pg-boss jobs, and adapter wiring.

| Export | Stability | Purpose |
| --- | --- | --- |
| `@evu/kb-server` | Mixed (see below) | Server factory, types, selected services |

### Stable embed entry

These are the primary supported surface for in-process hosts (see [`EMBED.md`](./EMBED.md)):

- `createEvuKbServer(options)` — returns a configured Fastify instance
- `EvuKbServerOptions`, `EvuKbHealth` — bootstrap and health types

### Experimental exports

The root barrel also re-exports runtime wiring and individual services for advanced
embedders and tests. Treat these as **experimental**:

- `EvuKbRuntime` and its service fields
- `ApiError`, adapter resolvers (`resolveChatProvider`, `resolveEmbeddingProvider`, …)
- Individual `*Service` classes (`SearchService`, `AskService`, `IndexService`, …)
- `JobQueueService`, `buildOpenApiDocument`, `resolveMaxUploadBytes`

Breaking changes to experimental exports do not require a semver major on the stable
embed entry. Prefer `createEvuKbServer` and HTTP/SDK for new integrations.

```typescript
import { createEvuKbServer } from '@evu/kb-server';

const server = await createEvuKbServer({
  blobRoot: process.env.EVUKB_BLOB_ROOT,
  connectionString: process.env.EVUKB_DATABASE_URL,
});
```

Contract test: [`packages/kb-server/test/embed-contract.test.ts`](../packages/kb-server/test/embed-contract.test.ts).

---

## `@evu/kb-sdk`

Hand-written TypeScript client plus OpenAPI-generated types for remote HTTP consumers.

| Export | Stability | Purpose |
| --- | --- | --- |
| `@evu/kb-sdk` | Stable | `EvuKbClient`, request/response types, settings helpers |

OpenAPI drift is checked by `pnpm exec tsx scripts/verify-openapi-sdk.ts` and the
SDK's own tests. Regenerate types after OpenAPI changes:

```bash
pnpm run generate-openapi
pnpm run generate-types
```

```typescript
import { EvuKbClient } from '@evu/kb-sdk';

const client = new EvuKbClient({
  baseUrl: 'http://localhost:4201',
  apiKey: process.env.EVUKB_API_KEY,
});
```

---

## `@evu/kb-ui`

Reusable React UI primitives and feature composites used by `apps/web`. Peer
dependencies: React 19, React DOM, `@evu/kb-sdk`, `@evu/kb-core` (OKF
frontmatter helpers), and `react-router-dom` (for `AppShell` / `DetailTabs` only;
feature composites use navigation callbacks).

| Export | Stability | Purpose |
| --- | --- | --- |
| `@evu/kb-ui` | Experimental | Primitives, feature panels, hooks (see groups below) |
| `@evu/kb-ui/theme/tokens.css` | Experimental | HSL design tokens (`:root` + `.dark`) |
| `@evu/kb-ui/theme/components.css` | Experimental | Raw graph, CodeMirror, and viewport styles (no Tailwind `@apply`) |

### Feature composites and hooks

| Group | Key exports |
| --- | --- |
| File manager | `CorpusFileManagerPanel`, `useCorpusFileManager`, `FileEditorModal`, `CodeMirrorFileEditor`, `FrontmatterPanel` |
| Search | `SearchPanel`, `SearchResultsSection`, `SearchFiltersFieldset`, `RankingStrategySelect`, `CorpusMultiSelect`, `buildKnowledgeFilters` |
| Ask | `AskPanel`, `AskResponseView`, `useAskStream`, trace mappers |
| Links | `LinkGraphOverview`, `useLinkGraph` |
| Graph | `GraphNeighborhoodView`, `GraphNeighborhoodPanel`, `layoutNeighborhood` |
| Workspace | `useWorkspaceCorpora`, `useRankingStrategyOptions` |
| Theme | `ColorSchemeProvider`, `useColorScheme`, `ThemeMenu` |

Host apps pass `EvuKbClient` + `workspaceId` into hooks; navigation uses render
props/callbacks (no React Router inside kb-ui).

```typescript
import {
  ColorSchemeProvider,
  CorpusFileManagerPanel,
  SearchPanel,
  useCorpusFileManager,
} from '@evu/kb-ui';
import '@evu/kb-ui/theme/tokens.css';
import '@evu/kb-ui/theme/components.css';
```

Tailwind consumers must scan `packages/kb-ui/src/**/*` in their `content` globs.
Copy or mirror the `evukb-file-*` `@layer components` rules from `apps/web/src/styles.css`
when embedding the file manager without EvuKB's stylesheet.
Expect API churn on experimental composites until npm publish is approved.

---

## Forbidden import patterns

Do **not** rely on:

```typescript
// Unsupported — bypasses exports map
import { something } from '@evu/kb-core/src/...';
import { FooService } from '@evu/kb-server/src/services/foo-service.js';
```

Exceptions:

- **Vite dev aliases** documented in `apps/web/vite.config.ts` (development only)
- **In-repo tests** that import implementation modules directly (not a public contract)

If you need a symbol that is not exported, open an issue or PR to add it to the
documented surface rather than deep-importing.

---

## Deploy shells (not libraries)

| Package | Name | Notes |
| --- | --- | --- |
| `apps/api` | `@evu/kb-api` | Minimal `createEvuKbServer` process; not published as a library |
| `apps/web` | `@evu/kb-web` | Operator UI; not published as a library |

Depend on `@evu/kb-server` or `@evu/kb-sdk` instead of importing from `apps/*`.

---

## Export map reference

Authoritative `exports` fields live in each package's `package.json`. This table
summarizes supported subpaths:

| Package | `exports` keys |
| --- | --- |
| `@evu/kb-core` | `.`, `./okf/browser`, `./archive/heuristics` |
| `@evu/kb-db` | `.`, `./migrate`, `./schema` |
| `@evu/kb-server` | `.` |
| `@evu/kb-sdk` | `.` |
| `@evu/kb-ui` | `.`, `./theme/tokens.css`, `./theme/components.css` |

A CI contract test in `packages/kb-core/test/package-surface.test.ts` asserts these
paths exist in each package manifest.
