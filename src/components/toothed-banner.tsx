import { type ReactNode } from "react";

/**
 * The coral plaque with a toothed bottom edge — section headers and alerts, straight from
 * the reference tracker's "SIGHTING IN YOUR DIRECT VICINITY" banner.
 *
 * The teeth are a repeating linear gradient (`.pixel-teeth` in globals.css), so they are
 * square-cut like everything else in this world and cost nothing: no image, no clip-path
 * per breakpoint. Text is `--ink-px` on coral, not cream: dark on coral clears AA
 * comfortably, cream on coral only barely clears it at large sizes.
 */
export function ToothedBanner({
  children,
  as: Tag = "h2",
  className = "",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3" | "p" | "div";
  className?: string;
}) {
  return (
    <div className={`w-full ${className}`}>
      <Tag className="font-pixel rounded-t border-2 border-b-0 border-ink-px bg-coral px-3 py-2 text-[10px] leading-relaxed tracking-wider text-ink-px">
        {children}
      </Tag>
      <span aria-hidden="true" className="pixel-teeth" />
    </div>
  );
}
