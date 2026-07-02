# EvuKB Authentication (v1)

EvuKB v1 standalone mode is **headless and API-key oriented**. Human operators use
the Web UI against a bootstrap workspace in development, or configure workspace
API keys and MCP tokens for production use.

## Supported v1 modes

| Actor | Mechanism | Scope |
| --- | --- | --- |
| HTTP clients | `Authorization: Bearer <api-key>` | Workspace-scoped `kb:read` / `kb:write` |
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

API keys and MCP tokens are created with `kb:read` scope by default; an empty
scope list is never stored. The plaintext credential is returned exactly once
from the create/rotate response and is not retrievable afterwards.

## Explicitly deferred

The following are **not** part of v1 standalone auth:

- Local password login for humans
- Browser OIDC / SSO flows
- Multi-user session management inside EvuKB

Host platforms (automation runtimes, organization proxies) should authenticate
their users and mint scoped EvuKB API keys or MCP tokens for KB access.

## Operator setup

1. Create a workspace (or use the dev bootstrap slug `local-dev`).
2. Create an API key with required scopes under `/settings/api-keys`.
3. Configure clients with `Authorization: Bearer …` and the workspace id in the URL.
4. For MCP, send `x-evukb-workspace-id` and a token with `kb:read` or `kb:write`.

See [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) for environment variables and compose deployment notes.
