import { type ReactNode } from "react";

/**
 * The gadget panel: a bordered box with a hard pixel shadow. Everything on the public
 * screens sits inside one of these, the way every part of the reference tracker is bolted
 * into a plastic case.
 *
 * `weight` is the mobile-first knob from the design brief: the frame around the whole screen
 * is chunky (`md`), the frames around cards are thin (`sm`) so the decoration never eats the
 * content on a phone.
 */
export interface PixelFrameProps {
  children: ReactNode;
  /** Border colour — a CSS colour or `var(--color-…)`. Defaults to the gadget-body blue. */
  accent?: string;
  weight?: "sm" | "md";
  /** Rendered element. `article`/`section` where the panel is a real landmark. */
  as?: "div" | "article" | "section" | "header" | "footer";
  className?: string;
}

const WEIGHTS = {
  sm: "rounded border-2 shadow-[3px_3px_0_var(--color-ink-px)]",
  md: "rounded-lg border-4 shadow-[6px_6px_0_var(--color-ink-px)]",
} as const;

export function PixelFrame({
  children,
  accent,
  weight = "md",
  as: Tag = "div",
  className = "",
}: PixelFrameProps) {
  return (
    <Tag
      className={`border-blue-frame bg-navy-deep ${WEIGHTS[weight]} ${className}`}
      style={accent ? { borderColor: accent } : undefined}
    >
      {children}
    </Tag>
  );
}
