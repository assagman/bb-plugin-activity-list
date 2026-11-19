// One sidebar group: Pinned or a project. Its header carries the roll-up of
// states inside, so a collapsed project still shows what waits in it; its body
// is the activity-sorted thread tree, or a flat list while a filter is on.
import {
  experimental_Icon as Icon,
  type PluginSidebarThread,
  useBbNavigate,
} from "@get-bb/plugin-sdk/app";
import { type ReactNode, useMemo } from "react";
import {
  ancestorIds,
  type ProjectGroup,
  projectName,
  ROLLUP_KINDS,
  STATUS_LABEL,
  type StatusKind,
  type ThreadNode,
  threadActivityAt,
  threadsWithStatus,
} from "./model.ts";
import type { StatusFilter } from "./prefs-parse.ts";
import { STATUS_TONE } from "./StatusGlyph.tsx";
import { NO_THREADS, ThreadRow } from "./ThreadRow.tsx";
import { cx, FOCUS_RING, META_TEXT } from "./ui.ts";

type Thread = PluginSidebarThread;
type Node = ThreadNode<Thread>;
type Group = ProjectGroup<Thread>;

/** Callbacks and view state every row in the list shares. */
export interface RowContext {
  activeThreadId: string | null;
  collapsedThreads: ReadonlySet<string>;
  onToggleThread: (id: string) => void;
  onNavigate: () => void;
}

export interface GroupSectionProps {
  group: Group;
  filter: StatusFilter;
  collapsed: boolean;
  rows: RowContext;
  onToggleGroup: (key: string) => void;
}

