/**
 * What we ask eBay, and where we send a visitor who wants to see the listings themselves.
 *
 * Pure — the query string is a product decision (it decides what "the price of this figure"
 * even means), so it is written and tested here rather than assembled inside a fetch call.
 */

/** eBay's Browse search endpoint. The marketplace is a header, not a path. */
export const EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

/** The token endpoint for the client-credentials grant. */
export const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";

/** The only scope a client-credentials token can hold, and all Browse needs. */
export const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";

/** US marketplace: the deepest Funko listings, and the currency the hobby quotes in. */
export const EBAY_MARKETPLACE = "EBAY_US";

/**
 * How many listings the median is computed over.
 *
 * 25 is a sample, not a census, and that is the point: the first page of relevance-sorted
 * Buy It Now listings is roughly what a human sees when they look this figure up, so the
 * median of it is roughly the number a human would come away with. A larger page would drag
 * in bundles, empty boxes and international freight and make the median *less* like the
 * answer to "what does this cost".
 */
export const EBAY_SEARCH_LIMIT = 25;

/**
 * `Funko Pop Spider-Man Last Stand 1450`.
 *
 * The pop number is the strongest signal eBay has — sellers put it in the title because
 * buyers search for it — so it goes in whenever we have one. Punctuation is stripped rather
 * than escaped: eBay's search treats `(` and `-` as syntax in some contexts, and a figure
 * named "Spider-Man (Fear Itself Suit)" must not become a boolean expression.
 */
export function ebaySearchQuery(name: string, popNumber: number | null | undefined): string {
  const cleaned = name
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const number =
    typeof popNumber === "number" && Number.isFinite(popNumber) ? ` ${Math.trunc(popNumber)}` : "";

  return `Funko Pop ${cleaned}${number}`.trim();
}

/**
 * The human-facing search URL — where `SEE ON EBAY` goes.
 *
 * `LH_BIN=1` restricts it to Buy It Now, which is the same population the API call filters
 * to, so the page a visitor lands on is the page the median came from. Nothing about this
 * link needs a key, which is why it would work even if the API side were switched off — but
 * it is still only rendered behind the gate, because a price panel with no price is furniture.
 */
export function ebaySearchUrl(query: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_BIN=1`;
}
