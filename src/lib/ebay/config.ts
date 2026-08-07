/**
 * The gate: without keys, this feature does not exist.
 *
 * Every eBay code path in the app starts with `isEbayConfigured()`, and when it is false
 * nothing renders, nothing is queried and nothing is fetched — not a spinner, not an empty
 * panel, not a "prices unavailable" line. A public showcase that advertises a feature the
 * owner has not switched on is worse than one that quietly does not have it.
 *
 * The check is deliberately a **pure function of an env-shaped object**, with the
 * `process.env` read as a one-line wrapper. That is what makes the gate unit-testable
 * without touching the real environment, which matters more here than usual: the whole
 * design promise of Phase 8's prices is "the no-key build is the default build", and a
 * promise nobody tests is a wish.
 *
 * The secret itself never leaves `src/lib/ebay/client.ts`, which is `server-only`.
 */

/**
 * Just the two variables, so a test can hand over a literal instead of mutating globals.
 *
 * An index signature rather than two optional fields: Node's `ProcessEnv` is itself indexed,
 * and TypeScript refuses to see a type with only optional properties as compatible with it
 * ("no properties in common"). This shape accepts both.
 */
export interface EbayEnv {
  [key: string]: string | undefined;
}

/** Both keys present and non-blank. A half-configured app is an unconfigured app. */
export function isEbayConfiguredIn(env: EbayEnv): boolean {
  return Boolean(env.EBAY_CLIENT_ID?.trim()) && Boolean(env.EBAY_CLIENT_SECRET?.trim());
}

export function isEbayConfigured(): boolean {
  return isEbayConfiguredIn(process.env);
}
