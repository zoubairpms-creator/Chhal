import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { FAMILLE_DE_PRODUIT } from "./familles.js";
import { chains, observationReviews, priceObservations, productAliases, products, stores } from "./schema.js";

export const FIXTURE_DATE = "2026-10-17"; // provisoire, à confirmer
export const VILLE = "Casablanca";

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

// BIM : prix illisible -> aucune observation (jamais null)
const BUTTER_PRICES: Record<string, string> = {
  "al-hari": "78.00",
  marjane: "79.95",
  atacadao: "90.00",
  carrefour: "107.95",
  "asswak-assalam": "112.30",
};

export async function seedButterFixture(db: Db) {
  const chainRows = await db.insert(chains).values(CHAINS).returning();
  const storeRows = await db
    .insert(stores)
    .values(chainRows.map((c) => ({ chainId: c.id, ville: VILLE })))
    .returning();
  const [butter] = await db
    .insert(products)
    .values({
      slug: "beurre-centrale-1kg",
      famille: FAMILLE_DE_PRODUIT["beurre-centrale-1kg"],
      nomNormalise: "beurre centrale 100% frais 1 kg",
      nomAffiche: "Beurre Centrale 100% frais 1 kg",
      marque: "Centrale",
      formatValeur: "1",
      formatUnite: "kg",
      categorie: "cremerie",
    })
    .returning();
  await db.insert(productAliases).values([
    { productId: butter.id, texte: "beurre", formeNormalisee: "beurre", langue: "fr" },
    { productId: butter.id, texte: "زبدة", formeNormalisee: "زبدة", langue: "ar" },
    { productId: butter.id, texte: "zebda", formeNormalisee: "zebda", langue: "darija" },
    { productId: butter.id, texte: "butter", formeNormalisee: "butter", langue: "en" },
  ]);
  const chainSlugById = new Map(chainRows.map((c) => [c.id, c.slug]));
  for (const s of storeRows) {
    const prix = BUTTER_PRICES[chainSlugById.get(s.chainId)!];
    if (!prix) continue;
    const [obs] = await db
      .insert(priceObservations)
      .values({
        productId: butter.id,
        storeId: s.id,
        prixMad: prix,
        dateReleve: FIXTURE_DATE,
        source: "fixture",
        confiance: "moyenne",
        testOnly: false,
      })
      .returning();
    await db.insert(observationReviews).values({ observationId: obs.id, decision: "publie", reviewer: "fixture" });
  }
  return { productId: butter.id };
}

export async function resetAll(db: Db) {
  // Les triggers interdisent DELETE sur les observations : TRUNCATE les contourne (test/dev uniquement).
  await db.execute(sql`TRUNCATE import_jobs, raw_data, sources, preset_baskets, observation_reviews, price_observations, match_candidates, product_aliases, products, stores, chains RESTART IDENTITY CASCADE`);
}

