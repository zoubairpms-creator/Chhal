import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { FAMILLE_DE_PRODUIT } from "./familles.js";
import { chains, products, stores } from "./schema.js";

/**
 * Seed des 24 produits BIM extraits de hmizate.ma (catalogue BIM 1 septembre 2026).
 * Ces produits servent de catalogue canonique pour tester le matching et l'ingestion.
 *
 * Source : https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1085
 * Date : 2026-09-01
 */
const BIM_PRODUCTS = [
  { nom: "Boisson NITA", valeur: 290, unite: "ml" as const, categorie: "boissons" },
  { nom: "BI FRUTAS Tropical", valeur: 1, unite: "l" as const, categorie: "boissons" },
  { nom: "Eau minérale Aïn Saïss", valeur: 2, unite: "l" as const, categorie: "boissons" },
  { nom: "Monster Mangue", valeur: 500, unite: "ml" as const, categorie: "boissons" },
  { nom: "Coca-Cola Vanille ou Cerise", valeur: 330, unite: "ml" as const, categorie: "boissons" },
  { nom: "Cake Massimo Swiss Roll Tiramisu", valeur: 300, unite: "g" as const, categorie: "epicerie" },
  { nom: "Succédané de chocolat Fond'Or", valeur: 135, unite: "g" as const, categorie: "epicerie" },
  { nom: "Tic Tac", valeur: 16, unite: "g" as const, categorie: "epicerie" },
  { nom: "Snacks Deriko", valeur: 80, unite: "g" as const, categorie: "epicerie" },
  { nom: "Fromage blanc Le Berger", valeur: 180, unite: "g" as const, categorie: "cremerie" }, // 6 × 30 g
  { nom: "Ayran Piknik", valeur: 250, unite: "ml" as const, categorie: "cremerie" },
  { nom: "Margarine Luxmar", valeur: 450, unite: "g" as const, categorie: "cremerie" },
  { nom: "Fromage à tartiner Spanish Cheese", valeur: 125, unite: "g" as const, categorie: "cremerie" },
  { nom: "Yaourt brassé Mövenpick", valeur: 100, unite: "g" as const, categorie: "cremerie" },
  { nom: "Dessert Gelly-Clesa", valeur: 400, unite: "g" as const, categorie: "cremerie" }, // 4 × 100 g
  { nom: "Tranches de dinde Genial", valeur: 240, unite: "g" as const, categorie: "charcuterie" }, // 3 × 80 g
  { nom: "Suprême filet de dinde Dindy", valeur: 80, unite: "g" as const, categorie: "charcuterie" },
  { nom: "Pack sauce tomate Olla", valeur: 1210, unite: "g" as const, categorie: "epicerie" }, // 11 × 110 g
  { nom: "Harissa Oualili", valeur: 320, unite: "g" as const, categorie: "epicerie" },
  { nom: "Maïs à pop-corn L'Mema", valeur: 500, unite: "g" as const, categorie: "epicerie" },
];

export async function seedHmizateProducts(db: Db) {
  // Vérifier si les produits existent déjà
  const existing = await db.select({ slug: products.slug }).from(products);
  const existingSlugs = new Set(existing.map((r) => r.slug));

  let created = 0;
  for (const p of BIM_PRODUCTS) {
    const slug = p.nom
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (existingSlugs.has(slug)) continue;

    await db.insert(products).values({
      slug,
      famille: FAMILLE_DE_PRODUIT[slug] ?? null,
      nomNormalise: p.nom.toLowerCase(),
      nomAffiche: p.nom,
      marque: null,
      formatValeur: String(p.valeur),
      formatUnite: p.unite,
      categorie: p.categorie,
    });
    created++;
  }

  // S'assurer qu'il y a un magasin BIM à Casablanca
  const [bimChain] = await db.select().from(chains).where(sql`slug = 'bim'`);
  if (bimChain) {
    const existingStores = await db.select().from(stores).where(sql`chain_id = ${bimChain.id}`);
    if (existingStores.length === 0) {
      await db.insert(stores).values({ chainId: bimChain.id, ville: "Casablanca" });
    }
  }

  return { created, total: BIM_PRODUCTS.length };
}
