import Link from "next/link";

import { activeNavHref, CONSOLE_NAV_ITEM, navItemsFor } from "@/lib/nav";

/**
 * The gadget's buttons: SHELF · SEARCH · WISHLIST · STATS — and CONSOLE for the owner.
 *
 * A 4-column grid rather than a flex row, so the labels cannot wrap onto a second line on a
 * 375px phone: each cell is ~85px, which fits `WISHLIST` at 10px in the pixel font with a
 * little air. Every target is `min-h-11` (44px), the touch floor from the design brief.
 *
 * `pathname` is a prop because these are server components — there is no `usePathname()` to
 * call, and passing the page's own path keeps the nav a pure function of it. `isAdmin` is a
 * prop for the same reason and one more: the pages are where the session is verified, so
 * this component stays pure, renderable in a test, and free of `next/headers`.
 *
 * The active item is filled green with ink text (the same pairing as the secondary button),
 * which clears AA comfortably; the rest are outlined cream on navy.
 *
 * **CONSOLE never joins that row.** Five 10px pixel labels do not fit 375px — `WISHLIST`
 * alone is ~80px and a fifth column leaves ~65px — so on a phone the console is a full-width
 * amber bar under the four tabs (`col-span-4`), which is also the easiest thing on the screen
 * to hit with a thumb; from `sm` up the grid becomes five columns and it takes its place in
 * the row. Amber rather than cream because it leaves the public site: it is a door, not a
 * fifth screen.
 */
export function PublicNav({
  pathname,
  isAdmin = false,
  className = "",
}: {
  pathname: string;
  /** A verified admin session — `getSession() !== null`, never a cookie's mere presence. */
  isAdmin?: boolean;
  className?: string;
}) {
  const items = navItemsFor(isAdmin);
  const active = activeNavHref(pathname);

  return (
    <nav aria-label="Sections" className={className}>
      <ul className={`grid grid-cols-4 gap-1 ${isAdmin ? "sm:grid-cols-5" : ""}`}>
        {items.map((item) => {
          const current = item.href === active;
          const isConsole = item.href === CONSOLE_NAV_ITEM.href;

          return (
            <li key={item.href} className={isConsole ? "col-span-4 sm:col-span-1" : undefined}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`font-pixel flex min-h-11 items-center justify-center rounded border-2 px-1 text-center text-[10px] leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${navItemTone(isConsole, current)}`}
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

/**
 * Four tones, and the two filled ones are what "you are here" means.
 *
 * Ink on amber is 10.41∶1 and ink on green 6.75∶1; amber on navy-deep is 8.79∶1. All three
 * clear AA at 10px, which the Phase 8 audit made the bar for every pixel label.
 */
function navItemTone(isConsole: boolean, current: boolean): string {
  if (current) {
    return isConsole
      ? "border-ink-px bg-amber text-ink-px shadow-[3px_3px_0_var(--color-ink-px)]"
      : "border-ink-px bg-pop-green text-ink-px shadow-[3px_3px_0_var(--color-ink-px)]";
  }

  return isConsole ? "border-amber text-amber" : "border-blue-frame text-cream";
}
