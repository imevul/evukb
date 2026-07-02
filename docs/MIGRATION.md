# Migration Guide

EvuKB was built through clean-room implementation against documented contracts.
Host-specific adapter code belongs in consuming projects, not in this repository.

Do not copy source code from third-party repositories until license status is
confirmed. Use local maintainer notes when you need file-level reference paths.

## Migration Principles

- Migrate contracts before implementation details.
- Preserve workspace isolation as a release-blocking invariant.
- Keep EvuKB corpus-first, not a generic resource platform.
- Prefer `@evu/kb-core` for stable domain contracts.
- Keep API and MCP schemas public and versioned.
- Record migration decisions in commit messages and local notes when needed.

## Detailed Source Maps (local only)

File-by-file port checklists and absolute paths to internal sibling repositories
live in `docs/private/SOURCE-MAP.md`. That file is **gitignored** and optional;
see [`docs/private/README.md`](private/README.md).

## Initial Port Order

1. Define `@evu/kb-core` contracts for workspace scope, corpora, nodes, chunks,
   links, citations, search, and ask.
2. Add `@evu/kb-db` schema and forward-only migrations.
3. Implement local blob storage and metadata repositories.
4. Port markdown parsing, frontmatter, links, and chunking behavior.
5. Add corpus CRUD and file manager routes.
6. Add Postgres FTS and pgvector search.
7. Add minimal Web UI for corpus list, files, and search.
8. Add MCP read tools after the HTTP contracts stabilize.

## Migration Notes Template

```text
Target:
Source reference:
Behavior preserved:
Intentional differences:
Tests added:
Follow-up:
```
