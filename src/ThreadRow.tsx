// One thread row. It keeps bb's row anatomy (glyph, provider icon, title,
// hover menu) and host behavior by rendering bb's own pieces: the thread menu
// and right-click menu, the title with mention chips, split drag, and the
// shortcut data attributes bb's keyboard navigation looks up.
import {
  experimental_Icon as Icon,
  type PluginSidebarThread,
  type PluginThreadActionTarget,
  experimental_ProviderIcon as ProviderIcon,
  experimental_resolveThreadStatus as resolveThreadStatus,
  experimental_ThreadActionsContextMenu as ThreadActionsContextMenu,
  experimental_ThreadActionsMenu as ThreadActionsMenu,
  ThreadTitle,
  useSidebarThreadDraft,
  useSidebarThreadRowStatus,
  useSidebarThreadShortcut,
  experimental_useSidebarThreadSplit as useSidebarThreadSplit,
} from "@get-bb/plugin-sdk/app";
import { memo, useMemo } from "react";
import { useNow } from "./clock.ts";
import { formatAge, STATUS_LABEL, type StatusKind, statusFromIndicator } from "./model.ts";
import { StatusGlyph } from "./StatusGlyph.tsx";
import { cx, FOCUS_RING, KEYCAP_TEXT, META_TEXT, REVEAL_ON_INTENT, ROW_GAP } from "./ui.ts";

/** Horizontal step per nesting level, as bb indents sub-threads. */
const INDENT_PX = 12;
/** Left padding of a root row, so glyphs line up under group header text. */
const ROW_BASE_PADDING_PX = 8;

/**
 * Row tint and side bar for states that block on the user, so they stand out
 * even when the glyph is small. Theme tokens only, like the glyphs.
 */
const STATUS_ACCENT: Partial<Record<StatusKind, { row: string; bar: string }>> = {
  "needs-input": { row: "bg-attention/10", bar: "bg-attention" },
  error: { row: "bg-destructive/10", bar: "bg-destructive" },
};

/** Shared empty list, so rows without hidden children keep a stable prop. */
export const NO_THREADS: readonly PluginSidebarThread[] = [];

/** The fields bb's thread menu needs, taken from the live sidebar thread. */
function toActionTarget(thread: PluginSidebarThread): PluginThreadActionTarget {
  return {
    id: thread.id,
    projectId: thread.projectId,
    parentThreadId: thread.parentThreadId,
    parentNotifications: thread.parentNotifications,
    archivedAt: thread.archivedAt,
    pinnedAt: thread.pinnedAt,
    sectionId: thread.sectionId,
    isUnread: thread.isUnread,
    status: thread.status,
    environment: thread.environment?.id
      ? { id: thread.environment.id, path: thread.environment.path }
      : null,
  };
}

export interface ThreadRowProps {
  thread: PluginSidebarThread;
  depth: number;
  /** Activity time the age label shows; a parent's includes its subtree. */
  activityAt: number;
  isActive: boolean;
  /** Collapsed sub-threads; their attention and work show on this row. */
  hiddenThreads: readonly PluginSidebarThread[];
  childCount: number;
  isCollapsed: boolean;
  /**
   * The open thread sits under this row, so it stays expanded whatever the
   * saved state; the toggle says so instead of saving a choice with no effect.
   */
  toggleLocked: boolean;
  onToggle: (id: string) => void;
  onNavigate: () => void;
}

