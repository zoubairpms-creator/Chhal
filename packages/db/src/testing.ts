import { assertTestDatabase } from "./guard.js";
import { createDb, type DbHandle } from "./client.js";
import { runMigrations } from "./migrate.js";
import { resetAll } from "./fixtures.js";

/** Base de test : DATABASE_URL_TEST (nom finissant par _test) sinon PGlite en mémoire. Jamais la base de dev. */
export async function createTestDb(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL_TEST;
  if (url) assertTestDatabase(url);
  const h = await createDb(url || undefined);
  await runMigrations(h, !!url);
  await resetAll(h.db);
  return h;
}
