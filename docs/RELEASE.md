# EvuKB Release and Distribution Policy

This document describes how EvuKB is licensed, versioned, and distributed today.
It is the maintainer-facing policy for OSS readiness without npm registry publishing.

Related docs:

- [`LICENSE`](../LICENSE) — MIT license text
- [`PACKAGES.md`](./PACKAGES.md) — supported `@evu/kb-*` import surfaces
- [`README.md`](../README.md) — short intro and quickstart
- [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) — repository layout and dev workflow

---

## License

EvuKB is released under the **MIT License**. See [`LICENSE`](../LICENSE) in the
repository root. All `@evu/kb-*` workspace packages declare `"license": "MIT"` in
their `package.json` files.

---

## Distribution today

EvuKB is consumed as a **monorepo**:

- **Git clone** — build and run from source with pnpm and Docker Compose
- **Docker images** — `apps/api` and `apps/web` deploy shells via `deploy/docker-compose*.yml`
- **Workspace packages** — in-repo dependents use `"workspace:*"` resolution

Packages are **not published to npm or other public registries** at this time.

---

## No publish without maintainer approval

All library packages remain `"private": true`. Until a maintainer explicitly opts in:

- Do **not** run `pnpm publish` or equivalent registry uploads
- Do **not** add changesets, npm provenance, or publish CI workflows
- Do **not** flip `"private": false` on workspace packages

If publishing is approved later, update this document, remove or adjust `private`,
and add the chosen release tooling in a dedicated change. Until then, external
consumers should clone the repository or deploy from Docker — not install from npm.

---

## Versioning

| Location | Convention |
| --- | --- |
| Root `package.json` | `0.1.0` (product version) |
| `@evu/kb-*` packages | `0.0.0` (workspace placeholders) |
| `/version` HTTP endpoint | Reports product version (`0.1.0`) |

When registry publishing begins, packages should follow [semver](https://semver.org/)
independently or as a coordinated release set, documented in a future release note.

---

## Supported runtime

- **Node.js** `>=22` (see root `package.json` `engines`)
- **pnpm** via Corepack (`packageManager` field in root `package.json`)

---

## What ships where

| Artifact | Role | Library? |
| --- | --- | --- |
| `apps/api` | Standalone API process (`@evu/kb-api`) | No — deploy shell |
| `apps/web` | Standalone operator Web UI (`@evu/kb-web`) | No — deploy shell |
| `packages/kb-core` | Domain contracts and core utilities | Yes |
| `packages/kb-db` | Schema, migrations, repositories | Yes (internal-advanced) |
| `packages/kb-server` | HTTP, MCP, jobs, embed entry | Yes |
| `packages/kb-sdk` | TypeScript HTTP client | Yes |
| `packages/kb-ui` | Reusable React primitives | Yes (experimental) |

Deploy apps are not intended as npm libraries. Integrators embedding EvuKB should
depend on `@evu/kb-server`, `@evu/kb-sdk`, or documented package surfaces — see
[`PACKAGES.md`](./PACKAGES.md).

---

## Verification before release changes

When license, export, or distribution metadata changes, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsx scripts/verify-openapi-sdk.ts
```

Confirm all library packages still declare `"private": true`:

```bash
rg '"private": false' packages/
```

An empty result is expected until publish is explicitly approved.
