import { createDb } from "./client.js";
import { runMigrations } from "./migrate.js";
import { resetAll, seedButterFixture, seedBasketFixture } from "./fixtures.js";
import { seedCatalogue, seedPresets } from "./catalogue.js";

if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL) throw new Error("Le seed de fixtures est reserve a PGlite en developpement. Utiliser seed-reference-cli.ts pour le catalogue distant.");
if (!process.argv.includes("--reset-dev")) throw new Error("Ce seed efface la base locale : --reset-dev exige apres sauvegarde et accord.");
const url = process.env.DATABASE_URL;
const h = await createDb(url, { dataDir: ".data/dev" });
await runMigrations(h, !!url);
await resetAll(h.db);
await seedButterFixture(h.db);
await seedBasketFixture(h.db);
await seedCatalogue(h.db);
await seedPresets(h.db);
await h.close();
console.log("Fixtures chargées (beurre réel + panier fictif test_only).");
