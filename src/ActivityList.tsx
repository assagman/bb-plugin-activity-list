// The replacement sidebar list. It keeps bb's row anatomy and host behavior by
// rendering bb's own components where the SDK offers them. What changes:
// groups and rows sort by activity, statuses get theme-token colors, group
// headers roll up the states inside them, and chips filter by state.
import {
  type PluginThreadListProps,
  experimental_useSidebarThreads as useSidebarThreads,
} from "@get-bb/plugin-sdk/app";
import { useMemo } from "react";
import { FilterBar } from "./FilterBar.tsx";
import { GroupSection, useRowContext } from "./GroupSection.tsx";
import { buildGroups, STATUS_LABEL } from "./model.ts";
import { useListPrefs } from "./prefs.ts";

export function ActivityList({ activeThreadId, onNavigate }: PluginThreadListProps) {
  const { status, threads, projects } = useSidebarThreads();
  const { prefs, toggleGroup, toggleThread, setFilter } = useListPrefs();
  const groups = useMemo(() => buildGroups(threads, projects), [threads, projects]);
  const rows = useRowContext(activeThreadId, prefs.collapsedThreads, toggleThread, onNavigate);

  if (status === "loading" && threads.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Loading threads…</p>;
  }
  if (status === "error" && threads.length === 0) {
    return (
      <p role="alert" className="px-3 py-2 text-xs text-destructive">
        Could not load threads. bb retries on its own; reload the window if this stays.
      </p>
    );
  }

  const { filter } = prefs;
  const collapsedGroups = new Set(prefs.collapsedGroups);
  return (
    <div className="flex min-h-full flex-col gap-1 px-2 pb-3 text-sm">
      <FilterBar counts={groups.counts} filter={filter} onChange={setFilter} />
      {filter !== "all" && (groups.counts.get(filter) ?? 0) === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          No thread is {STATUS_LABEL[filter].toLowerCase()} now.{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => setFilter("all")}
          >
            Show all
          </button>
        </p>
      ) : null}
      {[groups.pinned, ...groups.projects].map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          filter={filter}
          collapsed={collapsedGroups.has(group.key)}
          rows={rows}
          onToggleGroup={toggleGroup}
        />
      ))}
    </div>
  );
}