export function GroupSection({ group, filter, collapsed, rows, onToggleGroup }: GroupSectionProps) {
  const navigate = useBbNavigate();
  const { activeThreadId } = rows;
  // Walked over this group's threads only: a parent chain through an archived
  // or pinned thread is cut in the tree too, so that parent must not lock.
  const openAncestors = useMemo(
    () => ancestorIds(group.threads, activeThreadId),
    [group.threads, activeThreadId],
  );
  // A filter lists rows flat and ignores collapse, so the header toggle is
  // locked open instead of saving a choice the user cannot see.
  const filtering = filter !== "all";
  const expanded = filtering || !collapsed;

  // Pinned has no header when empty, as in bb's list.
  if (group.kind === "pinned" && group.threads.length === 0) return null;

  let body: ReactNode = null;
  if (filtering) {
    const matches = threadsWithStatus(group, filter);
    // The open thread stays in view under a filter, so the user never loses
    // the row of the page they are on.
    const active = activeThreadId
      ? group.threads.find((thread) => thread.id === activeThreadId)
      : undefined;
    if (active && !matches.includes(active)) matches.unshift(active);
    if (matches.length === 0) return null;
    body = matches.map((thread) => <FlatThreadRow key={thread.id} thread={thread} rows={rows} />);
  } else if (collapsed) {
    // A collapsed group still shows the open thread, for the same reason.
    const active = activeThreadId
      ? group.threads.find((thread) => thread.id === activeThreadId)
      : undefined;
    body = active ? <FlatThreadRow thread={active} rows={rows} /> : null;
  } else {
    body = group.roots.map((node) => (
      <ThreadTree
        key={node.thread.id}
        node={node}
        depth={0}
        rows={rows}
        openAncestors={openAncestors}
      />
    ));
  }

  const name = projectName(group);
  const isEmpty = group.threads.length === 0;
  return (
    <section aria-label={name} className="flex flex-col">
      <div className="group/header relative flex h-7 items-center gap-1 rounded-md pr-1 pl-1 hover:bg-sidebar-accent/60">
        <button
          type="button"
          aria-expanded={expanded}
          aria-disabled={filtering || undefined}
          title={filtering ? "Clear the status filter to collapse groups" : undefined}
          onClick={() => {
            if (!filtering) onToggleGroup(group.key);
          }}
          className={cx(
            "flex min-w-0 flex-1 items-center gap-1 self-stretch rounded-md text-left aria-disabled:cursor-default",
            FOCUS_RING,
          )}
        >
          <Icon
            name={expanded ? "ChevronDown" : "ChevronRight"}
            fallback="ChevronRight"
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span
            className={cx(
              "truncate text-xs font-medium",
              isEmpty ? "text-muted-foreground/70" : "text-muted-foreground",
            )}
          >
            {name}
          </span>
        </button>
        <RollupChips counts={group.counts} />
        {group.kind === "project" ? (
          <button
            type="button"
            aria-label={`New thread in ${name}`}
            title={`New thread in ${name}`}
            onClick={() => {
              navigate.toCompose({ projectId: group.key, focusPrompt: true });
              rows.onNavigate();
            }}
            // Shown on hover and whenever focus is in the header, so a
            // keyboard user tabbing from the group toggle can reach it.
            className={cx(
              "hidden size-5 shrink-0 items-center justify-center rounded text-muted-foreground group-focus-within/header:flex group-hover/header:flex hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:flex",
              FOCUS_RING,
            )}
          >
            <Icon name="Plus" aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>
      {body ? <div className="flex flex-col">{body}</div> : null}
    </section>
  );
}

/** Colored counts next to a group name: what waits inside, even when collapsed. */
function RollupChips({ counts }: { counts: ReadonlyMap<StatusKind, number> }) {
  const shown = ROLLUP_KINDS.filter((kind) => (counts.get(kind) ?? 0) > 0);
  if (shown.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {shown.map((kind) => (
        <span
          key={kind}
          title={`${STATUS_LABEL[kind]}: ${counts.get(kind)}`}
          className={cx(
            "inline-flex items-center gap-0.5 font-medium tabular-nums",
            META_TEXT,
            STATUS_TONE[kind],
          )}
        >
          <span
            aria-hidden
            className={cx(
              "size-1.5 rounded-full",
              // A ring for running work, a dot for the rest: the count still
              // reads apart from needs input without color.
              kind === "working" ? "border border-current" : "bg-current",
            )}
          />
          <span className="sr-only">{STATUS_LABEL[kind]}:</span>
          {counts.get(kind)}
        </span>
      ))}
    </span>
  );
}

/** A row outside the tree (filter results, a collapsed group's open thread). */
function FlatThreadRow({ thread, rows }: { thread: Thread; rows: RowContext }) {
  return (
    <ThreadRow
      thread={thread}
      depth={0}
      activityAt={threadActivityAt(thread)}
      isActive={thread.id === rows.activeThreadId}
      hiddenThreads={NO_THREADS}
      childCount={0}
      isCollapsed={false}
      toggleLocked={false}
      onToggle={rows.onToggleThread}
      onNavigate={rows.onNavigate}
    />
  );
}

/** Every thread under a node, so a collapsed parent can show their states. */
function descendants(node: Node): Thread[] {
  return node.children.flatMap((child) => [child.thread, ...descendants(child)]);
}

function ThreadTree({
  node,
  depth,
  rows,
  openAncestors,
}: {
  node: Node;
  depth: number;
  rows: RowContext;
  /** Ancestors of the open thread in this group; they stay expanded. */
  openAncestors: ReadonlySet<string>;
}) {
  const hasChildren = node.children.length > 0;
  const locked = hasChildren && openAncestors.has(node.thread.id);
  const collapsed = hasChildren && !locked && rows.collapsedThreads.has(node.thread.id);
  const hidden = useMemo(() => (collapsed ? descendants(node) : NO_THREADS), [collapsed, node]);
  return (
    <>
      <ThreadRow
        thread={node.thread}
        depth={depth}
        activityAt={node.activityAt}
        isActive={node.thread.id === rows.activeThreadId}
        hiddenThreads={hidden}
        childCount={node.children.length}
        isCollapsed={collapsed}
        toggleLocked={locked}
        onToggle={rows.onToggleThread}
        onNavigate={rows.onNavigate}
      />
      {collapsed
        ? null
        : node.children.map((child) => (
            <ThreadTree
              key={child.thread.id}
              node={child}
              depth={depth + 1}
              rows={rows}
              openAncestors={openAncestors}
            />
          ))}
    </>
  );
}

/** Builds the shared row context, stable across renders while inputs hold. */
export function useRowContext(
  activeThreadId: string | null,
  collapsedThreads: readonly string[],
  onToggleThread: (id: string) => void,
  onNavigate: () => void,
): RowContext {
  const collapsedSet = useMemo(() => new Set(collapsedThreads), [collapsedThreads]);
  return useMemo(
    () => ({
      activeThreadId,
      collapsedThreads: collapsedSet,
      onToggleThread,
      onNavigate,
    }),
    [activeThreadId, collapsedSet, onToggleThread, onNavigate],
  );
}
