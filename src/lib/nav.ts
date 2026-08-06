/**
 * The public nav: four screens, four short pixel labels.
 *
 * Server components have no `usePathname()`, so every page hands its own path to
 * `PublicNav` and the active item is decided here — pure, and therefore testable without a
 * router. The admin is deliberately absent: not advertising it is noise reduction, never the
 * security layer (that is `requireAdmin()` in `src/lib/dal.ts`).
 */

export interface NavItem {
  href: string;
  /** Press Start 2P, uppercase, kept short enough that four of them fit 375px in one row. */
  label: string;
}

export const PUBLIC_NAV: readonly NavItem[] = [
  { href: "/", label: "SHELF" },
  { href: "/search", label: "SEARCH" },
  { href: "/wishlist", label: "WISHLIST" },
  { href: "/stats", label: "STATS" },
];

/**
 * Which nav item a path belongs to, or `null` when the path is off the map (the admin).
 *
 * `/figure/<slug>` counts as SHELF: a figure page is a page of the shelf, and highlighting
 * nothing there would read as "you are nowhere". Query strings and trailing slashes are
 * ignored, so `/wishlist?cat=peter` still lights WISHLIST up.
 */
export function activeNavHref(pathname: string | null | undefined): string | null {
  if (typeof pathname !== "string") return null;

  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/figure" || path.startsWith("/figure/")) return "/";

  const item = PUBLIC_NAV.find(
    (candidate) =>
      candidate.href !== "/" && (path === candidate.href || path.startsWith(`${candidate.href}/`)),
  );

  return item?.href ?? null;
}
