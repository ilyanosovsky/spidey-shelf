/**
 * The green readout of the gadget: `11 / 120` over a caption.
 *
 * Digits are tabular so the number does not jitter when it ticks over, letter-spacing is
 * wide because that is what an LCD looks like, and the optional scanline overlay is a
 * 2px repeating gradient — no image, no canvas, and it disappears behind `prefers-reduced-
 * motion` users' eyes just fine because nothing here moves.
 */
export interface LCDCounterProps {
  /** The digits, already formatted: `11 / 120`. */
  value: string;
  /** Short caption under the digits, pixel font, uppercase. */
  label: string;
  /** Sizes the digits. `lg` is the hero counter on the home screen. */
  size?: "sm" | "lg";
  scanlines?: boolean;
  className?: string;
}

const SIZES = {
  sm: "text-sm",
  lg: "text-xl sm:text-2xl",
} as const;

export function LCDCounter({
  value,
  label,
  size = "lg",
  scanlines = true,
  className = "",
}: LCDCounterProps) {
  return (
    <div
      className={`relative overflow-hidden rounded border-2 border-ink-px bg-lcd-bg px-4 py-4 text-center ${className}`}
    >
      <p
        className={`font-pixel leading-relaxed tracking-widest text-lcd-glow tabular-nums ${SIZES[size]}`}
        style={{ textShadow: "0 0 8px color-mix(in srgb, var(--color-lcd-glow) 55%, transparent)" }}
      >
        {value}
      </p>
      <p className="font-pixel mt-3 text-[10px] leading-relaxed tracking-wider text-lcd-glow">
        {label}
      </p>
      {scanlines ? <span aria-hidden="true" className="lcd-scanlines" /> : null}
    </div>
  );
}
