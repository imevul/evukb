# Agent Instructions

These instructions apply to the EvuKB repository.

## Read Order

1. Read [`SPEC.md`](./SPEC.md) before making product or architecture changes.
2. Check [`docs/ROADMAP.md`](./docs/ROADMAP.md) before starting feature work or
   changing product scope.
3. For repository layout, env defaults, and extended dev workflow, read
   [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md).
4. Read the package or app `package.json` and `tsconfig.json` before editing a
   workspace.
5. For UI work, read [`DESIGN.md`](./docs/DESIGN.md).
6. For security-sensitive work, read [`SECURITY.md`](./SECURITY.md).
7. For migration and porting context, read [`MIGRATION.md`](./docs/MIGRATION.md).

## Product Boundary

EvuKB owns knowledge-base and RAG workflows:

- corpora
- files
- markdown parsing and chunking
- links and wikilinks
- OKF support
- hybrid search
- ask with citations
- KB graphs
- KB HTTP and MCP tools

Do not add host automation orchestration, generic extension platform runtime,
service maps, review inboxes, billing, or generic platform features unless
`SPEC.md` is updated first. Host-specific adapter code belongs in consuming
projects by default; EvuKB should expose generic HTTP, SDK, MCP, tool, and package
contracts.

## Package Boundaries

- `packages/kb-core` must stay free of HTTP, auth, process globals, pg-boss
  lifecycle, and UI dependencies.
- `packages/kb-db` owns schema and migrations, not HTTP routes or UI behavior.
- `packages/kb-server` composes routes, MCP, jobs, and adapters, but should not
  own reusable domain logic that belongs in `kb-core`.
- `packages/kb-sdk` is client code only.
- `packages/kb-ui` can expose reusable React primitives, but app-specific screens
  belong in `apps/web` until they are proven reusable.
- `apps/api` and `apps/web` are standalone process/app shells.

## UI Rules

- For UI work, follow [`docs/DESIGN.md`](./docs/DESIGN.md) including **Modals vs inline
  forms**.
- **Default for create or heavy add flows on list pages: `AppModal`**, not inline forms
  above the table or list. Trigger with a primary button in the page header; reset form
  fields when opening the modal.
- **Keep inline forms** on dedicated settings/detail routes (workspace settings, AI
  providers, ranking, corpus overview overrides) and primary search/ask bars.

## Security Rules

- Cross-workspace access is release-blocking.
- Every SQL query must filter by `workspace_id` once schema work begins.
- Every vector query must filter by workspace and corpus scope.
- Blob reads and writes must validate workspace ownership through metadata.
- Never log secret values.
- Never return secret values after creation.
- Agent write tools require explicit capability grants and may require approval.
- Markdown rendering must be sanitized before user display.
- File paths, zip imports, shared mounts, and git sync must defend against path
  traversal.

## Quality Gates

Run these before claiming implementation work is complete:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For runtime changes, also run:

```bash
make verify-dev
```

If a check cannot run, record the reason in the handoff.

## Development Learning Log

Update [`DEV-LEARNINGS.md`](./docs/DEV-LEARNINGS.md) after novel bugs, surprising
integration behavior, migration discoveries, or decisions that will help future
agents avoid repeating work.

## Keeping The Roadmap Honest

[`docs/ROADMAP.md`](./docs/ROADMAP.md) is the phase-level source of truth for
what has shipped and what remains. Every change that ships, splits, defers, or
rescopes a roadmap item must update the roadmap in the same change. Flip a task
to `[X]` only when the work has landed in the repository and its stated gate or
verification criteria are satisfied.

## Host Application Rule

EvuKB exposes generic KB contracts for any host application. Do not add
host-specific adapter code here unless it is generic and documented in `SPEC.md`.
Prefer clean-room reimplementation from documented contracts when porting behavior.
