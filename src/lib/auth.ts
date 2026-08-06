import bcrypt from "bcryptjs";

/**
 * `$2b$12$…` — algorithm, cost, then the 53-char salt+digest.
 *
 * Worth checking explicitly because of a nasty footgun: Next.js parses `.env` files with
 * dotenv-expand, which treats `$2b` as a variable reference and silently eats most of an
 * unquoted hash (quoting does not help — only `\$` does). The result is a hash that is
 * present, wrong, and rejects the correct password with no explanation.
 */
export function looksLikeBcryptHash(value: string | undefined | null): boolean {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

/**
 * The entire admin credential check: one password, one bcrypt hash from the environment.
 * Pure and testable — the server action only wires cookies and redirects around it.
 *
 * Always fails closed: an empty password or a missing/corrupt hash is a "no", never a
 * crash and never an accidental "yes". `bcrypt.compare` is constant-time for a given
 * hash, so this does not leak the password through timing.
 */
export async function authenticate(
  password: string,
  hash: string | undefined | null,
): Promise<boolean> {
  if (!password || !hash) return false;

  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
