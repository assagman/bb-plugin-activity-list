// Pure list model: status classes, activity times, and the grouped, sorted
// tree the sidebar draws. Kept free of React and of SDK runtime imports so
// scripts/smoke.ts can run it under plain Node as the release gate.
import type {
  PluginSidebarProject,
  PluginSidebarThread,
  PluginSidebarThreadIndicator,
} from "@get-bb/plugin-sdk/app";

/** Group labels. Pinned and the personal project's "Threads" match bb's list. */
const PINNED_GROUP_NAME = "Pinned";
const PERSONAL_GROUP_NAME = "Threads";
const PENDING_GROUP_NAME = "Loading project…";
const UNNAMED_PROJECT_NAME = "Untitled project";

/** Time units for the compact "3m" / "2h" / "5d" age label on each row. */
export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * The status classes the list colors. bb reports a dozen indicator kinds; the
 * user asked for a few clear states, so related kinds share one class.
 */
export type StatusKind =
  | "needs-input"
  | "error"
  | "working"
  | "queued"
  | "background"
  | "unread"
  | "draft"
  | "idle";

/**
 * Attention order, most urgent first. The legend, the filter chips, and the
 * group roll-up chips list states in this order, so urgent ones read first.
 */
export const STATUS_PRIORITY: readonly StatusKind[] = [
  "needs-input",
  "error",
  "working",
  "queued",
  "background",
  "unread",
  "draft",
  "idle",
];

/** Human labels, shared by tooltips, the filter bar, and screen readers. */
export const STATUS_LABEL: Readonly<Record<StatusKind, string>> = {
  "needs-input": "Needs input",
  error: "Failed",
  working: "Working",
  queued: "Queued",
  background: "Background",
  unread: "Unread",
  draft: "Draft",
  idle: "Idle",
};

/**
 * Maps bb's indicator to a status class. bb adds indicator kinds over time, so
 * an unknown kind falls back to idle instead of breaking the row.
 */
export function statusFromIndicator(indicator: PluginSidebarThreadIndicator | string): StatusKind {
  switch (indicator) {
    case "waiting-for-input":
      return "needs-input";
    case "unread-error":
    case "queued-failed":
      return "error";
    case "runtime":
    case "working-draft":
      return "working";
    case "queued-waiting":
      return "queued";
    case "workflow":
    case "background-agent":
    case "background-command":
    case "plan-mode":
      return "background";
    case "unread-success":
      return "unread";
    case "draft":
      return "draft";
    default:
      return "idle";
  }
}

/** Calm states: no chip, no roll-up count; they are what the user looks past. */
const CALM_KINDS: ReadonlySet<StatusKind> = new Set(["draft", "idle"]);

/** States that get a filter chip and a roll-up count, in attention order. */
export const ROLLUP_KINDS: readonly StatusKind[] = STATUS_PRIORITY.filter(
  (kind) => !CALM_KINDS.has(kind),
);

/**
 * Holds the unread state back while background work is live. A provider ends a
 * turn and starts the next by itself when a background agent or command
 * returns; in that gap bb reports the thread idle and unread, and ranks its
 * unread dot above that work. The user reads the dot as "finished, come and
 * look", so it waits for the work. Workflows and plan mode need no rule: bb
 * ranks them above the dot itself.
 *
 * @param threads The thread plus any hidden threads its row stands for; bb
 *   counts hidden threads' work toward the row the same way.
 */
export function settledStatus(
  kind: StatusKind,
  threads: readonly Pick<PluginSidebarThread, "activity">[],
): StatusKind {
  if (kind !== "unread") return kind;
  const hasLiveWork = threads.some(
    ({ activity }) => activity.backgroundAgents > 0 || activity.backgroundCommands > 0,
  );
  return hasLiveWork ? "background" : kind;
}

/**
 * A thread's own state, from bb's indicator once live work has settled. Chips
 * and roll-ups count each thread once by its own state; a row's glyph also
 * folds in collapsed children and drafts (bb's resolver), so a collapsed
 * parent may glow for a child that the counts list under the child itself.
 */
export function threadStatus(
  thread: Pick<PluginSidebarThread, "indicator" | "activity">,
): StatusKind {
  return settledStatus(statusFromIndicator(thread.indicator), [thread]);
}

