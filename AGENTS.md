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
| `src/ActivityList.tsx` | The list: filter bar, legend, groups, rows. |
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
- Keep the row anchor's `data-sidebar-thread-shortcut-target` and
  `data-sidebar-thread-id` attributes; bb's shortcuts find rows by them.

## Hooks

`scripts/setup-hooks` turns on `.githooks/`. Do not edit the generic hook
files; put repository checks in `.githooks/<hook>.d/`. Never use
`--no-verify`.
