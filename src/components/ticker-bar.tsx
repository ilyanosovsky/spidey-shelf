/**
 * The scrolling LCD strip along the bottom of the screen.
 *
 * Pure CSS: the track holds the same line three times and slides exactly one third of its
 * own width, so the next copy is always already in place when the previous one leaves and
 * the loop has no seam. Three copies rather than two because on a wide desktop two copies of
 * a short line are narrower than the strip, which would open a visible gap mid-scroll.
 * No JavaScript, so this stays a server component and never blocks hydration.
 *
 * The duplicates are `aria-hidden` — a screen reader reads the sighting once. Under
 * `prefers-reduced-motion` the track stops dead and reads as a static line (globals.css);
 * a marquee that cannot be stopped is exactly the animation that rule exists for.
 */
const COPY_CLASS =
  "font-pixel shrink-0 px-4 text-[10px] leading-relaxed tracking-wider text-lcd-glow";

export function TickerBar({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded border-2 border-ink-px bg-lcd-bg py-2 ${className}`}>
      <div className="ticker-track flex w-max">
        <span className={COPY_CLASS}>{text}</span>
        <span aria-hidden="true" className={COPY_CLASS}>
          {text}
        </span>
        <span aria-hidden="true" className={COPY_CLASS}>
          {text}
        </span>
      </div>
    </div>
  );
}
