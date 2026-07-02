# EvuKB Backup And Restore

Operator runbook for backing up and restoring a standalone EvuKB deployment. This
guide covers generic persistence layers; it does not replace your platform's own
backup policies or cloud-provider tooling.

See also:

- [`README.md`](../README.md) — deployment and environment variables
- [`docs/INTEGRATION.md`](./INTEGRATION.md) — remote-service integration
- [`docs/AUTH.md`](./AUTH.md) — API keys, MCP tokens, and secret handling
- [`SECURITY.md`](../SECURITY.md) — security invariants and release blockers

## What To Back Up

| Layer | Contents | Required for full restore? |
| --- | --- | --- |
| **Postgres** | Workspace/corpus metadata, chunks, FTS indexes, pgvector embeddings (default backend), settings, hashed API keys/MCP tokens, usage records, audit log | Yes |
| **Blob store** (`EVUKB_BLOB_ROOT`) | Managed corpus file bytes referenced by `kb-db` metadata | Yes |
| **Secret inventory** | Names, purposes, rotation dates for API keys, MCP tokens, git credential secrets, provider keys | Yes (values are not recoverable from DB alone) |
| **Qdrant** (optional) | Vector pointers when `EVUKB_VECTOR_BACKEND=qdrant` | Recommended; can be rebuilt by reindex |
| **Portable `.evukb` export** | Single-corpus manifest + files (partial backup) | Optional corpus-level snapshot |

Docker Compose mounts (see [`deploy/docker-compose.yml`](../deploy/docker-compose.yml)):

- `pgdata` — Postgres data directory
- `corpus_store` — default blob root at `/data/corpus-store`
- `qdrant_data` — Qdrant storage when the `qdrant` profile is enabled

## What Not To Treat As A Secret Backup

EvuKB stores **hashed** API keys and MCP tokens. A Postgres dump includes key
metadata (name, scopes, prefix) but **never** the raw secret values shown once
at creation time.

After restore you must:

1. Re-create API keys and MCP tokens whose plaintext values were lost.
2. Re-enter provider credentials (`EVUKB_CHAT_API_KEY`, embedding keys) or
   workspace secrets referenced by git sync / AI provider settings.
3. Update any external clients with the new credentials.

Maintain a separate **secret inventory** (spreadsheet, password manager, or
config-management system) listing secret names, scopes, and last rotation date.
Never commit plaintext secrets to git.

## Postgres Backup

From the host with Compose running:

```bash
# Adjust service/user/db names to match EVUKB_POSTGRES_* / EVUKB_DATABASE_URL
docker compose --project-directory . -f deploy/docker-compose.yml \
  exec -T postgres pg_dump -U evukb -d evukb --format=custom \
  > evukb-$(date +%Y%m%d).dump
```

Plain SQL export:

```bash
docker compose --project-directory . -f deploy/docker-compose.yml \
  exec -T postgres pg_dump -U evukb -d evukb \
  > evukb-$(date +%Y%m%d).sql
```

Restore to an **empty** database (destructive — test on a clone first):

```bash
docker compose --project-directory . -f deploy/docker-compose.yml \
  exec -T postgres pg_restore -U evukb -d evukb --clean --if-exists \
  < evukb-YYYYMMDD.dump
```

For SQL dumps:

```bash
docker compose --project-directory . -f deploy/docker-compose.yml \
  exec -T postgres psql -U evukb -d evukb < evukb-YYYYMMDD.sql
```

Run migrations only when restoring an older dump onto a **newer** EvuKB version:

```bash
pnpm migrate
```

## Blob Store Backup

Blob files live under `EVUKB_BLOB_ROOT` (default `/data/corpus-store` in Compose).
Back up the volume or bind mount:

```bash
docker compose --project-directory . -f deploy/docker-compose.yml \
  run --rm -v corpus_store:/data/corpus-store:ro -v "$PWD":/backup alpine \
  tar -czf /backup/evukb-blobs-$(date +%Y%m%d).tar.gz -C /data corpus-store
```

Restore blobs to a stopped or read-only API instance, then start the API:

```bash
docker compose --project-directory . -f deploy/docker-compose.yml \
  run --rm -v corpus_store:/data/corpus-store -v "$PWD":/backup alpine \
  tar -xzf /backup/evukb-blobs-YYYYMMDD.tar.gz -C /data
```

Cross-workspace blob paths are workspace-scoped in metadata; do not merge blob
trees from unrelated deployments without understanding workspace IDs.

## Qdrant (Optional Profile)

When `EVUKB_VECTOR_BACKEND=qdrant`, vectors are stored in Qdrant with
pointer-only payloads; chunk bodies remain in Postgres and blobs.

1. Start the stack with the `qdrant` profile and note `EVUKB_QDRANT_URL`.
2. Back up Qdrant storage volume `qdrant_data` or use Qdrant snapshot APIs for
   your deployment model.
3. On restore, ensure collection names and embedding dimensions match the
   restored Postgres corpus settings.

If Qdrant data is missing but Postgres and blobs are intact, trigger corpus
**reindex** jobs from the operator UI or API to rebuild vectors.

Verify optional Qdrant parity after major upgrades:

```bash
pnpm verify-qdrant
```

## Portable `.evukb` Export (Corpus-Level)

EvuKB ships corpus portable export/import (manifest v1) for moving a single
corpus between workspaces or installations. This is useful for:

- Sharing one corpus without a full workspace dump
- Partial backup before risky edits
- Migration smoke tests

Portable export is **not** a substitute for full workspace backup: it does not
replace workspace settings, API keys, secrets inventory, multi-corpus indexes, or
Qdrant collections outside the exported corpus scope.

Use the operator UI or SDK portable methods documented in
[`docs/INTEGRATION.md`](./INTEGRATION.md).

## Restore Order

Recommended sequence after catastrophic loss:

1. **Postgres** — restore dump; run `pnpm migrate` if upgrading version.
2. **Blobs** — restore `EVUKB_BLOB_ROOT` volume to match DB refs.
3. **Secrets** — configure environment provider keys and recreate workspace
   secrets / API keys / MCP tokens from your inventory.
4. **Qdrant** (if used) — restore snapshot **or** skip and reindex corpora.
5. **Start API and Web** — `pnpm prod` or your orchestrator equivalent.
6. **Verify** — `/health`, Diagnostics page, sample search/ask, optional
   `pnpm verify-dev` on a staging clone.

If blobs are restored without Postgres (or vice versa), expect missing files,
orphaned blobs, and failed searches until a consistent pair is restored.

## Disaster Recovery Checklist

- [ ] Identify last good Postgres dump and matching blob archive dates.
- [ ] Restore Postgres to a staging instance first; confirm workspace/corpus rows.
- [ ] Restore blobs; spot-check file read API for a known path.
- [ ] Restore or rebuild Qdrant vectors if that backend is enabled.
- [ ] Rotate and re-issue API keys / MCP tokens; update integrators.
- [ ] Re-enter provider and git credential secrets from inventory.
- [ ] Run Diagnostics — index status, failed jobs, usage aggregates.
- [ ] Run search and Ask smoke tests on a representative corpus.
- [ ] Document incident and update backup retention if gaps were found.

## Self-Hosted / Small Team Notes

- Schedule recurring `pg_dump` and blob tar jobs; store off-host copies.
- Test restore to a **separate** Compose project name at least quarterly.
- Keep EvuKB version tag with each backup set so migration path is clear.
- For single-corpus experiments, portable `.evukb` export plus git for source
  markdown may be enough; production-like deployments should still backup Postgres
  and blobs together.
