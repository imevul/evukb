# Design

EvuKB is format-first and product-second. The UI should make knowledge corpora
easy to inspect and operate without hiding the portable file model underneath.

Visual structure follows an operator-console wireframe (sidebar + content) with
corpus detail tabs and file-manager behavior. The UI is built on **Tailwind CSS**
with **shadcn-style** primitives aligned to the shared **Evu Theme**
([`imevul/evu_theme`](https://github.com/imevul/evu_theme)): neutral surfaces,
signature indigo primary on accents only, IBM Plex Sans/Mono. Implementations
are clean-room against documented contracts.

## Product Principles

- Files remain portable and readable outside EvuKB.
- Search and ask results cite source chunks.
- Indexing status and warnings are visible, not buried.
- Headless and UI behavior share the same API contracts.
- Agents are treated as scoped writers, not trusted teammates by default.
- Operator settings show whether values come from env, config, or database
  overrides.

## Global Shell

```text
+----------+-----------------------------------------------+
| Sidebar  | Main content (full width via AppContent)      |
| brand    |                                               |
| primary  | Corpus detail: underline tabs when scoped     |
| nav      |                                               |
|          |                                               |
| workspace|  (button → `/workspaces`; shows active slug)   |
| + theme  |                                               |
+----------+-----------------------------------------------+
```

The sidebar (`w-56`, neutral `--sidebar` chrome — not primary-tinted) holds the
brand mark, primary nav, workspace control, and the theme control. The workspace
control is a button linking to `/workspaces`; it shows the active slug (or a
degraded state when the workspace is missing or inaccessible). Browser selection
in `localStorage` overrides the build-time default from `VITE_EVUKB_WORKSPACE_ID`.
When the active workspace is invalid, primary nav is reduced to **Workspaces**
only and a warning banner points operators to choose or create a workspace.

Active nav links use `bg-primary text-primary-foreground` (signature accent
pill); the rest are muted with a `hover:bg-muted` affordance. Do not paint the
sidebar or page background with primary.

Primary sidebar routes:

| Item | Route |
| --- | --- |
| Workspaces | `/workspaces` |
| Knowledge | `/knowledge` |
| Search | `/search` |
| Ask | `/ask` |
| Settings | `/settings/preferences` |
| Diagnostics | `/diagnostics` |

Corpus-scoped pages use underline **DetailTabs**: Overview, Files, Search, Links,
Graph, Ask.

Implementation: `@evu/kb-ui` exports `AppShell`, `AppContent`, `DetailTabs`,
`ThemeMenu`. Theme preference (`light` / `dark` / `system`) lives in `@evu/kb-ui`
(`ColorSchemeProvider`, segmented `ThemeMenu`) and toggles a `.dark` **class** on
`<html>` (Tailwind `darkMode: ['class']`), set early by the FOUC script in
`index.html`. Preference is stored as `evu-color-scheme` (legacy
`evukb-color-scheme` is dual-read). Accent palette is `data-evu-palette` on
`<html>` (`indigo` default; optional `blue`).

Display preferences (date format, time format, timezone, locale) are per-browser
`localStorage` (`evukb_display_preferences`). Each field defaults to **System
setting** (browser/OS via `Intl`). Operators change them under **Settings →
Preferences** (`DisplayPreferencesSettings` in `@evu/kb-ui`). Container `TZ` in
Docker Compose affects server logs and process time only, not UI formatting.

## Theme Tokens

Evu Theme HSL channel tokens live in `@evu/kb-ui/theme/tokens.css` (`:root` for
light, `.dark` for dark; palette blocks for indigo/blue) and are consumed through
Tailwind as `hsl(var(--token))`.

| Token | Tailwind utility | Purpose |
| --- | --- | --- |
| `--background` / `--foreground` | `bg-background` / `text-foreground` | Page surface + text |
| `--card` / `--card-foreground` | `bg-card` | Cards, panels |
| `--sidebar*` | `bg-sidebar` / `border-sidebar-border` | Neutral sidebar chrome |
| `--primary` / `--primary-foreground` | `bg-primary` | Signature accent (nav, CTA, switch-on, focus, tab underline) |
| `--secondary` / `--secondary-foreground` | `text-secondary` | Links and cool secondary emphasis |
| `--muted` / `--muted-foreground` | `bg-muted` / `text-muted-foreground` | Secondary surfaces + text |
| `--border` / `--input` | `border-border` | Borders and control borders |
| `--destructive` / `--success` / `--warning` | `bg-destructive` / `text-success` / … | Semantic status |
| `--ring` | `ring-ring` | Focus rings |
| `--radius` | `rounded-lg/md/sm` | Corner radius scale |
| `--graph-node` / `--graph-node-center` | (SVG `hsl(var(--…))`) | Link-graph nodes |

Never hard-code surface hex. Keep large surfaces neutral; reserve primary for the
accent map above. Status badges/alerts use token semantic colors.

## Component Catalog (`@evu/kb-ui`)

| Component | Use |
| --- | --- |
| `AppShell`, `AppContent` | Global sidebar layout + centered content column |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | Elevated content blocks |
| `Button` | Actions. Variants: `primary`, `default`/`outline` (elevated card chip), `secondary`, `quiet`/`ghost` (chrome only), `danger`/`dangerOutline`/`destructive`; sizes `default`/`sm`/`lg`/`icon` (`h-9` default) |
| `Switch` | **Default boolean control** (iOS toggle) |
| `Input`, `Textarea`, `Label` | Form controls; `FORM_CONTROL_CLASS` / `FORM_SELECT_CLASS` for raw elements |
| `Badge`, `StatusBadge`, `statusTone` | Neutral/semantic badges; status-derived tone |
| `Alert` | Banners/callouts (`info`/`warning`/`danger`/`success`) with icon + title + body |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | Data tables |
| `DetailTabs`, `TAB_CLASS`, `tabClassName` | Underline section navigation |
| `Field` | Label + control + hint stack |
| `PageTitle`, `PageToolbar` | Page headers |
| `AppModal` | Create/add flows and read-only previews (`title`, optional `description`, `footer`, `size`) |
| `FileBreadcrumbs`, `FileTreePane`, `FileTreeRow`, `ContextMenu` | Legacy/simple tree widgets |
| `FileManagerList` | Full file manager list (columns, breadcrumbs, refresh, multi-select) |
| `CorpusFileManagerPanel` | Complete corpus file manager (toolbar, context menus, modals, editor) |
| `SearchPanel` / `AskPanel` | Search and Ask forms with filters, ranking, and results |
| `LinkGraphOverview` | Links tab tables (nodes + edges) |
| `GraphNeighborhoodView` | Radial graph neighborhood canvas |
| `EmptyState`, `CitationList`, `SearchResultList` | Content blocks |
| `ThemeMenu` | Segmented Light / Dark / System control |
| `cn` | `clsx` + `tailwind-merge` class combiner |

`StatusPill` remains a thin backward-compatible alias over `Badge`; new code
should prefer `Badge`/`StatusBadge`. Keep fetching, routing, and workspace policy
in `apps/web`.

## Modals vs inline forms

**Default for “create” or heavy “add” flows on list pages: `AppModal`**, not expanding
inline forms above the table or list.

- **Trigger**: primary button in the page header (or file-tree toolbar for new file/folder)
  opens the modal; opening resets form fields (see Knowledge list, Secrets, API keys,
  MCP tokens, corpus Files patterns).
- **`AppModal`**: native `<dialog>` portaled to `document.body` so the modal escapes
  scrollable main content; props: `title`, optional `description`, `footer` for
  Cancel/submit alignment (`flex-wrap justify-end gap-2`), `size` (`sm` | `md` | `lg` |
  `xl`).
- Modal body: use `.evukb-form` / `Field` stacks; dense fields may use
  `gap-3 md:grid-cols-2`.
- Wire submit via `form={formId}` on the footer primary button when the form lives in
  the modal body.

**Inline editing** stays on dedicated settings/detail routes (workspace settings, AI
providers, ranking, corpus overview overrides) and primary search/ask bars — those are
ongoing operator surfaces, not ephemeral list inserts.

Preview/detail-only modals also use `AppModal` with a single Close action in `footer`
when appropriate.

## Layout And Rhythm Rules

Use the Tailwind spacing scale for a consistent rhythm — this is the systemic fix
for prior ad-hoc spacing:

- **Page sections**: `AppContent` stacks blocks with `gap-6` (`space-y-6`).
- **Cards / panels**: padding `p-5`; internal blocks `gap-4`.
- **Forms**: `.evukb-form` is a `flex flex-col gap-4`; each label is a
  `gap-1.5` column; fieldsets `gap-3.5` with a muted inset (`bg-muted/55`) so
  groups read against the card.
- **Controls**: inputs, selects, and buttons are `h-9`. Control surfaces use
  `bg-background` (recessed wells), not transparent-on-card.
- **Surface stack (dark)**: page `--background` → card → muted fieldset →
  background wells for fields. Keep enough step between each layer.
- **Booleans use `Switch` by default.** Only fall back to a native checkbox when a
  toggle is genuinely wrong (e.g. inside a native multi-select form the platform
  must own). Multi-select facet rows (corpus pickers, source-type / index-status
  filters) also use `Switch` rows.
- Content uses full main-column width via `AppContent` (`max-w-none` by default).
  Pass `wide={false}` only when a deliberately narrow column is needed.
- Use `Card` (or the equivalent `.evukb-panel` compatibility class) for one
  elevated content block; the two stay visually equivalent.
- Route layouts own broad context titles (`Settings`, corpus name). Corpus tabs
  should not repeat the active tab label as a redundant `h2`.
- Prefer `Button` variants for actions. Raw `<button>` is only acceptable for
  structural controls inside reusable widgets (file-tree rows, breadcrumbs,
  context menus).
- **Buttons vs wells:** `default`/`outline` use elevated `--card` fill + border +
  light shadow — never transparent and never `--background` (those read as input
  holes inside muted groups). Use `ghost`/`quiet` only for chrome (dismiss, icon
  menus), not form secondary actions on nested panels.
- The structural design-system classes (`.evukb-panel`, `.evukb-form`,
  `.evukb-table`, `.evukb-stat-card`, credential/checkbox lists, etc.) are
  reimplemented on the HSL tokens in `apps/web/src/styles.css` under
  `@layer components`. `@evu/kb-ui/theme/tokens.css` owns only the token layer.
- Loading hints use `.evukb-muted`; empty states use `EmptyState` (dashed
  callout) between intro text and the next form/list.
- SVG and canvas-like UI must read the HSL tokens (`hsl(var(--…))`) instead of
  hard-coded colors so light and dark themes stay readable.

## File Manager And Editor

Files tab layout:

```text
+------------------------------------------+
| File manager header (filter, actions)    |
| Breadcrumbs + refresh                    |
| Name | Size | Status columns             |
+------------------------------------------+
```

Rules:

- Full-width **file manager list** (`FileManagerList` in `@evu/kb-ui`); no inline editor pane.
- **Double-click a file** (or context menu Open) opens **`FileEditorModal`** — a large
  `AppModal` with CodeMirror, validation banners, Save/Close, and optional fullscreen.
- Navigate folders via breadcrumbs and `..` row; double-click folders to enter.
- Filter searches name/path corpus-wide when non-empty; `/` or Ctrl+F focuses the filter.
- Multi-select rows with click, Ctrl/Cmd+click, and Shift+click; drag moves selection.
- Show index status and size in column headers.
- Context menu: open, rename (modal), delete (when editable).
- **New file** and **New folder** open `AppModal` forms from the toolbar; creating a text
  file opens the editor modal immediately.
- Reindex selected files from the header, or all files when nothing is selected.

Reference behavior: corpus files tab, file manager list, editor modal, and
CodeMirror markdown editor (clean-room).

## Information Architecture

Primary routes from `SPEC.md`:

| Route | Purpose |
| --- | --- |
| `/` | Redirect to knowledge list |
| `/workspaces` | Workspace list, select, create, rename, delete (empty only) |
| `/knowledge` | Corpus list |
| `/knowledge/{corpusId}/overview` | Stats, warnings, and linked adapters |
| `/knowledge/{corpusId}/files` | File manager and editor |
| `/knowledge/{corpusId}/search` | Hybrid search |
| `/knowledge/{corpusId}/links` | Link graph |
| `/knowledge/{corpusId}/ask` | Ask with citations |
| `/knowledge/{corpusId}/graph` | Graph and neighborhood view |
| `/settings/preferences` | Per-browser display prefs (date/time format, timezone, locale) |
| `/settings/workspace` | Workspace settings |
| `/settings/ai` | LLM and embedding providers |
| `/settings/ranking` | Ranking strategy and weights |
| `/settings/api-keys` | API keys |
| `/settings/mcp-tokens` | MCP tokens |
| `/settings/audit` | Audit trail |

## Page Layers

The standalone UI has three layers:

- Primary KB UI: corpora, files, editor, search, ask, links, graph.
- Operator settings: preferences, workspace, providers, embeddings, ranking, sync, keys,
  tokens.
- Diagnostics: health, index status, failed jobs, sync status, audit.

## Search And Ask Rules

- Search results show file path, heading path, preview, match kind, and ranking
  trace when available.
- Ask answers must show citations and uncertainty warnings.
- Retrieval trace belongs in diagnostics, not the primary answer text.
- Empty states should suggest indexing, provider, or filter checks.

## Accessibility Baseline

- Use semantic headings and landmarks (`header`, `main`, `nav`).
- Keep keyboard navigation intact for file trees, tabs, dialogs, and editors.
- Do not rely on color alone for status (`Badge`/`StatusBadge` include text).
- `Switch` controls carry a visible label or `aria-label` and expose
  `role="switch"` with `aria-checked`.
- Keep contrast high in light and dark themes.
- Sanitize rendered markdown before display (`sanitizeMarkdownPreviewHtml`).
