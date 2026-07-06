# EvuKB

EvuKB is a standalone, open-source knowledge base and RAG system. It ingests,
stores, links, searches, cites, and answers from knowledge corpora for humans,
agents, and host applications.

The project is scoped around knowledge: corpora, hybrid search, Ask with
citations, link graphs, and HTTP/MCP agent tools. It is not an agent
orchestrator, infrastructure map, extension marketplace, or general database.

## Disclaimer

EvuKB is early-stage, self-hosted software provided **as-is, use at your own
risk**. There is no warranty of fitness for any purpose. Review
[`SECURITY.md`](./SECURITY.md) before exposing an instance to a network you do not
fully control.

For production, configure authentication (`EVUKB_TOKEN_PEPPER`, API keys, MCP
tokens). Do not enable `EVUKB_ALLOW_OPEN_AUTH` outside local development.

## Prerequisites

- Docker and Docker Compose (required for `make dev` / `make prod`)
- Node.js 22+ and pnpm through Corepack (`corepack enable`) for host-side lint,
  tests, and tooling

## Development quickstart

```bash
make dev
```

This starts Postgres, the API, and the Web UI in Docker. The API applies
database migrations on startup. First run may take a while (image build and
in-container dependency install).

Contributors running lint, tests, or other commands **on the host** need
`pnpm install` first and a reachable Postgres (for example after `make up`).
See [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md).

Default ports:

- Web UI: `http://localhost:4200`
- API: `http://localhost:4201`
- Postgres: `localhost:5432`

With `EVUKB_ALLOW_OPEN_AUTH=true` (dev default), the operator UI uses workspace
`local-dev`.

## Production quickstart

```bash
cp .env.example .env
# Set EVUKB_TOKEN_PEPPER, EVUKB_SECRETS_KEY, and provider API keys.
make prod
```

Auth is fail-closed in production. See [`docs/AUTH.md`](./docs/AUTH.md) for API
keys, MCP tokens, and workspace scoping.

## Commands

| Command | Purpose |
| --- | --- |
| `make dev` | Start the dev Docker Compose stack (foreground) |
| `make up` / `make down` | Start or stop the dev stack (background) |
| `make prod` | Start the production Docker Compose stack |
| `make update` | Pull latest `main` and restart the production stack |
| `make migrate` | Apply database migrations |
| `pnpm lint` | Run Biome checks |
| `pnpm typecheck` | Build packages and run TypeScript checks |
| `pnpm test` | Run tests (DB-backed suites skip without `EVUKB_DATABASE_URL`) |
| `pnpm build` | Build all workspace packages |
| `make verify-dev` | Build, test, and validate dev compose config |
| `make api-docs` | Regenerate Redoc API reference (`docs/api/index.html`) |

Extended commands, operator routes, Qdrant verification, and deployment notes:
[`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md).

**API reference:** with the API running, open `http://localhost:4201/api-reference`. Offline: run `make api-docs` and open [`docs/api/index.html`](./docs/api/index.html).

## Documentation

| Doc | Topic |
| --- | --- |
| [`SPEC.md`](./SPEC.md) | Product and engineering specification |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Shipped and planned work |
| [`docs/INTEGRATION.md`](./docs/INTEGRATION.md) | HTTP, MCP, and SDK integration |
| [`docs/ENV.md`](./docs/ENV.md) | Environment variables |
| [`docs/AUTH.md`](./docs/AUTH.md) | Authentication and tokens |
| [`SECURITY.md`](./SECURITY.md) | Security model and invariants |
| [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) | Repository layout, status, and dev workflow |
| [`docs/api/index.html`](./docs/api/index.html) | Generated OpenAPI reference (also at `/api-reference` on the API) |
| [`AGENTS.md`](./AGENTS.md) | Instructions for coding agents |

## License

EvuKB is released under the [MIT License](./LICENSE). Distribution policy is
documented in [`docs/RELEASE.md`](./docs/RELEASE.md).
