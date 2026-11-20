// Release gate for the list model and the stored-prefs parser. Runs under
// plain Node (type stripping), without bb, so the push hook can prove the
// sort and status rules on every pushed tip. Exits non-zero on the first
// broken rule, naming it.
import assert from "node:assert/strict";
import {
  ancestorIds,
  buildGroups,
  DAY_MS,
  formatAge,
  groupView,
  HOUR_MS,
  MINUTE_MS,
  type ModelThread,
  projectName,
  ROLLUP_KINDS,
  rowState,
  settledStatus,
  statusFromIndicator,
  threadStatus,
  threadsWithStatus,
} from "../src/model.ts";
import { parsePrefs } from "../src/prefs-parse.ts";

/** Fixed clock so ages and orders never depend on when the gate runs. */
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

/** No live work: what bb reports for a thread with nothing running. */
const IDLE_ACTIVITY: ModelThread["activity"] = {
  workflows: 0,
  backgroundAgents: 0,
  backgroundCommands: 0,
  planMode: 0,
};

function thread(
  id: string,
  projectId: string,
  minutesAgo: number,
  extra: Partial<ModelThread> = {},
): ModelThread {
  const at = NOW - minutesAgo * MINUTE_MS;
  return {
    id,
    projectId,
    parentThreadId: null,
    displayTitle: id,
    indicator: "none",
    activity: IDLE_ACTIVITY,
    isPinned: false,
    isHidden: false,
    isArchived: false,
    updatedAt: at,
    latestAttentionAt: 0,
    ...extra,
  };
}

