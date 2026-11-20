# AGENTS.md

A bb plugin that replaces the sidebar thread list through the
`experimental_threadList` slot. It sorts projects and threads by activity and
colors thread statuses with bb theme tokens. [README.md](README.md) gives the
user view.

## Map

| Path | Role |
| --- | --- |
| `src/model.ts` | Pure model: status classes, activity times, grouped and sorted trees. |
| `src/prefs-parse.ts` | Stored-prefs schema and validating parser. |
| `src/prefs.ts` | localStorage-backed React store for collapse and filter state. |
| `src/StatusGlyph.tsx` | Status glyphs and their theme-token colors. |
| `src/ActivityList.tsx` | The list root: loads threads and prefs, composes the parts below. |
| `src/FilterBar.tsx` | Status filter chips and the glyph legend. |
| `src/GroupSection.tsx` | One group: header with roll-up counts, thread tree or filter results. |
| `src/ThreadRow.tsx` | One row, built from bb's own menu, title, and shortcut pieces. |
| `src/clock.ts` | Shared wall clock; only age labels subscribe to it. |
| `src/ui.ts` | Class-name helpers shared by the components. |
| `app.tsx` | Registers the list slot. |
| `server.ts` | Empty backend. bb requires a server entry. |
| `scripts/smoke.ts` | Release gate for the model and parser. Runs without bb. |
| `skills/activity-list/` | Skill that agents in bb threads read. |

## Commands

```sh
scripts/setup-hooks          # once per clone
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm run smoke
npm run build
bb plugin install "$PWD" --yes   # first time
bb plugin reload activity-list   # after each build
```

A change is done when lint, typecheck, smoke, and build pass, and the list
works in a running bb (sort, glyphs, menu, filter, collapse).

## Rules

- Colors: use bb theme tokens only (`attention`, `destructive`,
  `warning-text`, `primary`, `muted-foreground`). No fixed hues.
- Keep bb's own running glyph for the working state; tint it with the
  working tone. A row glyph and its group-header count share one color.
- Keep `src/model.ts` and `src/prefs-parse.ts` free of React and SDK runtime
  imports, so the smoke gate runs under plain Node.
- Treat stored prefs as untrusted; parse them through `parsePrefs`.
- Hover-only controls use `REVEAL_ON_INTENT`, not `hidden`: zero width keeps
  them in the tab order, and coarse-pointer devices always show them.
- Keep the row anchor's `data-sidebar-thread-shortcut-target` and
  `data-sidebar-thread-id` attributes; bb's shortcuts find rows by them.

## Hooks

`scripts/setup-hooks` turns on `.githooks/`. Do not edit the generic hook
files; put repository checks in `.githooks/<hook>.d/`. Never use
`--no-verify`.

The hooks fail closed, so install their tools first: `gitleaks`,
`markdownlint-cli2`, `shellcheck`, `shfmt`, `osv-scanner`, `semgrep`, and
`lizard`; add `actionlint` and `zizmor` once the repository has workflows.
`npm run lint` also lints the repository's shell scripts (`lint:sh`).

| Hook | Runs |
| --- | --- |
| `pre-commit` | Staged secret scan, whitespace, markdownlint, Biome, shell lint |
| `commit-msg` | Conventional subject, body, `Signed-off-by` |
| `pre-push` | Per commit: signature, DCO, message, secrets. Per tip: workflows, osv-scanner, semgrep, lizard, then `npm ci`, lint, typecheck, build, smoke, `npm audit` |

## Known risks

- The running glyph's tint reaches into bb's spinner with `[&_svg]:text-current`.
  It holds while bb paints the spinner on its own `svg` with a text color. If
  a bb update moves that color elsewhere, the spinner turns muted again; check
  the running glyph after each bb update.
- Rows are not windowed. A sidebar with many hundreds of expanded threads
  mounts every row; collapse groups or filter if it gets slow.
- `settledStatus` exists because bb ranks its unread dot above background
  agents and commands. If a bb update ranks that work first, the rule has no
  effect; delete it then.
