# Security

This document turns the security invariants in [`SPEC.md`](./SPEC.md) into
operational guidance for implementation and review.

## Security Model

EvuKB is multi-workspace from v1. Workspaces are the primary tenant boundary.
Users, API keys, MCP tokens, corpora, files, chunks, links, vectors, blobs,
settings, secrets, and audit entries must all preserve workspace identity.

The default stance is that human users, API clients, and MCP agents are not
trusted to access or mutate knowledge outside their granted workspace and corpus
scope.

## Release-Blocking Invariants

- Every SQL query is workspace-scoped.
- Every vector query is workspace-scoped.
- Every blob read and write validates workspace ownership through metadata.
- MCP and API tokens are workspace and action scoped.
- HTTP and MCP auth are fail-closed; unauthenticated access requires the
  explicit `EVUKB_ALLOW_OPEN_AUTH=true` opt-in and is never available in
  production.
- File manager operations block path traversal.
- File manager operations block unsafe symlink escapes.
- Git credentials and provider API keys are stored as secrets.
- Git writeback (future SYNC-6) requires write-capable credentials; use
  branch-scoped deploy keys and treat them as high privilege (see
  [`docs/GIT-WRITEBACK.md`](docs/GIT-WRITEBACK.md)).
- Secret values are never logged.
- Secret values are never returned after creation. The only carve-out: the
  create and rotate responses for API keys, MCP tokens, and workspace secrets
  return the plaintext value exactly once so the caller can store it; it is
  never retrievable afterwards.
- Citation URL validation has SSRF protections, timeouts, and allow/deny policy.
- Agent write tools require explicit capability grants.
- Agent write tools can require human approval before applying changes.
- Ranking plugin register/uninstall requires `kb:admin` (not `kb:write`) and
  `EVUKB_ENABLE_RANKING_PLUGIN_RELOAD=true`. Allowlisted `importPath` only;
  never grant `kb:admin` to agent MCP tokens.
- Markdown rendering is sanitized.
- Upload size limits are enforced.
- Zip imports protect against zip bombs and path traversal.
- Binary file indexing policy is explicit.
- Human and agent mutations are audited.

## Primary Threats

### Cross-Workspace Data Exposure

Risk: a query, vector payload, blob path, or MCP context leaks another workspace's
knowledge.

Required controls:

- Model workspace ID as mandatory in server-side request context.
- Include workspace ID in every database table that stores user data.
- Include workspace and corpus filters in vector payloads.
- Test workspace isolation for every repository and adapter.

### Unsafe File Access

Risk: managed files, shared mounts, git sync, or zip imports escape the intended
corpus root.

Required controls:

- Normalize paths before using them.
- Reject absolute paths from user-controlled input.
- Reject `..` traversal after normalization.
- Resolve symlinks and ensure final paths stay under the allowed root.
- Validate zip entries before extracting.

### Secret Disclosure

Risk: provider keys, git credentials, API keys, or MCP tokens are exposed through
logs, API responses, audit payloads, errors, or UI state.

Required controls:

- Store secret values encrypted.
- Return secret IDs and metadata, never secret values (except the documented
  one-time return of the plaintext in the create/rotate response).
- Redact known secret fields in logs and errors.
- Avoid including secrets in job payloads where references are enough.

### Agent Mutation Abuse

Risk: an agent writes, deletes, or corrupts corpus content beyond its intended
capability.

Required controls:

- Scope agent tokens to workspace, corpus, action, and path prefix.
- Apply mutability rules in the API, not only in the UI.
- Record human and agent mutations in `audit_log`.
- Support approval-required outcomes for write tools.

### SSRF Through Citation Validation

Risk: citation URL validation probes internal services or metadata endpoints.

Required controls:

- Use allow/deny policy before network requests.
- Block private, loopback, link-local, and metadata IP ranges.
- Enforce short timeouts and response size limits.
- Do not follow redirects into blocked ranges.

## Review Checklist

Use this checklist for security-sensitive changes:

- Does the code know the workspace ID at the trust boundary?
- Does every storage adapter enforce workspace scope?
- Are secrets represented by references after creation?
- Are file paths normalized and constrained?
- Are user-rendered markdown and HTML sanitized?
- Are mutations audited?
- Are agent write tools capability-gated?
- Are tests covering negative authorization cases?
- Do security invariant tests cover upload limits, zip bombs, symlink escapes, binary indexing policy, citation SSRF/timeouts, and markdown sanitization helpers?

Automated coverage lives in `packages/kb-core/test/security-invariants.test.ts`,
`packages/kb-server/test/security-invariants.test.ts`, `packages/kb-server/test/portable-service.test.ts`,
`packages/kb-server/test/citation-validate-service.test.ts`, and
`packages/kb-ui/test/markdown-safety.test.ts`.

## Reporting

This project is not public-release ready yet. Until a public security policy is
published, report suspected vulnerabilities directly to the repository owner.