export const ThreadRow = memo(function ThreadRow({
  thread,
  depth,
  activityAt,
  isActive,
  hiddenThreads,
  childCount,
  isCollapsed,
  toggleLocked,
  onToggle,
  onNavigate,
}: ThreadRowProps) {
  const { hasUnsubmittedDraft } = useSidebarThreadDraft(thread.id);
  const rowStatus = useSidebarThreadRowStatus(thread.id);
  const shortcut = useSidebarThreadShortcut(thread.id);
  const { splitProps } = useSidebarThreadSplit(thread.id);
  // bb's own resolver folds in drafts, collapsed children, and other plugins'
  // row statuses, so this row reports exactly what bb's row would.
  const resolved = resolveThreadStatus({ thread, hiddenThreads, hasUnsubmittedDraft, rowStatus });
  const kind = statusFromIndicator(resolved.indicator);
  // Another plugin's status replaces bb's glyph, so this list's tint would
  // disagree with what the row shows; the row stays plain then.
  const accent = resolved.rowStatus ? undefined : STATUS_ACCENT[kind];
  const target = useMemo(() => toActionTarget(thread), [thread]);
  const childLabel = toggleLocked
    ? `${childCount} sub-threads, kept open: it contains the open thread`
    : `${isCollapsed ? "Show" : "Hide"} ${childCount} sub-threads`;
  return (
    <ThreadActionsContextMenu thread={target}>
      <div
        data-active={isActive || undefined}
        className={cx(
          "group/row relative flex h-7 items-center rounded-md pr-1 text-sm",
          ROW_GAP,
          "hover:bg-sidebar-accent data-[active]:bg-sidebar-accent data-[active]:text-sidebar-accent-foreground",
          accent?.row,
        )}
        style={{ paddingLeft: ROW_BASE_PADDING_PX + depth * INDENT_PX }}
      >
        {accent ? (
          <span
            aria-hidden
            className={cx("absolute top-1 bottom-1 left-0 w-0.5 rounded-full", accent.bar)}
          />
        ) : null}
        {/* The anchor covers the row so a click anywhere opens the thread;
            the controls after it sit above it (relative) and keep their own
            clicks. bb routes a plain click on href in place. */}
        <a
          href={thread.href}
          draggable={false}
          data-sidebar-thread-shortcut-target=""
          data-sidebar-thread-id={thread.id}
          aria-label={`${thread.displayTitle}, ${resolved.label ?? STATUS_LABEL[kind]}`}
          aria-current={isActive ? "page" : undefined}
          aria-keyshortcuts={shortcut?.ariaKeyshortcuts}
          {...splitProps}
          onClick={() => onNavigate()}
          className={cx("absolute inset-0 rounded-md", FOCUS_RING)}
        />
        <StatusGlyph
          kind={kind}
          indicator={resolved.indicator}
          rowStatus={resolved.rowStatus}
          decorative
        />
        <ProviderIcon
          providerKind="agent"
          provider={{ id: thread.providerId }}
          aria-hidden
          className="size-3.5 shrink-0 opacity-70"
        />
        <span
          className={cx(
            "pointer-events-none min-w-0 flex-1 truncate",
            thread.isUnread || isActive
              ? "font-medium text-sidebar-foreground"
              : "text-sidebar-foreground/80",
          )}
        >
          <ThreadTitle threadId={thread.id} />
        </span>
        {childCount > 0 ? (
          <button
            type="button"
            aria-expanded={!isCollapsed}
            aria-disabled={toggleLocked || undefined}
            aria-label={childLabel}
            title={childLabel}
            onClick={() => {
              if (!toggleLocked) onToggle(thread.id);
            }}
            className={cx(
              "relative flex h-5 shrink-0 items-center gap-0.5 rounded px-1 text-muted-foreground tabular-nums hover:bg-sidebar-accent hover:text-sidebar-foreground aria-disabled:cursor-default aria-disabled:opacity-60",
              META_TEXT,
              FOCUS_RING,
            )}
          >
            <Icon
              name={isCollapsed ? "ChevronRight" : "ChevronDown"}
              fallback="ChevronRight"
              aria-hidden
              className="size-3"
            />
            {childCount}
          </button>
        ) : null}
        {shortcut ? (
          <kbd
            className={cx(
              "pointer-events-none shrink-0 rounded border border-sidebar-border px-1 text-muted-foreground",
              KEYCAP_TEXT,
            )}
          >
            {shortcut.label}
          </kbd>
        ) : (
          <Age activityAt={activityAt} />
        )}
        <ThreadActionsMenu
          thread={target}
          align="start"
          trigger={(props) => (
            <button
              type="button"
              aria-label={`Actions for ${thread.displayTitle}`}
              {...props}
              className={cx(
                "relative flex h-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                REVEAL_ON_INTENT.row,
                FOCUS_RING,
              )}
            >
              <Icon name="MoreHorizontal" fallback="Ellipsis" aria-hidden className="size-3.5" />
            </button>
          )}
        />
      </div>
    </ThreadActionsContextMenu>
  );
});

/**
 * Relative age of the row's last activity. Only this label reads the shared
 * clock, so a tick re-renders text, not whole rows and their menus.
 */
function Age({ activityAt }: { activityAt: number }) {
  const now = useNow();
  return (
    <time
      dateTime={new Date(activityAt).toISOString()}
      title={new Date(activityAt).toLocaleString()}
      className={cx(
        "pointer-events-none shrink-0 text-muted-foreground tabular-nums group-focus-within/row:hidden group-hover/row:hidden",
        META_TEXT,
      )}
    >
      {formatAge(activityAt, now)}
    </time>
  );
}
