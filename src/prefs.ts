// Per-client list choices: collapsed groups and rows, and the status filter.
// bb's own list keeps these per window too, so localStorage matches its model
// and needs no backend. Reads go through parsePrefs, which validates them.
import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_PREFS,
  type ListPrefs,
  MAX_IDS,
  parsePrefs,
  type StatusFilter,
} from "./prefs-parse.ts";

/** Versioned so a future shape change can ignore old data instead of misreading it. */
const STORAGE_KEY = "bb-plugin-activity-list:prefs:v1";

const listeners = new Set<() => void>();
let cached: ListPrefs | null = null;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Some embedded views deny storage access; the list still works, unsaved.
    return null;
  }
}

function snapshot(): ListPrefs {
  if (cached === null) cached = parsePrefs(storage()?.getItem(STORAGE_KEY) ?? null);
  return cached;
}

function write(next: ListPrefs): void {
  cached = next;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or blocked storage keeps the choice for this session only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another window of the same client changed the prefs: re-read them.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = null;
    listener();
  };
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id].slice(-MAX_IDS);
}

/** The prefs plus stable setters; every mounted list re-renders on change. */
export function useListPrefs() {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PREFS);
  const toggleGroup = useCallback((key: string) => {
    const current = snapshot();
    write({ ...current, collapsedGroups: toggleId(current.collapsedGroups, key) });
  }, []);
  const toggleThread = useCallback((id: string) => {
    const current = snapshot();
    write({ ...current, collapsedThreads: toggleId(current.collapsedThreads, id) });
  }, []);
  const setFilter = useCallback((filter: StatusFilter) => {
    write({ ...snapshot(), filter });
  }, []);
  return { prefs, toggleGroup, toggleThread, setFilter };
}
