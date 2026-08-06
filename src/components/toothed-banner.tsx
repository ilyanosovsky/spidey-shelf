import { type ReactNode } from "react";

/**
 * The coral plaque with a toothed bottom edge — section headers and alerts, straight from
 * the reference tracker's "SIGHTING IN YOUR DIRECT VICINITY" banner.
 *
 * The teeth are a repeating linear gradient (`.pixel-teeth` in globals.css), so they are
 * square-cut like everything else in this world and cost nothing: no image, no clip-path
 * per breakpoint. Text is `--ink-px` on coral, not cream: dark on coral clears AA
 * comfortably, cream on coral only barely clears it at large sizes.
 *
 * `tone="green"` is the success plaque added in Phase 6 (`SIGHTING CONFIRMED!`). Both tones
 * put ink on a saturated fill for the same contrast reason, and each carries its own teeth
 * class because the gradient's colour cannot be a Tailwind utility.
 */
const TONES = {
  coral: { plaque: "bg-coral", teeth: "pixel-teeth" },
  green: { plaque: "bg-pop-green", teeth: "pixel-teeth pixel-teeth-green" },
} as const;

export type ToothedBannerTone = keyof typeof TONES;

export function ToothedBanner({
  children,
  as: Tag = "h2",
  tone = "coral",
  className = "",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3" | "p" | "div";
  tone?: ToothedBannerTone;
  className?: string;
}) {
  return (
    <div className={`w-full ${className}`}>
      <Tag
        className={`font-pixel rounded-t border-2 border-b-0 border-ink-px px-3 py-2 text-[10px] leading-relaxed tracking-wider text-ink-px ${TONES[tone].plaque}`}
      >
        {children}
      </Tag>
      <span aria-hidden="true" className={TONES[tone].teeth} />
    </div>
  );
}
