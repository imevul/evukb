# Git Sync Writeback Design (v1)

Accepted design for **SYNC-5**. This document defines git-sourced corpus
writeback semantics before implementation (**SYNC-6**). Git import remains the
default and is unchanged.

Related docs:

- [`SPEC.md`](../SPEC.md) §20 — sync modes and mutability
- [`SECURITY.md`](../SECURITY.md) — credentials and audit
- [`docs/BACKUP.md`](./BACKUP.md) — Postgres, blobs, and git server-side cache
- [`docs/AUTH.md`](./AUTH.md) — API keys and mutation approval policy

## Scope

| In scope | Out of scope |
| --- | --- |
| Git-backed corpora (`importKind: git`) | Mount `import_writeback` (already shipped) |
| Commit managed KB file edits to a git branch | Force-push, rebasing remote history |
| Optional push to configured remote | Auto-merge on conflict |
| Workspace-scoped audit and approval gates | Cross-workspace git cache sharing |

Git writeback is **distinct from mount writeback**. Mount modes mirror files on a
local/shared filesystem. Git writeback commits from EvuKB's managed file store
into a server-side git clone cache (same cache used by [`GitSyncService`](../packages/kb-server/src/services/git-sync-service.ts) import today).

## Baseline (today)

- Git corpora are **import-only**: clone/fetch → import tree → files marked read-only in KB.
- Credentials are workspace secrets referenced by `gitCredentialSecretName`.
- Last imported commit SHA is recorded on the corpus sync status.
- Managed saves to git-imported files are rejected by mutability rules.

Writeback will be **opt-in** and **env-gated**, similar to mount `import_writeback`:

```bash
EVUKB_ENABLE_GIT_WRITEBACK=true
```

Corpus settings will gain an explicit writeback mode (proposed: `gitWritebackEnabled: true`)
only valid when the env gate is on and `importKind` is `git`.

## Operations (v1)

1. **Commit** — After a successful managed file save (or batched save job), stage
   changed paths in the corpus git cache, commit with configured author identity,
   record new commit SHA in sync metadata.
2. **Push** (optional) — When `gitPushEnabled` is true on the corpus, push the
   target branch to `gitRemoteUrl` using the same credential secret as import.
3. **No import merge on write** — Import jobs and writeback commits are separate;
   the next scheduled import may fail closed on divergence (see Conflicts).

Push and commit run in pg-boss jobs, not on the HTTP request path.

## Branch policy

| Setting | Default | Notes |
| --- | --- | --- |
| `gitWritebackBranch` | `main` or corpus-configured default branch | Target branch for commits |
| `gitWritebackUseFeatureBranch` | `false` | When true, commits go to `evukb/writeback/{corpusId}` (name TBD at implement time) |
| Force-push | **Forbidden** | Implementation must reject `--force` |
| Protected branch push | **Blocked** | Detect via pre-push hook or host policy; surface operator error |

Direct commits to the default branch require explicit corpus opt-in
(`gitWritebackAllowDefaultBranch: true`).

## Author identity

Commit metadata uses configurable git author fields:

- `gitAuthorName` / `gitAuthorEmail` on corpus settings, **or**
- A workspace secret containing `name` and `email` fields

EvuKB does not infer author identity from the HTTP caller. Host platforms that
need per-user attribution should map users to corpus settings or secrets outside
EvuKB.

## Conflicts

**Fail closed** in v1:

- If `git pull` during import or pre-commit status shows diverged history, writeback
  aborts and sync status reports `writeback_blocked`.
- No automatic merge, rebase, or conflict-marker injection in KB files.
- Operator resolves in git (or resets corpus cache) before writeback resumes.

Import after external pushes should fast-forward or fail; EvuKB does not silently
discard KB edits.

## Credentials

- Reuse existing git credential secrets (SSH key or HTTPS token) from import.
- Document in [`SECURITY.md`](../SECURITY.md) that write-capable tokens are **high
  privilege**; prefer branch-limited deploy keys or fine-scoped tokens.
- Secrets remain encrypted at rest; never logged or returned after creation.
- Cross-workspace secret access remains release-blocking.

## Mutation approval

When workspace mutation approval policy requires approval for agent writes, git
writeback commits triggered by agent file saves follow the same queue:

- Save may complete in KB while commit waits for approval, **or**
- Commit is deferred until approval (implementation choice in SYNC-6; design
  requires one path and audit consistency).

Human operator saves through the Web UI may bypass agent approval when policy
allows direct human writes.

## Audit

Every writeback attempt records an audit entry with:

- `workspaceId`, `corpusId`
- action: `git_writeback_commit` | `git_writeback_push`
- paths affected (bounded list or count)
- resulting commit SHA (or error code)
- approval id when applicable

Failed attempts are audited; secrets are never included.

## Security invariants

Machine-readable checklist: [`packages/kb-core/test/fixtures/git-writeback-design-golden.ts`](../packages/kb-core/test/fixtures/git-writeback-design-golden.ts).

Summary:

- No force-push
- No cross-workspace cache or credential use
- Env gate required before any writeback path
- Protected-branch push blocked
- Conflicts fail closed (no auto-merge)

## Restore and backup

Git clone caches live under the server blob/git cache root (see BACKUP.md). Restoring
Postgres without the git cache may require a fresh clone on next sync. Restoring
cache without Postgres may orphan commit metadata.

## Implementation gate (SYNC-6)

Do not implement until:

1. This design is merged and ROADMAP SYNC-5 is `[X]`.
2. Golden design tests pass in CI.
3. SECURITY.md documents write-capable git credential risk.

SYNC-6 deliverables (future): `GitWritebackService`, job handlers, corpus settings
schema, integration tests with a local bare repo, operator diagnostics for
writeback_blocked state.
