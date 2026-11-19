// One shared wall clock for every age label. Only the labels subscribe, so the
// 30 s tick re-renders a few text nodes instead of every row and its menus.
import { useSyncExternalStore } from "react";

/** Ages show minute precision; a slower tick saves renders. */
const TICK_MS = 30_000;

const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    // The last label unmounted (list switched away or plugin unloaded): stop
    // the timer so nothing keeps running in the page.
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