const checks: [string, () => void][] = [
  [
    "projects sort by latest activity, not by creation order",
    () => {
      const projects = [
        { id: "old", name: "Old", isPersonal: false },
        { id: "busy", name: "Busy", isPersonal: false },
        { id: "empty", name: "Empty", isPersonal: false },
      ];
      const { projects: groups } = buildGroups(
        [thread("a", "old", 300), thread("b", "busy", 2), thread("c", "old", 60)],
        projects,
      );
      assert.deepEqual(
        groups.map((group) => group.key),
        ["busy", "old", "empty"],
      );
    },
  ],
  [
    "threads sort newest first and a busy child lifts its parent",
    () => {
      const { projects: groups } = buildGroups(
        [
          thread("parent", "p", 500),
          thread("child", "p", 1, { parentThreadId: "parent" }),
          thread("solo", "p", 30),
        ],
        [{ id: "p", name: "P", isPersonal: false }],
      );
      const roots = groups[0]?.roots ?? [];
      assert.deepEqual(
        roots.map((node) => node.thread.id),
        ["parent", "solo"],
      );
      assert.equal(roots[0]?.children[0]?.thread.id, "child");
    },
  ],
  [
    "attention time counts as activity",
    () => {
      const { projects: groups } = buildGroups(
        [thread("x", "p", 100), thread("y", "p", 200, { latestAttentionAt: NOW - MINUTE_MS })],
        [{ id: "p", name: "P", isPersonal: false }],
      );
      assert.equal(groups[0]?.roots[0]?.thread.id, "y");
    },
  ],
  [
    "pinned threads leave their project; hidden and archived threads never show",
    () => {
      const { pinned, projects: groups } = buildGroups(
        [
          thread("pin", "p", 5, { isPinned: true }),
          thread("hid", "p", 1, { isHidden: true }),
          thread("arc", "p", 1, { isArchived: true }),
          thread("keep", "p", 9),
        ],
        [{ id: "p", name: "P", isPersonal: false }],
      );
      assert.deepEqual(
        pinned.threads.map((t) => t.id),
        ["pin"],
      );
      assert.deepEqual(
        groups[0]?.threads.map((t) => t.id),
        ["keep"],
      );
    },
  ],
  [
    "orphans and parent cycles stay visible as roots",
    () => {
      const { projects: groups } = buildGroups(
        [
          thread("orphan", "p", 1, { parentThreadId: "gone" }),
          thread("c1", "p", 2, { parentThreadId: "c2" }),
          thread("c2", "p", 3, { parentThreadId: "c1" }),
        ],
        [{ id: "p", name: "P", isPersonal: false }],
      );
      const ids = new Set<string>();
      const walk = (nodes: NonNullable<(typeof groups)[0]>["roots"]) => {
        for (const node of nodes) {
          ids.add(node.thread.id);
          walk(node.children);
        }
      };
      walk(groups[0]?.roots ?? []);
      assert.deepEqual([...ids].sort(), ["c1", "c2", "orphan"]);
    },
  ],
  [
    "the personal project takes bb's Threads label, never null",
    () => {
      const personal = { id: "me", name: null as unknown as string, isPersonal: true };
      const { projects: groups } = buildGroups([thread("t", "me", 1)], [personal]);
      assert.equal(groups[0] && projectName(groups[0]), "Threads");
    },
  ],
  [
    "a thread of an unknown project keeps a group",
    () => {
      const { projects: groups } = buildGroups([thread("t", "late", 1)], []);
      assert.equal(groups[0]?.key, "late");
      assert.equal(groups[0]?.kind, "pending");
    },
  ],
  [
    "indicators map to status classes; unknown kinds fall back to idle",
    () => {
      assert.equal(statusFromIndicator("waiting-for-input"), "needs-input");
      assert.equal(statusFromIndicator("unread-error"), "error");
      assert.equal(statusFromIndicator("queued-failed"), "error");
      assert.equal(statusFromIndicator("runtime"), "working");
      assert.equal(statusFromIndicator("workflow"), "background");
      assert.equal(statusFromIndicator("queued-waiting"), "queued");
      assert.equal(statusFromIndicator("unread-success"), "unread");
      assert.equal(statusFromIndicator("some-future-kind"), "idle");
    },
  ],
  [
    "counts and the filter hold the unread state while background work is live",
    () => {
      // A provider ends a turn and starts the next by itself when a background
      // task returns. In that gap bb reports the unread dot over the live task.
      const { projects: groups, counts } = buildGroups(
        [
          thread("agent", "p", 1, {
            indicator: "unread-success",
            activity: { ...IDLE_ACTIVITY, backgroundAgents: 1 },
          }),
          thread("command", "p", 2, {
            indicator: "unread-success",
            activity: { ...IDLE_ACTIVITY, backgroundCommands: 2 },
          }),
          thread("done", "p", 3, { indicator: "unread-success" }),
          // Live work never hides a state that outranks it in bb's order.
          thread("failed", "p", 4, {
            indicator: "unread-error",
            activity: { ...IDLE_ACTIVITY, backgroundAgents: 1 },
          }),
        ],
        [{ id: "p", name: "P", isPersonal: false }],
      );
      const group = groups[0];
      assert.ok(group);
      assert.deepEqual(
        threadsWithStatus(group, "background").map((t) => t.id),
        ["agent", "command"],
      );
      assert.deepEqual(
        threadsWithStatus(group, "unread").map((t) => t.id),
        ["done"],
      );
      assert.equal(group.counts.get("background"), 2);
      assert.equal(counts.get("unread"), 1);
      assert.equal(counts.get("error"), 1);
    },
  ],
  [
    "a thread reads as unread only when its turn has fully completed",
    () => {
      const status = (indicator: string, activity = IDLE_ACTIVITY) =>
        threadStatus({ indicator, activity } as Parameters<typeof threadStatus>[0]);
      const oneCommand = { ...IDLE_ACTIVITY, backgroundCommands: 1 };
      // An intermediate message: the turn is still open.
      assert.equal(status("runtime"), "working");
      // A silent continuation: the turn ended, but the command it waits for
      // is live, and the agent starts again when it returns.
      assert.equal(status("unread-success", oneCommand), "background");
      // A long-running command holds the state for as long as it is live; no
      // clock decides, so the same input reads the same at any age.
      assert.equal(status("unread-success", oneCommand), "background");
      // Genuine completion: the turn ended and nothing is live.
      assert.equal(status("unread-success"), "unread");
      // A read thread with live work was never unread; it stays background.
      assert.equal(status("background-command", oneCommand), "background");
    },
  ],
  [
    "only the unread state yields to live work, across the threads a row stands for",
    () => {
      const live = { activity: { ...IDLE_ACTIVITY, backgroundCommands: 1 } };
      const idle = { activity: IDLE_ACTIVITY };
      assert.equal(settledStatus("unread", [idle, live]), "background");
      assert.equal(settledStatus("unread", [idle]), "unread");
      for (const kind of ["working", "queued", "idle", "needs-input"] as const) {
        assert.equal(settledStatus(kind, [live]), kind);
      }
    },
  ],
  [
    "a row's label follows the state it shows",
    () => {
      const live = [{ activity: { ...IDLE_ACTIVITY, backgroundAgents: 1 } }];
      const unread = { indicator: "unread-success", label: "Unread thread succeeded" };
      // Held back: bb's label names the dot the row no longer shows.
      assert.deepEqual(rowState({ ...unread, rowStatus: null }, live), {
        kind: "background",
        label: "Background",
      });
      // Not held back: bb's own label stays.
      assert.deepEqual(rowState({ ...unread, rowStatus: null }, [{ activity: IDLE_ACTIVITY }]), {
        kind: "unread",
        label: "Unread thread succeeded",
      });
      // Another plugin's status is what the row draws, so its label wins.
      assert.deepEqual(
        rowState(
          { indicator: "unread-success", label: "Syncing", rowStatus: { label: "Syncing" } },
          live,
        ),
        { kind: "background", label: "Syncing" },
      );
      assert.deepEqual(rowState({ indicator: "none", label: null, rowStatus: null }, live), {
        kind: "idle",
        label: "Idle",
      });
    },
  ],
  [
    "ages read as bb-style compact labels",
    () => {
      assert.equal(formatAge(NOW - 10_000, NOW), "now");
      assert.equal(formatAge(NOW - 5 * MINUTE_MS, NOW), "5m");
      assert.equal(formatAge(NOW - 3 * HOUR_MS, NOW), "3h");
      assert.equal(formatAge(NOW - 2 * DAY_MS, NOW), "2d");
      assert.equal(formatAge(NOW + MINUTE_MS, NOW), "now");
    },
  ],
  [
    "stored prefs are validated and fall back on bad data",
    () => {
      assert.deepEqual(parsePrefs("not json"), {
        collapsedGroups: [],
        collapsedThreads: [],
        filter: "all",
      });
      assert.deepEqual(
        parsePrefs(JSON.stringify({ collapsedGroups: ["a", 3, ""], filter: "rm -rf" })),
        { collapsedGroups: ["a"], collapsedThreads: [], filter: "all" },
      );
      assert.equal(parsePrefs(JSON.stringify({ filter: "needs-input" })).filter, "needs-input");
      // Calm states have no chip, so a stored filter on them would hide most
      // threads with nothing on screen to clear it.
      assert.equal(parsePrefs(JSON.stringify({ filter: "idle" })).filter, "all");
      assert.equal(parsePrefs(JSON.stringify({ filter: "draft" })).filter, "all");
      assert.equal(
        parsePrefs(JSON.stringify({ collapsedThreads: ["x".repeat(300)] })).collapsedThreads.length,
        0,
      );
    },
  ],
  [
    "chip states run in attention order and leave out the calm states",
    () => {
      assert.deepEqual(ROLLUP_KINDS, [
        "needs-input",
        "error",
        "working",
        "queued",
        "background",
        "unread",
      ]);
    },
  ],
  [
    "the open thread's ancestors are found, and a parent cycle ends",
    () => {
      const threads = [
        thread("root", "p", 1),
        thread("mid", "p", 1, { parentThreadId: "root" }),
        thread("leaf", "p", 1, { parentThreadId: "mid" }),
        thread("c1", "p", 1, { parentThreadId: "c2" }),
        thread("c2", "p", 1, { parentThreadId: "c1" }),
      ];
      assert.deepEqual([...ancestorIds(threads, "leaf")].sort(), ["mid", "root"]);
      assert.deepEqual([...ancestorIds(threads, "root")], []);
      assert.deepEqual([...ancestorIds(threads, null)], []);
      assert.deepEqual([...ancestorIds(threads, "c1")].sort(), ["c1", "c2"]);
      // Walked over one group's threads, a chain through a thread outside the
      // group (archived, pinned) stops there, as the rendered tree does.
      const withoutMid = threads.filter((t) => t.id !== "mid");
      assert.deepEqual([...ancestorIds(withoutMid, "leaf")], ["mid"]);
    },
  ],
  [
    "a status filter lists matching threads flat, newest first, ties by title",
    () => {
      const { projects: groups } = buildGroups(
        [
          thread("b", "p", 5, { indicator: "unread-success" }),
          thread("a", "p", 5, { indicator: "unread-success", parentThreadId: "z" }),
          thread("z", "p", 1, { indicator: "unread-success" }),
          thread("busy", "p", 0, { indicator: "runtime" }),
        ],
        [{ id: "p", name: "P", isPersonal: false }],
      );
      const group = groups[0];
      assert.ok(group);
      assert.equal(group.kind, "project");
      assert.deepEqual(
        threadsWithStatus(group, "unread").map((t) => t.id),
        ["z", "a", "b"],
      );
      assert.equal(group.counts.get("unread"), 3);
      assert.equal(group.counts.get("working"), 1);
    },
  ],
  [
    "a group's body: tree, filter matches with the open thread, or left out",
    () => {
      const { pinned, projects: groups } = buildGroups(
        [
          thread("busy", "p", 0, { indicator: "runtime" }),
          thread("open", "p", 3),
          thread("done", "p", 9, { indicator: "unread-success" }),
        ],
        [{ id: "p", name: "P", isPersonal: false }],
      );
      const group = groups[0];
      assert.ok(group);
      const ids = (view: ReturnType<typeof groupView>) =>
        view && view.mode === "flat" ? view.threads.map((t) => t.id) : view;
      assert.deepEqual(groupView(group, "all", false, "open"), {
        mode: "tree",
        expanded: true,
        toggleLocked: false,
      });
      // The header agrees with the body: closed when collapsed, locked open
      // under a filter.
      assert.equal(groupView(group, "all", true, "open")?.expanded, false);
      assert.equal(groupView(group, "working", true, "open")?.expanded, true);
      assert.equal(groupView(group, "working", true, "open")?.toggleLocked, true);
      // Collapsed: only the open thread stays; none open, an empty body.
      assert.deepEqual(ids(groupView(group, "all", true, "open")), ["open"]);
      assert.deepEqual(ids(groupView(group, "all", true, null)), []);
      // Filtered: matches plus the open thread first, collapse ignored.
      assert.deepEqual(ids(groupView(group, "working", true, "open")), ["open", "busy"]);
      assert.deepEqual(ids(groupView(group, "working", false, "busy")), ["busy"]);
      // No match and the open thread elsewhere: the group is left out.
      assert.equal(groupView(group, "needs-input", false, "other"), null);
      // Empty Pinned has no header, as in bb's list.
      assert.equal(groupView(pinned, "all", false, null), null);
    },
  ],
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}\n${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`${checks.length - failed}/${checks.length} smoke checks passed`);
if (failed > 0) process.exit(1);
