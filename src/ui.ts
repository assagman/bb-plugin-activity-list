// Small styling helpers shared by the list's components.

/** Joins class names, skipping falsy parts; the host's cn is not exported to plugins. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Size of secondary row text (ages, counts), one step under bb's text-xs. */
export const META_TEXT = "text-[11px]";

/** Focus ring every interactive control in the list shares, as bb's sidebar draws it. */
export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
