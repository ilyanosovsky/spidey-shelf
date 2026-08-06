import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
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
 *
 * Initialization is LAZY: `next build` evaluates page modules while collecting page
 * data, and CI builds have no DATABASE_URL — a module-scope throw fails the build
 * there (postgres.js itself never connects until the first query, so the only eager
 * step worth deferring is this env read). The missing-env error surfaces on first
 * actual DB use instead.
 */
type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { spideyShelfPg?: postgres.Sql; spideyShelfDb?: Db };

function initDb(): Db {
  if (globalForDb.spideyShelfDb) return globalForDb.spideyShelfDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see docs/wiki/Environment.md.");
  }

  const client =
    globalForDb.spideyShelfPg ??
    postgres(connectionString, {
      max: 1,
      prepare: false,
    });
  globalForDb.spideyShelfPg = client;

  const instance = drizzle(client, { schema });
  globalForDb.spideyShelfDb = instance;
  return instance;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, _receiver) {
    const instance = initDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
