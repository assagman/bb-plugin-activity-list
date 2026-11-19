// Pure list model: status classes, activity times, and the grouped, sorted
// tree the sidebar draws. Kept free of React and of SDK runtime imports so
// scripts/smoke.ts can run it under plain Node as the release gate.
import type {
  PluginSidebarProject,
  PluginSidebarThread,
  PluginSidebarThreadIndicator,
} from "@get-bb/plugin-sdk/app";

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
 * A thread's own state, from bb's indicator. Chips and roll-ups count each
 * thread once by its own state; a row's glyph also folds in collapsed
 * children and drafts (bb's resolver), so a collapsed parent may glow for a
 * child that the counts list under the child itself.
 */
export function threadStatus(thread: Pick<PluginSidebarThread, "indicator">): StatusKind {
  return statusFromIndicator(thread.indicator);
}

/** The thread fields the model reads; a subset keeps fixtures small. */
export type ModelThread = Pick<
  PluginSidebarThread,
  | "id"
  | "projectId"
  | "parentThreadId"
  | "displayTitle"
  | "indicator"
  | "isPinned"
  | "isHidden"
  | "isArchived"
  | "updatedAt"
  | "latestAttentionAt"
>;

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
 * has not loaded yet (its threads arrived first).
 */
export type GroupKind = "pinned" | "project" | "pending";

/** One sidebar group with its sorted thread tree. */
export interface ProjectGroup<T extends ModelThread = ModelThread> {
  kind: GroupKind;
  key: string;
  /** Set only when `kind` is "project". */
  project: ModelProject | null;
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
    makeGroup("project", project.id, project, byProject.get(project.id) ?? []),
  );
  // A thread whose project is not in the list yet (it is still loading) keeps
  // a group under its id instead of vanishing.
  const known = new Set(projects.map((project) => project.id));
  for (const [projectId, list] of byProject) {
    if (!known.has(projectId)) groups.push(makeGroup("pending", projectId, null, list));
  }

  groups.sort(
    (a, b) =>
      b.activityAt - a.activityAt ||
      projectName(a).localeCompare(projectName(b)) ||
      a.key.localeCompare(b.key),
  );
  return {
    pinned: makeGroup("pinned", PINNED_GROUP_KEY, null, pinnedThreads),
    projects: groups,
    counts: countStatuses(visible.map(threadStatus)),
  };
}

function makeGroup<T extends ModelThread>(
  kind: GroupKind,
  key: string,
  project: ModelProject | null,
  threads: T[],
): ProjectGroup<T> {
  const roots = buildTrees(threads);
  return {
    kind,
    key,
    project,
    roots,
    threads,
    activityAt: roots[0]?.activityAt ?? 0,
    counts: countStatuses(threads.map(threadStatus)),
  };
}

/** Group labels. Pinned and the personal project's "Threads" match bb's list. */
const PINNED_GROUP_NAME = "Pinned";
const PERSONAL_GROUP_NAME = "Threads";
const PENDING_GROUP_NAME = "Loading project…";
const UNNAMED_PROJECT_NAME = "Untitled project";

/**
 * Display name of a group. The personal project has no name of its own (bb
 * sends null), so it takes bb's "Threads" label; a project still loading
 * shows a neutral name.
 */
export function projectName(group: Pick<ProjectGroup, "kind" | "project">): string {
  if (group.kind === "pinned") return PINNED_GROUP_NAME;
  if (group.kind === "pending" || group.project === null) return PENDING_GROUP_NAME;
  if (group.project.isPersonal) return PERSONAL_GROUP_NAME;
  return group.project.name || UNNAMED_PROJECT_NAME;
}

/** Counts of each status class, for group roll-up chips and the filter bar. */
export function countStatuses(kinds: Iterable<StatusKind>): Map<StatusKind, number> {
  const counts = new Map<StatusKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return counts;
}

/** Time units for the compact "3m" / "2h" / "5d" age label on each row. */
export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** Compact age of an activity time, as bb's rows show ages. */
export function formatAge(activityAt: number, now: number): string {
  const age = Math.max(0, now - activityAt);
  if (age < MINUTE_MS) return "now";
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)}m`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)}h`;
  if (age < WEEK_MS) return `${Math.floor(age / DAY_MS)}d`;
  return `${Math.floor(age / WEEK_MS)}w`;
}
