#!/usr/bin/env node
/**
 * Generate the ADMIN_PASSWORD_HASH value.
 *
 *   node scripts/hash-password.mjs 'my admin password'
 *
 * Prints the bcrypt hash (cost 12) and nothing else. Quote the password so the shell keeps
 * it intact, and remember it lands in your shell history.
 *
 * Paste the output as-is into the Vercel dashboard. In a local `.env` file you must escape
 * every `$` as `\$` first — Next.js parses .env with dotenv-expand, which reads `$2b$12$…`
 * as variable references and eats most of the hash (quoting does not help).
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  process.stderr.write("usage: node scripts/hash-password.mjs '<password>'\n");
  process.exit(1);
}

process.stdout.write(`${bcrypt.hashSync(password, 12)}\n`);
