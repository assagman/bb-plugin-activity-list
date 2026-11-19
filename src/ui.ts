// Small styling helpers shared by the list's components.

/** Joins class names, skipping falsy parts; the host's cn is not exported to plugins. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Size of secondary row text (ages, counts), one step under bb's text-xs. */
export const META_TEXT = "text-[11px]";

/** Size of the shortcut key cap, one step under META_TEXT so the cap fits a 28 px row. */
export const KEYCAP_TEXT = "text-[10px]";

/** Gaps of the header and row flex lines; REVEAL_ON_INTENT's rest margins cancel them. */
export const HEADER_GAP = "gap-1";
export const ROW_GAP = "gap-1.5";

/**
 * Reveals a hover control ("+" on a group, "…" on a row) on hover or when focus
 * is inside its group, and always where a coarse pointer exists (phones, touch
 * laptops), since a tap cannot hover. It collapses to zero width instead of
 * display:none, so it stays in the tab order and Shift+Tab reaches it as Tab
 * does; a negative margin at rest cancels the parent's gap, so the hidden
 * control costs no title width. Literal strings per group name, so the class
 * scanner sees every class. Keep -ml-1 and -ml-1.5 equal to HEADER_GAP and ROW_GAP.
 */
export const REVEAL_ON_INTENT = {
  header:
    "-ml-1 w-0 overflow-hidden opacity-0 group-hover/header:ml-0 group-hover/header:w-5 group-hover/header:opacity-100 group-focus-within/header:ml-0 group-focus-within/header:w-5 group-focus-within/header:opacity-100 [@media(any-pointer:coarse)]:ml-0 [@media(any-pointer:coarse)]:w-5 [@media(any-pointer:coarse)]:opacity-100",
  row: "-ml-1.5 w-0 overflow-hidden opacity-0 group-hover/row:ml-0 group-hover/row:w-5 group-hover/row:opacity-100 group-focus-within/row:ml-0 group-focus-within/row:w-5 group-focus-within/row:opacity-100 aria-expanded:ml-0 aria-expanded:w-5 aria-expanded:opacity-100 [@media(any-pointer:coarse)]:ml-0 [@media(any-pointer:coarse)]:w-5 [@media(any-pointer:coarse)]:opacity-100",
} as const;

/** Focus ring every interactive control in the list shares, as bb's sidebar draws it. */
export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
