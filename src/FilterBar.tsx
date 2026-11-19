// Status chips above the list and the glyph legend behind its "?" chip.
// The chips let the user jump to every thread in one state without scanning
// the whole list; the legend teaches the new colors in place.
import { type ReactNode, useState } from "react";
import { ROLLUP_KINDS, STATUS_LABEL, STATUS_PRIORITY, type StatusKind } from "./model.ts";
import type { StatusFilter } from "./prefs-parse.ts";
import { StatusGlyph } from "./StatusGlyph.tsx";
import { cx, FOCUS_RING } from "./ui.ts";

export function FilterBar({
  counts,
  filter,
  onChange,
}: {
  counts: ReadonlyMap<StatusKind, number>;
  filter: StatusFilter;
  onChange: (filter: StatusFilter) => void;
}) {
  // The selected chip stays even at zero, so the user can see and clear it.
  const present = ROLLUP_KINDS.filter((kind) => (counts.get(kind) ?? 0) > 0 || kind === filter);
  const [showLegend, setShowLegend] = useState(false);
  return (
    <>
      <div
        role="toolbar"
        aria-label="Filter threads by status"
        className="flex flex-wrap items-center gap-1 px-1 pt-1 pb-1"
      >
        <FilterChip active={filter === "all"} onClick={() => onChange("all")} label="All threads">
          All
        </FilterChip>
        {present.map((kind) => (
          <FilterChip
            key={kind}
            active={filter === kind}
            onClick={() => onChange(filter === kind ? "all" : kind)}
            label={`${STATUS_LABEL[kind]}: ${counts.get(kind) ?? 0}`}
          >
            <StatusGlyph kind={kind} className="scale-90" />
            <span className="tabular-nums">{counts.get(kind) ?? 0}</span>
          </FilterChip>
        ))}
        <button
          type="button"
          aria-expanded={showLegend}
          aria-label="What the status colors mean"
          title="What the status colors mean"
          onClick={() => setShowLegend((open) => !open)}
          className={cx(
            "ml-auto inline-flex size-6 items-center justify-center rounded-full text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground aria-expanded:bg-sidebar-accent",
            FOCUS_RING,
          )}
        >
          ?
        </button>
      </div>
      {showLegend ? <StatusLegend /> : null}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs",
        FOCUS_RING,
        active
          ? "border-sidebar-foreground/30 bg-sidebar-accent text-sidebar-accent-foreground"
          : "border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Key to every glyph, in attention order. */
function StatusLegend() {
  return (
    <ul
      aria-label="Status colors"
      className="mx-1 mb-1 grid grid-cols-2 gap-x-2 gap-y-1 rounded-md border border-sidebar-border px-2 py-1.5 text-xs text-muted-foreground"
    >
      {STATUS_PRIORITY.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <StatusGlyph kind={kind} />
          <span className="truncate">{STATUS_LABEL[kind]}</span>
        </li>
      ))}
    </ul>
  );
}
