import { createDb, runMigrations } from "@chhal/db";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { seedReference } from "../../../packages/db/src/seed-reference.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);

const url = process.env.DATABASE_URL;
const dataDir=fileURLToPath(new URL("../../../.data/dev",import.meta.url));
const fresh=!url&&!existsSync(dataDir);
const handle = await createDb(url, { dataDir });
if (!url) console.log("DATABASE_URL absent : base embarquée PGlite (.data/dev), réservée au développement.");
// Existing databases are never migrated or reset at startup.
if(fresh){await runMigrations(handle,false);await seedReference(handle.db);}
else{
  try{
    await handle.db.execute(sql`SELECT payload, ingestion_key FROM match_candidates LIMIT 0`);
    await handle.db.execute(sql`SELECT ingestion_key FROM price_observations LIMIT 0`);
  }catch{
    await handle.close();
    throw new Error("Mise à jour 0007 requise. Sauvegarder la base, puis appliquer la migration validée avec --confirm. Aucun changement automatique.");
  }
}

const { port, ...options } = config;
const app = buildApp(handle.db, options);
app.addHook("onClose", async () => { await handle.close(); });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void app.close(); });
try {
  await app.listen({ port, host: "0.0.0.0" });
} catch {
  await app.close();
  throw new Error("Impossible de demarrer l API Chhal. Verifier la configuration et la base.");
}
console.log(`API Chhal démarrée sur http://localhost:${port}`);
