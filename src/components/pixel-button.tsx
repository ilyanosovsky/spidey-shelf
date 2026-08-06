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
 * so the whole device has one button, not two that drift apart.
 */
export const PIXEL_BUTTON_VARIANTS = {
  primary:
    "font-pixel inline-flex min-h-11 items-center justify-center rounded border-2 border-ink-px bg-amber px-4 py-3 text-[10px] tracking-wider text-ink-px shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)] disabled:opacity-60",
  secondary:
    "font-pixel inline-flex min-h-11 items-center justify-center rounded border-2 border-ink-px bg-pop-green px-4 py-3 text-[10px] tracking-wider text-ink-px shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)] disabled:opacity-60",
  danger:
    "font-pixel inline-flex min-h-11 items-center justify-center rounded border-2 border-ink-px bg-coral px-4 py-3 text-[10px] tracking-wider text-cream shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)] disabled:opacity-60",
  quiet:
    "font-pixel inline-flex min-h-11 items-center justify-center rounded border-2 border-blue-frame px-4 py-3 text-[10px] tracking-wider text-cream active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-60",
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
