# EvuKB Authentication (v1)

EvuKB v1 standalone mode is **headless and API-key oriented**. In production the
bundled Web UI authenticates through the **same-origin `/api` proxy**, which
injects a global operator token server-side. External clients use workspace-scoped
API keys or MCP tokens.

## Supported v1 modes

| Actor | Mechanism | Scope |
| --- | --- | --- |
| Operator / Web UI (default prod) | `EVUKB_OPERATOR_API_KEY` injected by `evukb-web` proxy | Global — all workspaces (`kb:read`, `kb:write`, `kb:admin`) |
| HTTP clients | `Authorization: Bearer evukb_api_…` | Workspace-scoped `kb:read` / `kb:write` / `kb:admin` |
| MCP clients | MCP bearer token or configured dev token | Workspace header + token scopes |
| Agent tools | `POST /api/workspaces/:id/tools/kb` with API key | Read/write classified per action |

Auth is **fail-closed by default**: workspace HTTP routes, `tools/kb`, and MCP
reject unauthenticated requests unless `EVUKB_ALLOW_OPEN_AUTH=true` is set
explicitly (dev compose sets it). The opt-in is ignored in production, and
`EVUKB_REQUIRE_API_KEY=true` / `EVUKB_MCP_REQUIRE_TOKEN=true` always win over
the opt-in.

When auth is enforced, the server refuses to start unless `EVUKB_TOKEN_PEPPER`
is set to a non-empty value; the pepper is mixed into stored API key and MCP
token hashes, and changing it invalidates all existing credentials.

`EVUKB_TOKEN_PEPPER` is **not** an HTTP bearer token. The global operator bearer
is `EVUKB_OPERATOR_API_KEY` (`evukb_ops_…` prefix). `make prod` adds one to
`.env` automatically when missing.

### Global operator token

- Configured via `EVUKB_OPERATOR_API_KEY` on **both** `evukb-api` (validation) and
  `evukb-web` (proxy injection).
- Grants cross-workspace operator access; not stored in the database.
- Auto-generated on first API startup when auth is required and the env var is
  unset (also logged once). Opt out with `EVUKB_BOOTSTRAP_OPERATOR_API_KEY=false`.
- Optional `EVUKB_WEB_API_KEY` on `evukb-web` injects a workspace-scoped DB key
  instead of the operator key (UI-only single-workspace deployments).

Workspace-scoped API keys and MCP tokens are created with `kb:read` scope by default; an empty
scope list is never stored. The plaintext credential is returned exactly once
from the create/rotate response and is not retrievable afterwards.

### `kb:admin` (operators only)

- Workspace administration such as ranking plugin register/uninstall.
- **Do not** mint `kb:admin` for agent MCP tokens (Cursor, orchestration hosts).
- `kb:admin` does not imply `kb:write`; operator keys stay separate from agent keys.

## Explicitly deferred

The following are **not** part of v1 standalone auth:

- Local password login for humans
- Browser OIDC / SSO flows
- Multi-user session management inside EvuKB

Host platforms (automation runtimes, organization proxies) should authenticate
their users and mint scoped EvuKB API keys or MCP tokens for KB access.

## Operator setup

**Production Docker (default):**

1. Run `make prod` — `.env` receives `EVUKB_OPERATOR_API_KEY` if missing.
2. Open the Web UI on the web hostname; `/api` is proxied internally with the operator token.
3. Create workspaces from `/workspaces` as needed.
4. Mint workspace-scoped keys under Settings → API keys for external clients and MCP.

**External clients / MCP:**

1. Create an API key or MCP token with required scopes.
2. Send `Authorization: Bearer …` and the workspace id in the URL (HTTP) or
   `x-evukb-workspace-id` header (MCP).

**Development:** with `EVUKB_ALLOW_OPEN_AUTH=true`, no bearer is required.

See [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) for environment variables and compose deployment notes.
