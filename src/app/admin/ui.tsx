import Link from "next/link";
import type { ReactNode } from "react";

import { FOCUS_RING, PIXEL_BUTTON_VARIANTS } from "@/components/pixel-button";
import { figureCategoryLabel } from "@/lib/categories";

/**
 * The handful of admin-only pixel pieces (fields, chips, the admin panel).
 *
 * The buttons moved to `src/components/pixel-button.tsx` in Phase 4 and are re-exported
 * here so the admin keeps its import path while the whole device shares one button.
 * `Panel` / `LcdStat` stay admin-shaped on purpose: the public `PixelFrame` and
 * `LCDCounter` carry showcase-sized padding and a hero counter the admin does not want.
 */

/** Amber CTA / green secondary / coral danger — pressed states shift 2px down-right. */
export const pixelButton = PIXEL_BUTTON_VARIANTS;

/**
 * The LCD text field. 16px (`text-base`) so iOS Safari does not zoom the page on focus.
 *
 * `outline-none` used to leave a focused field marked only by a border colour change from
 * ink to blue — two dark colours, on a dark field, at 2px. The amber ring from the buttons
 * goes on top of it, so "which field am I in" is answerable without staring.
 */
export const fieldClass = `w-full rounded border-2 border-ink-px bg-lcd-bg px-3 py-3 text-base text-lcd-glow caret-lcd-glow focus-visible:border-blue-frame ${FOCUS_RING}`;

export const labelClass = "font-pixel text-[10px] tracking-wider text-amber";

/** The gadget body: a bordered navy panel with a hard pixel shadow. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`w-full rounded-lg border-4 border-blue-frame bg-navy-deep p-5 shadow-[6px_6px_0_var(--color-ink-px)] ${className}`}
    >
      {children}
    </div>
  );
}

/** A green-on-dark readout. `value` is the digits, `label` the caption under them. */
export function LcdStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded border-2 border-ink-px bg-lcd-bg px-3 py-3 text-center">
      <p className="font-pixel text-sm tracking-widest text-lcd-glow tabular-nums">{value}</p>
      <p className="font-pixel mt-2 text-[10px] leading-relaxed text-lcd-glow/70">{label}</p>
    </div>
  );
}

export function StatusChip({ status }: { status: string | null }) {
  const isMine = status === "mine";
  const tone = isMine
    ? "border-pop-green text-pop-green"
    : status === "not_mine_anymore"
      ? "border-coral text-coral"
      : "border-cream/40 text-cream/60";

  return (
    <span
      className={`font-pixel inline-block rounded border-2 px-2 py-1 text-[10px] tracking-wider ${tone}`}
    >
      {isMine ? "MINE" : status === "not_mine_anymore" ? "GONE" : "UNKNOWN"}
    </span>
  );
}

export function CategoryChip({ category }: { category: string | null }) {
  return (
    <span className="font-pixel inline-block rounded border-2 border-blue-frame px-2 py-1 text-[10px] tracking-wider text-cream/80">
      {figureCategoryLabel(category)}
    </span>
  );
}

/** A pixel-button-shaped link, for navigation that is not a form submit. */
export function PixelLink({
  href,
  children,
  variant = "quiet",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof pixelButton;
}) {
  return (
    <Link href={href} className={pixelButton[variant]}>
      {children}
    </Link>
  );
}
