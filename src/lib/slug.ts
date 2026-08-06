/**
 * Natural key for catalog figures. pop_number is NOT unique across product lines,
 * and variants (chase/GITD/metallic) share the base number — the slug combines
 * line, name and number into a stable, URL-safe identifier.
 */
export function figureSlug(productLine: string, name: string, popNumber?: number | null): string {
  const base = [productLine, name, popNumber != null ? String(popNumber) : ""]
    .map(slugify)
    .filter(Boolean)
    .join("-");
  return base;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