/** What bb's resolver reports for a row; the fields {@link rowState} reads. */
interface ResolvedRow {
  indicator: PluginSidebarThreadIndicator | string;
  /** bb's label for what bb's row shows: the row status's, else the indicator's. */
  label: string | null;
  /** Another plugin's status, when it shows in place of the indicator. */
  rowStatus: { label: string } | null;
}

/**
 * The state and accessible label a row shows. Kept here, not in the row
 * component, so the smoke gate proves that a row and the counts hold the
 * unread state back by one rule. bb's label names bb's indicator, so a row
 * that shows another state takes this list's label, unless another plugin's
 * status is what the row draws.
 */
export function rowState(
  resolved: ResolvedRow,
  threads: readonly Pick<PluginSidebarThread, "activity">[],
): { kind: StatusKind; label: string } {
  const reported = statusFromIndicator(resolved.indicator);
  const kind = settledStatus(reported, threads);
  const bbLabel = kind === reported ? resolved.label : (resolved.rowStatus?.label ?? null);
  return { kind, label: bbLabel ?? STATUS_LABEL[kind] };
}

/** The thread fields the model reads; a subset keeps fixtures small. */
export type ModelThread = Pick<
  PluginSidebarThread,
  | "id"
  | "projectId"
  | "parentThreadId"
  | "displayTitle"
  | "indicator"
  | "activity"
  | "isPinned"
  | "isHidden"
  | "isArchived"
  | "updatedAt"
  | "latestAttentionAt"
>;

/** The project fields the list reads, so the smoke gate can build plain fixtures. */
export type ModelProject = Pick<PluginSidebarProject, "id" | "name" | "isPersonal">;

/**
 * When a thread last did something the user cares about. `updatedAt` moves on
 * messages and status changes; `latestAttentionAt` moves when a turn ends or
 * the agent asks for input. The later one is the thread's activity time.
 */
export function threadActivityAt(thread: ModelThread): number {
  return Math.max(thread.updatedAt, thread.latestAttentionAt);
}

/** One thread row with its visible sub-threads. */
export interface ThreadNode<T extends ModelThread = ModelThread> {
  thread: T;
  children: ThreadNode<T>[];
  /** Latest activity in this subtree, so a busy child lifts its parent. */
  activityAt: number;
}

/**
 * What a group stands for: Pinned, a known project, or a project whose record
 * has not loaded yet (its threads arrived first). Only a known project carries
 * its record, and the type says so, so readers need no null guard for it.
 */
export type GroupIdentity =
  | { kind: "project"; project: ModelProject }
  | { kind: "pinned"; project: null }
  | { kind: "pending"; project: null };

/** One sidebar group with its sorted thread tree. */
export type ProjectGroup<T extends ModelThread = ModelThread> = GroupIdentity & GroupContent<T>;

/** The threads of a group, shared by every group kind. */
interface GroupContent<T extends ModelThread> {
  key: string;
  roots: ThreadNode<T>[];
  /** Latest activity of any thread in the group; 0 for an empty project. */
  activityAt: number;
  /** Every thread in the group, flat, for roll-ups and the filter. */
  threads: T[];
  /** Own-state counts of the group's threads, for its roll-up chips. */
  counts: ReadonlyMap<StatusKind, number>;
}

/** Key of the Pinned group, outside the project id space. */
export const PINNED_GROUP_KEY = "pinned";

/** Newest first; the title breaks ties so equal times never swap on re-render. */
function compareByActivity(aAt: number, a: ModelThread, bAt: number, b: ModelThread): number {
  return bAt - aAt || a.displayTitle.localeCompare(b.displayTitle) || a.id.localeCompare(b.id);
}

/** Sibling order in a tree: by subtree activity, so a busy child lifts its parent. */
function compareNodes(a: ThreadNode, b: ThreadNode): number {
  return compareByActivity(a.activityAt, a.thread, b.activityAt, b.thread);
}

/** Threads bb's own list shows: not internal helper threads, not archived. */
export function isVisibleThread(thread: Pick<ModelThread, "isHidden" | "isArchived">): boolean {
  return !thread.isHidden && !thread.isArchived;
}

