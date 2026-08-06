import { HAD_ONCE_NOTE, VERDICT_LABELS, type SearchVerdict } from "@/lib/search";

/**
 * The answer, stamped.
 *
 * This is the one thing a friend standing in a shop actually needs, so it is the biggest
 * thing on the card and sits at the top of it — the whole point is that the verdict is
 * readable without scrolling on a phone. Rotated two degrees like a rubber stamp; that is a
 * static transform, not an animation, so `prefers-reduced-motion` has nothing to turn off.
 *
 * Colours are the design brief's: green OWNED, coral NOT OWNED. Text is `--ink-px` on both
 * fills — dark on coral clears AA comfortably where cream on coral only barely does
 * (Design-System.md). The amber GIFT IDEA chip rides along with `never`, which is the
 * hottest moment on the site: nobody owns this one yet.
 */
const VERDICT_STYLES: Record<SearchVerdict, string> = {
  owned: "bg-pop-green text-ink-px",
  had_once: "bg-coral text-ink-px",
  never: "bg-coral text-ink-px",
};

export function VerdictStamp({
  verdict,
  className = "",
}: {
  verdict: SearchVerdict;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <p
        className={`font-pixel inline-block rounded border-4 border-ink-px px-4 py-3 text-sm leading-relaxed tracking-wider shadow-[4px_4px_0_var(--color-ink-px)] sm:text-base ${VERDICT_STYLES[verdict]}`}
        style={{ transform: "rotate(-2deg)" }}
      >
        {VERDICT_LABELS[verdict]}
      </p>

      {verdict === "never" ? (
        <p className="font-pixel rounded border-2 border-amber px-2 py-1 text-[10px] leading-relaxed tracking-wider text-amber">
          GIFT IDEA
        </p>
      ) : null}

      {verdict === "had_once" ? (
        // Body font, lower case: a footnote about the past, not part of the verdict.
        <p className="text-sm text-cream/60">{HAD_ONCE_NOTE}</p>
      ) : null}
    </div>
  );
}
