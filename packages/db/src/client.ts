import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbHandle = { db: Db; close: () => Promise<void> };

/** Postgres réel (Neon, local) si `url` est fourni, sinon PGlite (Postgres embarqué, dev/test). */
export async function createDb(url?: string, opts: { dataDir?: string } = {}): Promise<DbHandle> {
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    return { db: drizzlePg(pool, { schema }) as unknown as Db, close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  if (opts.dataDir) mkdirSync(dirname(opts.dataDir), { recursive: true });
  const client = new PGlite(opts.dataDir);
  await client.waitReady;
  return { db: drizzleLite(client, { schema }) as unknown as Db, close: () => client.close() };
}
