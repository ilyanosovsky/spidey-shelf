import { redirect } from "next/navigation";

/**
 * The Phase 3 add screen, retired.
 *
 * `/admin/add` replaced it in Phase 6: same job, four server-rendered steps instead of one
 * client-side form, a mandatory variant confirmation and a duplicate guard. The old path
 * stays as a redirect because it is bookmarked on the owner's phone and linked from every
 * screenshot in the wiki.
 */
export const dynamic = "force-dynamic";

export default async function LegacyNewOwnedFigurePage() {
  redirect("/admin/add");
}