/**
 * A group's threads in one state, flat and newest first. The status filter
 * shows them this way: their parents may not match, and the point is one scan
 * over every thread in that state.
 */
export function threadsWithStatus<T extends ModelThread>(
  group: ProjectGroup<T>,
  kind: StatusKind,
): T[] {
  return group.threads
    .filter((thread) => threadStatus(thread) === kind)
    .sort((a, b) => compareByActivity(threadActivityAt(a), a, threadActivityAt(b), b));
}

/** The filter bar's choices: everything, or one status class. */
export type StatusFilter = "all" | StatusKind;

/**
 * How a group draws: its body (the thread tree, or a flat list of filter
 * results or a collapsed group's open thread) and its header toggle. Decided
 * in one place so the chevron never disagrees with the body under it.
 */
export type GroupView<T> = ({ mode: "tree" } | { mode: "flat"; threads: T[] }) & {
  /** Whether the header shows the group as open. */
  expanded: boolean;
  /** Set while a filter is on: the toggle saves no choice the user cannot see. */
  toggleLocked: boolean;
};

/**
 * Picks a group's body, or null when the group is left out. A filter lists
 * matches flat and ignores collapse; a collapsed group shows only the open
 * thread. Both keep the open thread in view, so the user never loses the row
 * of the page they are on. Empty Pinned and filtered groups with no match are
 * left out, as bb's list leaves out empty Pinned.
 */
export function groupView<T extends ModelThread>(
  group: ProjectGroup<T>,
  filter: StatusFilter,
  collapsed: boolean,
  activeThreadId: string | null,
): GroupView<T> | null {
  if (group.kind === "pinned" && group.threads.length === 0) return null;
  if (filter === "all" && !collapsed) return { mode: "tree", expanded: true, toggleLocked: false };
  const active =
    activeThreadId === null ? undefined : group.threads.find((t) => t.id === activeThreadId);
  if (filter === "all") {
    const threads = active ? [active] : [];
    return { mode: "flat", threads, expanded: false, toggleLocked: false };
  }
  const matches = threadsWithStatus(group, filter);
  if (active && !matches.includes(active)) matches.unshift(active);
  if (matches.length === 0) return null;
  return { mode: "flat", threads: matches, expanded: true, toggleLocked: true };
}

/**
 * Ids of the open thread's ancestors. Their rows stay expanded, whatever the
 * saved collapse state, so the row of the page the user is on stays visible.
 */
export function ancestorIds(
  threads: readonly Pick<ModelThread, "id" | "parentThreadId">[],
  threadId: string | null,
): ReadonlySet<string> {
  const ancestors = new Set<string>();
  if (threadId === null) return ancestors;
  const parentOf = new Map(threads.map((thread) => [thread.id, thread.parentThreadId]));
  let current = parentOf.get(threadId) ?? null;
  // The seen-check stops a corrupt parent cycle instead of looping forever.
  while (current !== null && !ancestors.has(current)) {
    ancestors.add(current);
    current = parentOf.get(current) ?? null;
  }
  return ancestors;
}

/**
 * Builds parent/child trees from a flat thread list. A child whose parent is
 * not in the list (archived, pinned, or in another group) becomes a root, so
 * no thread disappears.
 */
export function buildTrees<T extends ModelThread>(threads: readonly T[]): ThreadNode<T>[] {
  const nodes = new Map<string, ThreadNode<T>>();
  for (const thread of threads) {
    nodes.set(thread.id, { thread, children: [], activityAt: threadActivityAt(thread) });
  }
  const roots: ThreadNode<T>[] = [];
  for (const node of nodes.values()) {
    const parentId = node.thread.parentThreadId;
    const parent = parentId === null ? undefined : nodes.get(parentId);
    if (parent && !createsCycle(node, parent, nodes)) parent.children.push(node);
    else roots.push(node);
  }
  for (const root of roots) settle(root);
  roots.sort(compareNodes);
  return roots;
}

/**
 * Guards against a parent chain that loops back to the node. bb's data should
 * never do that, but a loop would otherwise drop the whole cycle from view.
 */
