import { createDb, runMigrations } from "./index.js";
import { chains, stores } from "./schema.js";
import { sql } from "drizzle-orm";

const CHAINS = [
  { slug: "bim", nom: "BIM", nomAr: "بيم" },
  { slug: "kazyon", nom: "Kazyon", nomAr: "كازيون" },
  { slug: "supeco", nom: "Supeco", nomAr: "سوبيكو" },
  { slug: "marjane", nom: "Marjane", nomAr: "مرجان" },
  { slug: "carrefour", nom: "Carrefour", nomAr: "كارفور" },
  { slug: "atacadao", nom: "Atacadao", nomAr: "اتقداو" },
  { slug: "al-hari", nom: "Al Hari", nomAr: "الهري" },
  { slug: "asswak-assalam", nom: "Asswak Assalam", nomAr: "أسواق السلام" },
];

const url = process.env.DATABASE_URL;
const handle = await createDb(url, { dataDir: ".data/dev" });
if (!url) console.log("DATABASE_URL absent : base embarquée PGlite (.data/dev).");
await runMigrations(handle, !!url);

// Insérer les chaînes si elles n'existent pas
const existing = await handle.db.select({ slug: chains.slug }).from(chains);
const existingSlugs = new Set(existing.map((r) => r.slug));
let created = 0;
for (const c of CHAINS) {
  if (existingSlugs.has(c.slug)) continue;
  await handle.db.insert(chains).values(c);
  created++;
}

// Créer un magasin par chaîne à Casablanca si absent
const allChains = await handle.db.select().from(chains);
const allStores = await handle.db.select().from(stores);
for (const c of allChains) {
  const hasStore = allStores.some((s) => s.chainId === c.id && s.ville === "Casablanca");
  if (!hasStore) {
    await handle.db.insert(stores).values({ chainId: c.id, ville: "Casablanca" });
  }
}

console.log(`Seed chains : ${created} chaînes créées. Total : ${allChains.length}.`);
process.exit(0);
