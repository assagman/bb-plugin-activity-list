// Colored status glyph drawn before each thread title and in group roll-ups.
// bb's own glyph is mostly monochrome; the user asked for states they can tell
// apart at a glance, so each class gets its own color and shape. Shape differs
// too, so the states still read without color (WCAG 1.4.1).
//
// The working state is the exception: the user likes bb's own running glyph,
// so that state renders bb's glyph unchanged.
//
// Every color is a bb theme token, never a fixed hue, so the glyphs follow
// whatever palette the user runs (a fixed green clashed with violet themes).
// Low-urgency states share the muted token and differ by shape alone.
import {
  type PluginSidebarThreadIndicator,
  type PluginSidebarThreadRowStatus,
  experimental_ThreadStatusGlyph as ThreadStatusGlyph,
} from "@get-bb/plugin-sdk/app";
import type { StatusKind } from "./model.ts";
import { STATUS_LABEL } from "./model.ts";

/** Pixel box of every glyph, matching bb's 14 px compact row glyph. */
const GLYPH_SIZE = 14;

/** Theme-token text color per class; the SVG paints with currentColor. */
export const STATUS_TONE: Readonly<Record<StatusKind, string>> = {
  "needs-input": "text-attention",
  error: "text-destructive",
  // warning-text is the theme's soft warning ink: the creamy yellow the user
  // asked for on running counts, and distinct from attention in bb's palettes.
  working: "text-warning-text",
  queued: "text-muted-foreground",
  background: "text-muted-foreground",
  // primary is the theme's own accent, as bb's unread dot uses it.
  unread: "text-primary",
  draft: "text-muted-foreground",
  idle: "text-muted-foreground/40",
};

/** One full turn of the slow background ring, slower than bb's running spin. */
const BACKGROUND_SPIN = "motion-safe:animate-[spin_3s_linear_infinite]";

interface StatusGlyphProps {
  kind: StatusKind;
  /** bb's resolved indicator for a row; drawn by bb when bb's glyph applies. */
  indicator?: PluginSidebarThreadIndicator;
  /** A status another plugin set on the row; bb's glyph draws it. */
  rowStatus?: PluginSidebarThreadRowStatus | null;
  /**
   * Set inside a thread row: the row's link already names the status, and the
   * glyph must let clicks through to the link under it.
   */
  decorative?: boolean;
  className?: string;
}

export function StatusGlyph({
  kind,
  indicator,
  rowStatus,
  decorative = false,
  className: extraClassName = "",
}: StatusGlyphProps) {
  const className = decorative ? `pointer-events-none ${extraClassName}` : extraClassName;
  // bb's glyph for two cases: a running thread, whose bb glyph the user wants
  // kept as is, and a status another plugin set on the row, which must not
  // vanish when this list replaces bb's.
  if (kind === "working" || rowStatus) {
    return (
      <span
        aria-hidden={decorative || undefined}
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        title={rowStatus?.label ?? STATUS_LABEL[kind]}
      >
        <ThreadStatusGlyph
          indicator={indicator ?? "runtime"}
          rowStatus={rowStatus ?? null}
          size="compact"
        />
      </span>
    );
  }
  // A standalone glyph (legend, chips) is an image with a name; inside a row
  // it is hidden, since the row's link already names the status.
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": STATUS_LABEL[kind] } as const);
  return (
    <span
      {...a11y}
      title={STATUS_LABEL[kind]}
      className={`relative inline-flex shrink-0 items-center justify-center ${STATUS_TONE[kind]} ${className}`}
      style={{ width: GLYPH_SIZE, height: GLYPH_SIZE }}
    >
      {kind === "needs-input" ? (
        // A pulsing halo: the one state that blocks the agent should pull the
        // eye even in a long list. motion-safe respects reduced motion.
        <span className="absolute inset-0 rounded-full bg-current opacity-30 motion-safe:animate-ping" />
      ) : null}
      <svg
        viewBox="0 0 16 16"
        width={GLYPH_SIZE}
        height={GLYPH_SIZE}
        aria-hidden="true"
        className={glyphMotion(kind)}
      >
        {glyphShape(kind)}
      </svg>
    </span>
  );
}

function glyphMotion(kind: StatusKind): string {
  if (kind === "background") return BACKGROUND_SPIN;
  return "";
}

function glyphShape(kind: StatusKind) {
  switch (kind) {
    case "needs-input":
      // Filled disc with a question bar: "the agent asks you something".
      return (
        <>
          <circle cx="8" cy="8" r="6.5" fill="currentColor" />
          <path
            d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.75c-.5.2-.8.6-.8 1.1v.35"
            fill="none"
            stroke="var(--attention-foreground)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="11.6" r=".9" fill="var(--attention-foreground)" />
        </>
      );
    case "error":
      // Filled disc with a cross: a failed turn or a failed queued send.
      return (
        <>
          <circle cx="8" cy="8" r="6.5" fill="currentColor" />
          <path
            d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"
            stroke="var(--destructive-foreground)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    case "background":
      // Dotted ring that turns slowly: work runs, but not the main turn.
      return (
        <circle
          cx="8"
          cy="8"
          r="5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 3.3"
        />
      );
    case "queued":
      // Clock face: a message waits behind the running turn.
      return (
        <>
          <circle cx="8" cy="8" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 5v3.2l2 1.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      );
    case "unread":
      // Solid dot in the theme's primary color, as bb's unread dot.
      return <circle cx="8" cy="8" r="4" fill="currentColor" />;
    case "draft":
      // Pencil: the composer holds an unsent message.
      return (
        <path
          d="M10.8 3.2l2 2-6.9 6.9-2.6.6.6-2.6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      );
    default:
      // Small hollow dot keeps titles aligned without adding noise.
      return <circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />;
  }
}
