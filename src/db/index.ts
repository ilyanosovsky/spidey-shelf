import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Postgres.js client for the Railway instance.
 *
 * Serverless-friendly defaults: Vercel functions are short-lived and each concurrent
 * invocation gets its own module instance, so a pool per instance must stay tiny
 * (`max: 1`) or Railway's connection limit is exhausted. `prepare: false` keeps the
 * driver off server-side prepared statements, which do not survive connection
 * recycling behind poolers.
 *
 * The client is cached on `globalThis` so hot reloads in dev and warm lambdas in
 * production reuse one connection instead of leaking a new one per module evaluation.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — see docs/wiki/Environment.md.");
}

const globalForDb = globalThis as unknown as { spideyShelfPg?: postgres.Sql };

const client =
  globalForDb.spideyShelfPg ??
  postgres(connectionString, {
    max: 1,
    prepare: false,
  });

globalForDb.spideyShelfPg = client;

export const db = drizzle(client, { schema });

export { schema };
