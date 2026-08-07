import Link from "next/link";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * The gadget's rubber buttons: amber CTA, green secondary, coral danger, plus a quiet
 * outline for navigation that is not an action.
 *
 * Pressing shifts the button 2px down-right and shrinks its shadow, so it looks physically
 * pushed into the case. `min-h-11` is 44px — the touch-target floor from the design brief;
 * the pixel font is 10px, which is the smallest size it stays legible at.
 *
 * These classes started life in `src/app/admin/ui.tsx`; the admin re-exports them from here
 * so the whole device has one button, not two that drift apart. They are also what the tab
 * rows on `/` and `/wishlist` are made of, which is why the focus ring lives here: fixing it
 * in one string fixes every interactive pixel element on the site at once.
 *
 * Two Phase 8 corrections, both real failures rather than tidying:
 *   · **A visible focus ring.** The pressed state is `:active` only, so a keyboard user got
 *     the browser's default outline — which on a 2px-bordered dark button is close to
 *     invisible. `FOCUS_RING` is an amber outline with an offset, and amber is the one hue on
 *     this palette that is legible against every background the site has.
 *   · **`danger` was cream on coral: 3.00∶1.** That is below AA for anything under 24px, and
 *     these labels are 10px. Coral now carries ink text (5.75∶1), the same pairing
 *     `ToothedBanner` and `VerdictStamp` already use — cream-on-coral survives only where the
 *     design brief allows it, at large sizes.
 */

/** The one focus treatment, shared so it cannot drift between variants. */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber";

const BUTTON_BASE = `font-pixel inline-flex min-h-11 items-center justify-center rounded border-2 px-4 py-3 text-[10px] tracking-wider disabled:opacity-60 ${FOCUS_RING}`;
const RAISED =
  "shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)]";

export const PIXEL_BUTTON_VARIANTS = {
  primary: `${BUTTON_BASE} border-ink-px bg-amber text-ink-px ${RAISED}`,
  secondary: `${BUTTON_BASE} border-ink-px bg-pop-green text-ink-px ${RAISED}`,
  danger: `${BUTTON_BASE} border-ink-px bg-coral text-ink-px ${RAISED}`,
  quiet: `${BUTTON_BASE} border-blue-frame text-cream active:translate-x-[2px] active:translate-y-[2px]`,
} as const;

export type PixelButtonVariant = keyof typeof PIXEL_BUTTON_VARIANTS;

export function pixelButtonClass(variant: PixelButtonVariant = "primary", className = ""): string {
  return `${PIXEL_BUTTON_VARIANTS[variant]} ${className}`.trim();
}

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PixelButtonVariant;
  children: ReactNode;
}

export function PixelButton({
  variant = "primary",
  className = "",
  type = "button",
  children,
  ...props
}: PixelButtonProps) {
  return (
    <button type={type} className={pixelButtonClass(variant, className)} {...props}>
      {children}
    </button>
  );
}

/** The same button as a link — navigation is not a form submit, but it looks identical. */
export function PixelButtonLink({
  href,
  variant = "quiet",
  className = "",
  children,
}: {
  href: string;
  variant?: PixelButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={pixelButtonClass(variant, className)}>
      {children}
    </Link>
  );
}
