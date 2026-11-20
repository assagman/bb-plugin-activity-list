# bb Activity list

A sidebar thread list for [bb](https://getbb.app) that keeps bb's look and
adds three things:

- **Sort by activity.** Projects and threads sort by their latest activity,
  newest first, and move live as agents work. A busy sub-thread lifts its
  parent. Empty projects go last.
- **Colored status cues.** Each row shows its state: needs input, failed,
  working (bb's own running glyph), queued, background work, unread, draft,
  or idle. All colors come from the active bb theme. Rows that block on you
  get a tinted background and a side bar. A thread shows as unread only
  when its turn is fully complete: while a background agent or command of
  the agent is live, the row shows background work, because the agent
  starts again when that work returns. No timer decides this. A service in
  a bb terminal is not the agent's work and does not hold the unread dot.
- **Roll-ups and filters.** Group headers count the states inside, also when
  collapsed. Chips at the top filter the list to one state. The `?` chip
  shows a legend.

bb's thread menu, right-click menu, rename dialog, keyboard shortcuts, and
split drag work as in bb's own list. Pinned threads sort by activity too, not
by the manual pin order bb's list keeps.

## Install

```sh
npm ci --ignore-scripts
npm run build
bb plugin install "$PWD" --yes
```

bb picks a sidebar list per client in Settings → Appearance → Sidebar thread
list. Choose "Thread list (built-in)" there, or run
`bb plugin disable activity-list`, to go back to bb's list.

## Limits

- Organization is by project only. bb's custom sections and machine groups
  are not shown as groups; their threads show under their project.
- Collapse and filter choices are per browser, in local storage. The
  `bb thread-list prefs` keys do not apply.

## Contributing

After you clone, run `scripts/setup-hooks` once and install the hook tools
that [AGENTS.md](AGENTS.md) lists. Every check must pass before a push; never
use `--no-verify`.

## License

MIT