function createsCycle<T extends ModelThread>(
  node: ThreadNode<T>,
  parent: ThreadNode<T>,
  nodes: ReadonlyMap<string, ThreadNode<T>>,
): boolean {
  const seen = new Set<string>([node.thread.id]);
  let current: ThreadNode<T> | undefined = parent;
  while (current) {
    if (seen.has(current.thread.id)) return true;
    seen.add(current.thread.id);
    const nextId: string | null = current.thread.parentThreadId;
    current = nextId === null ? undefined : nodes.get(nextId);
  }
  return false;
}

/** Lifts subtree activity into each node and sorts children, depth first. */
function settle(node: ThreadNode): number {
  for (const child of node.children) {
    node.activityAt = Math.max(node.activityAt, settle(child));
  }
  node.children.sort(compareNodes);
  return node.activityAt;
}

/**
 * Groups visible threads into Pinned plus one group per project. Projects sort
 * by latest activity, newest first; projects with no visible thread go last,
 * by name, so a new empty project stays findable without crowding the top.
 */
export function buildGroups<T extends ModelThread>(
  threads: readonly T[],
  projects: readonly ModelProject[],
): {
  pinned: ProjectGroup<T>;
  projects: ProjectGroup<T>[];
  /** Own-state counts over every visible thread, for the filter chips. */
  counts: ReadonlyMap<StatusKind, number>;
} {
  const visible = threads.filter(isVisibleThread);
  const pinnedThreads = visible.filter((thread) => thread.isPinned);
  const byProject = new Map<string, T[]>();
  for (const thread of visible) {
    if (thread.isPinned) continue;
    const list = byProject.get(thread.projectId);
    if (list) list.push(thread);
    else byProject.set(thread.projectId, [thread]);
  }

  const groups: ProjectGroup<T>[] = projects.map((project) =>
    makeGroup({ kind: "project", project }, project.id, byProject.get(project.id) ?? []),
  );
  // A thread whose project is not in the list yet (it is still loading) keeps
  // a group under its id instead of vanishing.
  const known = new Set(projects.map((project) => project.id));
  for (const [projectId, list] of byProject) {
    if (!known.has(projectId))
      groups.push(makeGroup({ kind: "pending", project: null }, projectId, list));
  }

  groups.sort(
    (a, b) =>
      b.activityAt - a.activityAt ||
      projectName(a).localeCompare(projectName(b)) ||
      a.key.localeCompare(b.key),
  );
  return {
    pinned: makeGroup({ kind: "pinned", project: null }, PINNED_GROUP_KEY, pinnedThreads),
    projects: groups,
    counts: countStatuses(visible.map(threadStatus)),
  };
}

/** One group with its tree, latest activity, and roll-up counts precomputed. */
function makeGroup<T extends ModelThread>(
  identity: GroupIdentity,
  key: string,
  threads: T[],
): ProjectGroup<T> {
  const roots = buildTrees(threads);
  return {
    ...identity,
    key,
    roots,
    threads,
    activityAt: roots[0]?.activityAt ?? 0,
    counts: countStatuses(threads.map(threadStatus)),
  };
}

/**
 * Display name of a group. The personal project has no name of its own (bb
 * sends null), so it takes bb's "Threads" label; a project still loading
 * shows a neutral name.
 */
export function projectName(group: GroupIdentity): string {
  if (group.kind === "pinned") return PINNED_GROUP_NAME;
  if (group.kind === "pending") return PENDING_GROUP_NAME;
  if (group.project.isPersonal) return PERSONAL_GROUP_NAME;
  return group.project.name || UNNAMED_PROJECT_NAME;
}

/** Counts of each status class, for group roll-up chips and the filter bar. */
export function countStatuses(kinds: Iterable<StatusKind>): Map<StatusKind, number> {
  const counts = new Map<StatusKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return counts;
}

/** Compact age of an activity time, as bb's rows show ages. */
export function formatAge(activityAt: number, now: number): string {
  const age = Math.max(0, now - activityAt);
  if (age < MINUTE_MS) return "now";
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)}m`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)}h`;
  if (age < WEEK_MS) return `${Math.floor(age / DAY_MS)}d`;
  return `${Math.floor(age / WEEK_MS)}w`;
}
