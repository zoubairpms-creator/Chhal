import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migrateLite } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { createDb, type DbHandle } from "./client.js";

export const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export async function runMigrations(handle: DbHandle, usingUrl: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (usingUrl ? migratePg : migrateLite)(handle.db as any, { migrationsFolder });
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  if(!process.argv.includes("--confirm"))throw new Error("Migration non exécutée : sauvegarder la base et ajouter --confirm après validation.");
  const url = process.env.DATABASE_URL;
  const h = await createDb(url, { dataDir: ".data/dev" });
  await runMigrations(h, !!url);
  await h.close();
  console.log("Migrations appliquées.");
}
