---
name: activity-list
description: Explain or switch to the Activity list sidebar, which sorts projects and threads by latest activity and colors thread statuses.
---

# Activity list sidebar

The Activity list plugin replaces the sidebar's scrolling thread list. bb's own
list stays installed as the bundled `thread-list` plugin.

## Switch lists

The user picks the list in Settings → Appearance → Sidebar. The choice is per
client. `bb plugin disable activity-list` brings bb's list back everywhere.

## What the list does

- Projects sort by the latest activity of their threads, newest first.
  Projects with no visible thread go last, by name.
- Threads sort by activity, newest first. A thread's activity is the later of
  its last update and its last attention time. A sub-thread lifts its parent.
- Pinned threads show in Pinned at the top, also by activity.
- Each row has a status glyph. All colors come from the active theme's tokens:
  needs input (attention, pulsing, side bar), failed (destructive, side bar),
  working (bb's own running glyph and its counts, both in warning-text),
  unread (primary dot), and queued, background work, draft, idle (muted,
  told apart by shape).
- A thread shows as unread only when its turn is fully complete. An unread
  thread with a live background agent or command shows background work; the
  unread dot shows when that work ends. No timer decides this. To keep a
  service running without holding back the dot, start it in a bb terminal,
  not as a background command. Work in a sub-thread does not hold back its
  parent's dot.
- Group headers show colored counts of the states inside, also when collapsed.
- Chips at the top filter the list to one state.

## State

Collapsed groups, collapsed sub-threads, and the filter are kept in the
browser's local storage for this client. The `bb thread-list prefs` keys do not
apply to this list.
