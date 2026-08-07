/**
 * The site nav: four public screens, four short pixel labels — plus a fifth for the owner.
 *
 * Server components have no `usePathname()`, so every page hands its own path to
 * `PublicNav` and the active item is decided here — pure, and therefore testable without a
 * router.
 *
 * **The admin is advertised to the admin only** (Phase 10). Until then `/admin` was absent
 * from every screen, which is fine as noise reduction and was never the security layer
 * (that is `requireAdmin()` in `src/lib/dal.ts`) — but it also meant that once the owner
 * logged in there was no way back out of the console, and no way in from the public site
 * except typing the URL. `navItemsFor(false)` is byte-for-byte the old four-item nav: a
 * guest's HTML contains no CONSOLE label and no `/admin` href at all, because the item is
 * never constructed rather than hidden with CSS.
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

/** The owner's fifth tab. Amber in the UI, so it reads as a door and not as a fifth screen. */
export const CONSOLE_NAV_ITEM: NavItem = { href: "/admin", label: "CONSOLE" };

/** What a verified admin session sees: the four public tabs, then the console. */
export const ADMIN_NAV: readonly NavItem[] = [...PUBLIC_NAV, CONSOLE_NAV_ITEM];

/**
 * The nav for this request.
 *
 * `isAdmin` comes from `getSession()` on the page — a **verified signature**, not the
 * presence of a cookie, so a forged `spidey_session=x` gets a guest's nav.
 */
export function navItemsFor(isAdmin: boolean): readonly NavItem[] {
  return isAdmin ? ADMIN_NAV : PUBLIC_NAV;
}

/**
 * Which nav item a path belongs to, or `null` when the path is off the map (login).
 *
 * `/figure/<slug>` counts as SHELF: a figure page is a page of the shelf, and highlighting
 * nothing there would read as "you are nowhere". Every admin screen — the console, the
 * vault, an edit form, Quick Add — counts as CONSOLE for the same reason. Query strings and
 * trailing slashes are ignored, so `/wishlist?cat=peter` still lights WISHLIST up.
 *
 * This answers about the path alone and does not know who is asking: for a guest the
 * returned `/admin` simply matches none of the four rendered items, so nothing lights up.
 */
export function activeNavHref(pathname: string | null | undefined): string | null {
  if (typeof pathname !== "string") return null;

  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/figure" || path.startsWith("/figure/")) return "/";

  const item = ADMIN_NAV.find(
    (candidate) =>
      candidate.href !== "/" && (path === candidate.href || path.startsWith(`${candidate.href}/`)),
  );

  return item?.href ?? null;
}
