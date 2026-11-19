// Stored-prefs schema and parser. Kept apart from the React store in prefs.ts
// so scripts/smoke.ts can test it under plain Node. Stored values are
// untrusted (another version, a manual edit), so every field is validated and
// falls back to its default.
import { ROLLUP_KINDS, type StatusFilter, type StatusKind } from "./model.ts";

/** Bounds stored id lists so a corrupt or hostile value cannot grow without limit. */
export const MAX_IDS = 5_000;
const MAX_ID_LENGTH = 256;

/** Re-exported for prefs.ts, which reads every prefs type from here; it lives with groupView. */
export type { StatusFilter } from "./model.ts";

/** What the list keeps per client: collapsed group keys and row ids, and the filter. */
export interface ListPrefs {
  collapsedGroups: readonly string[];
  collapsedThreads: readonly string[];
  filter: StatusFilter;
}

/** Fresh-client state, and the fallback for missing or invalid stored prefs. */
export const DEFAULT_PREFS: ListPrefs = {
  collapsedGroups: [],
  collapsedThreads: [],
  filter: "all",
};

/** Keeps only short string ids, capped in count, so bad storage cannot bloat the list. */
function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (id): id is string => typeof id === "string" && id.length > 0 && id.length <= MAX_ID_LENGTH,
    )
    .slice(0, MAX_IDS);
}

/**
 * Only states with a chip are valid filters: a stored "idle" would hide most
 * threads with no pressed chip to explain it.
 */
function readFilter(value: unknown): StatusFilter {
  return value === "all" || ROLLUP_KINDS.includes(value as StatusKind)
    ? (value as StatusFilter)
    : "all";
}

/** Parses stored JSON; any malformed part falls back to its default. */
export function parsePrefs(raw: string | null): ListPrefs {
  if (raw === null) return DEFAULT_PREFS;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return DEFAULT_PREFS;
    const record = value as Record<string, unknown>;
    return {
      collapsedGroups: readIds(record["collapsedGroups"]),
      collapsedThreads: readIds(record["collapsedThreads"]),
      filter: readFilter(record["filter"]),
    };
  } catch {
    // Corrupt JSON is a recoverable state: the user only loses collapse
    // choices, and the next write replaces the bad value.
    return DEFAULT_PREFS;
  }
}