// Panier FICTIF de 10 articles (prix inventés, source = fixture, test_only = true) : jamais affiché comme réel.
const BASKET: { slug: string; nom: string; marque: string; valeur: number; unite: "g" | "kg" | "ml" | "cl" | "l" | "piece"; categorie: string; alias: [string, string][]; prix: Record<string, number> }[] = [
  { slug: "huile-table-1l", nom: "Huile de table Lesieur 1 L", marque: "Lesieur", valeur: 1, unite: "l", categorie: "epicerie", alias: [["huile", "fr"], ["زيت", "ar"], ["zit", "darija"], ["oil", "en"]], prix: { marjane: 21.5, carrefour: 22.9, atacadao: 20.9, "al-hari": 21.0 } },
  { slug: "sucre-1kg", nom: "Sucre en morceaux 1 kg", marque: "Cosumar", valeur: 1, unite: "kg", categorie: "epicerie", alias: [["sucre", "fr"], ["سكر", "ar"], ["skkar", "darija"], ["sugar", "en"]], prix: { marjane: 8.9, carrefour: 9.2, atacadao: 8.7, "al-hari": 8.8, kazyon: 8.6 } },
  { slug: "lait-demi-ecreme-1l", nom: "Lait demi-écrémé Centrale 1 L", marque: "Centrale", valeur: 1, unite: "l", categorie: "cremerie", alias: [["lait", "fr"], ["حليب", "ar"], ["halib", "darija"], ["milk", "en"]], prix: { marjane: 7.6, carrefour: 7.9, atacadao: 7.4, kazyon: 7.5 } },
  { slug: "farine-ble-5kg", nom: "Farine de blé 5 kg", marque: "Dyar", valeur: 5, unite: "kg", categorie: "epicerie", alias: [["farine", "fr"], ["دقيق", "ar"], ["d9i9", "darija"], ["flour", "en"]], prix: { marjane: 38, carrefour: 41, "al-hari": 36.5 } },
  { slug: "the-vert-200g", nom: "Thé vert Sultan 200 g", marque: "Sultan", valeur: 200, unite: "g", categorie: "epicerie", alias: [["the", "fr"], ["شاي", "ar"], ["atay", "darija"], ["tea", "en"]], prix: { marjane: 18.5, carrefour: 17.9, atacadao: 17.2, kazyon: 18.0 } },
  { slug: "oeufs-plateau-30", nom: "Œufs plateau de 30", marque: "Local", valeur: 30, unite: "piece", categorie: "frais", alias: [["oeufs", "fr"], ["بيض", "ar"], ["bid", "darija"], ["eggs", "en"]], prix: { marjane: 42, atacadao: 39.5, "al-hari": 40, kazyon: 41 } },
  { slug: "eau-minerale-1-5l", nom: "Eau minérale Sidi Ali 1,5 L", marque: "Sidi Ali", valeur: 1.5, unite: "l", categorie: "boissons", alias: [["eau", "fr"], ["ماء", "ar"], ["lma", "darija"], ["water", "en"]], prix: { marjane: 5, carrefour: 5.2, atacadao: 4.8, "al-hari": 4.9, kazyon: 5 } },
  { slug: "lessive-poudre-3kg", nom: "Lessive en poudre Ariel 3 kg", marque: "Ariel", valeur: 3, unite: "kg", categorie: "menage", alias: [["lessive", "fr"], ["مسحوق الغسيل", "ar"], ["tide", "darija"], ["detergent", "en"]], prix: { marjane: 79, carrefour: 74.9, atacadao: 76 } },
  { slug: "riz-long-grain-1kg", nom: "Riz long grain 1 kg", marque: "Taous", valeur: 1, unite: "kg", categorie: "epicerie", alias: [["riz", "fr"], ["رز", "ar"], ["rouz", "darija"], ["rice", "en"]], prix: { marjane: 14.5, carrefour: 13.9, "al-hari": 13.5, kazyon: 14 } },
  { slug: "savon-liquide-250ml", nom: "Savon liquide Dettol 250 ml", marque: "Dettol", valeur: 250, unite: "ml", categorie: "menage", alias: [["savon", "fr"], ["صابون", "ar"], ["saboun", "darija"], ["soap", "en"]], prix: { carrefour: 22, atacadao: 19.9, kazyon: 20.5 } },
];

export async function seedBasketFixture(db: Db) {
  const chainRows = await db.select().from(chains);
  const storeRows = await db.select().from(stores);
  const storeBySlug = new Map(chainRows.map((c) => [c.slug, storeRows.find((s) => s.chainId === c.id)!.id]));
  for (const b of BASKET) {
    const [p] = await db
      .insert(products)
      .values({ slug: b.slug, famille: FAMILLE_DE_PRODUIT[b.slug] ?? null, nomNormalise: b.nom.toLowerCase(), nomAffiche: b.nom, marque: b.marque, formatValeur: String(b.valeur), formatUnite: b.unite, categorie: b.categorie })
      .returning();
    await db.insert(productAliases).values(b.alias.map(([texte, langue]) => ({ productId: p.id, texte, formeNormalisee: texte.toLowerCase(), langue: langue as "fr" | "ar" | "darija" | "en" })));
    for (const [slug, prix] of Object.entries(b.prix)) {
      const [obs] = await db
        .insert(priceObservations)
        .values({ productId: p.id, storeId: storeBySlug.get(slug)!, prixMad: prix.toFixed(2), dateReleve: FIXTURE_DATE, source: "fixture", confiance: "basse", testOnly: true })
        .returning();
      await db.insert(observationReviews).values({ observationId: obs.id, decision: "publie", reviewer: "fixture" });
    }
  }
}
