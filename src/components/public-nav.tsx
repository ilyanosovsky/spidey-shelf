import Link from "next/link";

import { activeNavHref, PUBLIC_NAV } from "@/lib/nav";

/**
 * The gadget's four buttons: SHELF · SEARCH · WISHLIST · STATS.
 *
 * A 4-column grid rather than a flex row, so the labels cannot wrap onto a second line on a
 * 375px phone: each cell is ~85px, which fits `WISHLIST` at 10px in the pixel font with a
 * little air. Every target is `min-h-11` (44px), the touch floor from the design brief.
 *
 * `pathname` is a prop because these are server components — there is no `usePathname()` to
 * call, and passing the page's own path keeps the nav a pure function of it. The active
 * item is filled green with ink text (the same pairing as the secondary button), which
 * clears AA comfortably; the rest are outlined cream on navy.
 */
export function PublicNav({ pathname, className = "" }: { pathname: string; className?: string }) {
  const active = activeNavHref(pathname);

  return (
    <nav aria-label="Sections" className={className}>
      <ul className="grid grid-cols-4 gap-1">
        {PUBLIC_NAV.map((item) => {
          const current = item.href === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`font-pixel flex min-h-11 items-center justify-center rounded border-2 px-1 text-center text-[10px] leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${
                  current
                    ? "border-ink-px bg-pop-green text-ink-px shadow-[3px_3px_0_var(--color-ink-px)]"
                    : "border-blue-frame text-cream"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
