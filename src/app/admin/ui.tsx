import Link from "next/link";
import type { ReactNode } from "react";

import { figureCategoryLabel } from "@/lib/categories";

/**
 * The handful of pixel-gadget pieces the admin screens share.
 *
 * Deliberately not the component library — that lands in Phase 4 with the public showcase
 * (FigureCard, LCDCounter, PixelButton…). These are the minimum needed to keep the admin
 * looking like the same device, in one file, so Phase 4 can replace them wholesale.
 */

/** Amber CTA / green secondary / coral danger — pressed states shift 2px down-right. */
export const pixelButton = {
  primary:
    "font-pixel inline-flex items-center justify-center rounded border-2 border-ink-px bg-amber px-4 py-3 text-[10px] tracking-wider text-ink-px shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)] disabled:opacity-60",
  secondary:
    "font-pixel inline-flex items-center justify-center rounded border-2 border-ink-px bg-pop-green px-4 py-3 text-[10px] tracking-wider text-ink-px shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)] disabled:opacity-60",
  danger:
    "font-pixel inline-flex items-center justify-center rounded border-2 border-ink-px bg-coral px-4 py-3 text-[10px] tracking-wider text-cream shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)] disabled:opacity-60",
  quiet:
    "font-pixel inline-flex items-center justify-center rounded border-2 border-blue-frame px-4 py-3 text-[10px] tracking-wider text-cream active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-60",
} as const;

export const fieldClass =
  "w-full rounded border-2 border-ink-px bg-lcd-bg px-3 py-3 text-base text-lcd-glow caret-lcd-glow outline-none focus-visible:border-blue-frame";

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
      <p className="font-pixel mt-2 text-[8px] leading-relaxed text-lcd-glow/70">{label}</p>
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
      className={`font-pixel inline-block rounded border-2 px-2 py-1 text-[8px] tracking-wider ${tone}`}
    >
      {isMine ? "MINE" : status === "not_mine_anymore" ? "GONE" : "UNKNOWN"}
    </span>
  );
}

export function CategoryChip({ category }: { category: string | null }) {
  return (
    <span className="font-pixel inline-block rounded border-2 border-blue-frame px-2 py-1 text-[8px] tracking-wider text-blue-frame">
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
