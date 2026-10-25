import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { FAMILLES, FAMILLE_DE_PRODUIT } from "./familles.js";
import { presetBaskets, productAliases, products } from "./schema.js";

type Unite = "g" | "kg" | "ml" | "cl" | "l" | "piece";
type Alias = [texte: string, langue: "fr" | "ar" | "darija" | "en"];
export type CatalogueItem = {
  slug: string;
  nom: string;
  valeur: number;
  unite: Unite;
  categorie: "epicerie" | "frais" | "cremerie" | "boissons" | "menage" | "hygiene";
  alias: Alias[];
};

const a = (fr: string, ar: string, darija: string, en: string, extra: Alias[] = []): Alias[] => [
  [fr, "fr"], [ar, "ar"], [darija, "darija"], [en, "en"], ...extra,
];

/**
 * PROPOSITION de catalogue (produits génériques, sans marque : les marques s'ajoutent par l'administration).
 * Aucun prix. À valider par le porteur du projet avant import en production.
 */
export const CATALOGUE: CatalogueItem[] = [
  // Épicerie
  { slug: "riz-long-grain-1kg", nom: "Riz long grain 1 kg", valeur: 1, unite: "kg", categorie: "epicerie", alias: a("riz", "رز", "rouz", "rice") },
  { slug: "sucre-1kg", nom: "Sucre en morceaux 1 kg", valeur: 1, unite: "kg", categorie: "epicerie", alias: a("sucre", "سكر", "skkar", "sugar") },
  { slug: "farine-ble-5kg", nom: "Farine de blé 5 kg", valeur: 5, unite: "kg", categorie: "epicerie", alias: a("farine", "دقيق", "d9i9", "flour") },
  { slug: "semoule-fine-1kg", nom: "Semoule fine 1 kg", valeur: 1, unite: "kg", categorie: "epicerie", alias: a("semoule", "سميد", "smid", "semolina") },
  { slug: "couscous-1kg", nom: "Couscous 1 kg", valeur: 1, unite: "kg", categorie: "epicerie", alias: a("couscous", "كسكس", "kseksou", "couscous") },
  { slug: "pates-spaghetti-500g", nom: "Pâtes spaghetti 500 g", valeur: 500, unite: "g", categorie: "epicerie", alias: a("pates", "معكرونة", "makarona", "pasta") },
  { slug: "vermicelles-500g", nom: "Vermicelles 500 g", valeur: 500, unite: "g", categorie: "epicerie", alias: a("vermicelles", "شعرية", "chaaria", "vermicelli") },
  { slug: "huile-table-1l", nom: "Huile de table 1 L", valeur: 1, unite: "l", categorie: "epicerie", alias: a("huile", "زيت", "zit", "oil") },
  { slug: "huile-olive-1l", nom: "Huile d'olive 1 L", valeur: 1, unite: "l", categorie: "epicerie", alias: a("huile d'olive", "زيت الزيتون", "zit zitoun", "olive oil") },
  { slug: "the-vert-200g", nom: "Thé vert 200 g", valeur: 200, unite: "g", categorie: "epicerie", alias: a("the", "شاي", "atay", "tea") },
  { slug: "cafe-moulu-250g", nom: "Café moulu 250 g", valeur: 250, unite: "g", categorie: "epicerie", alias: a("cafe", "قهوة", "qahwa", "coffee") },
  { slug: "sel-fin-1kg", nom: "Sel fin 1 kg", valeur: 1, unite: "kg", categorie: "epicerie", alias: a("sel", "ملح", "melha", "salt") },
  { slug: "concentre-tomate-400g", nom: "Concentré de tomate 400 g", valeur: 400, unite: "g", categorie: "epicerie", alias: a("concentre de tomate", "معجون الطماطم", "tmatich m3ajen", "tomato paste") },
  { slug: "lentilles-1kg", nom: "Lentilles 1 kg", valeur: 1, unite: "kg", categorie: "epicerie", alias: a("lentilles", "عدس", "3ads", "lentils") },
  { slug: "pois-chiches-1kg", nom: "Pois chiches 1 kg", valeur: 1, unite: "kg", categorie: "epicerie", alias: a("pois chiches", "حمص", "hommos", "chickpeas") },
  { slug: "haricots-blancs-1kg", nom: "Haricots blancs 1 kg", valeur: 1, unite: "kg", categorie: "epicerie", alias: a("haricots blancs", "لوبيا", "loubia", "white beans") },
  { slug: "sardines-conserve-125g", nom: "Sardines en conserve 125 g", valeur: 125, unite: "g", categorie: "epicerie", alias: a("sardines", "سردين معلب", "sardine", "canned sardines") },
  { slug: "thon-conserve-160g", nom: "Thon en conserve 160 g", valeur: 160, unite: "g", categorie: "epicerie", alias: a("thon", "تونة", "tun", "tuna") },
  { slug: "confiture-370g", nom: "Confiture 370 g", valeur: 370, unite: "g", categorie: "epicerie", alias: a("confiture", "مربى", "mrabba", "jam") },
  { slug: "miel-500g", nom: "Miel 500 g", valeur: 500, unite: "g", categorie: "epicerie", alias: a("miel", "عسل", "3assel", "honey") },
  { slug: "olives-500g", nom: "Olives 500 g", valeur: 500, unite: "g", categorie: "epicerie", alias: a("olives", "زيتون", "zitoun", "olives") },
  { slug: "levure-boulangere", nom: "Levure boulangère (sachet)", valeur: 1, unite: "piece", categorie: "epicerie", alias: a("levure", "خميرة", "khmira", "yeast") },
  { slug: "cumin-100g", nom: "Cumin moulu 100 g", valeur: 100, unite: "g", categorie: "epicerie", alias: a("cumin", "كمون", "kamoun", "cumin") },
  // Frais et crémerie
  { slug: "lait-demi-ecreme-1l", nom: "Lait demi-écrémé 1 L", valeur: 1, unite: "l", categorie: "cremerie", alias: a("lait", "حليب", "halib", "milk") },
  { slug: "beurre-1kg", nom: "Beurre 1 kg", valeur: 1, unite: "kg", categorie: "cremerie", alias: a("beurre", "زبدة", "zebda", "butter") },
  { slug: "oeufs-plateau-30", nom: "Œufs plateau de 30", valeur: 30, unite: "piece", categorie: "frais", alias: a("oeufs", "بيض", "bid", "eggs") },
  { slug: "yaourt-nature-x4", nom: "Yaourt nature (pack de 4)", valeur: 4, unite: "piece", categorie: "cremerie", alias: a("yaourt", "زبادي", "yaourt", "yogurt") },
  { slug: "fromage-portions-x8", nom: "Fromage fondu portions (boîte de 8)", valeur: 8, unite: "piece", categorie: "cremerie", alias: a("fromage", "جبن", "jben", "cheese") },
  { slug: "poulet-frais-1kg", nom: "Poulet frais 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("poulet", "دجاج", "djaj", "chicken") },
  { slug: "viande-hachee-1kg", nom: "Viande hachée de bœuf 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("viande hachee", "لحم مفروم", "kefta", "minced beef") },
  { slug: "viande-boeuf-1kg", nom: "Viande de bœuf 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("viande de boeuf", "لحم بقري", "lham", "beef") },
  { slug: "pain-baguette", nom: "Pain baguette (pièce)", valeur: 1, unite: "piece", categorie: "frais", alias: a("pain", "خبز", "khobz", "bread") },
  { slug: "pommes-de-terre-1kg", nom: "Pommes de terre 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("pommes de terre", "بطاطس", "batata", "potatoes") },
  { slug: "tomates-1kg", nom: "Tomates 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("tomates", "طماطم", "matisha", "tomatoes") },
  { slug: "oignons-1kg", nom: "Oignons 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("oignons", "بصل", "bsla", "onions") },
  { slug: "carottes-1kg", nom: "Carottes 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("carottes", "جزر", "khizzou", "carrots") },
  { slug: "bananes-1kg", nom: "Bananes 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("bananes", "موز", "banane", "bananas") },
  { slug: "pommes-1kg", nom: "Pommes 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("pommes", "تفاح", "tefah", "apples") },
  { slug: "oranges-1kg", nom: "Oranges 1 kg", valeur: 1, unite: "kg", categorie: "frais", alias: a("oranges", "برتقال", "limoun", "oranges") },
  // Boissons
  { slug: "eau-minerale-1-5l", nom: "Eau minérale 1,5 L", valeur: 1.5, unite: "l", categorie: "boissons", alias: a("eau", "ماء", "lma", "water") },
  { slug: "eau-minerale-5l", nom: "Eau minérale 5 L", valeur: 5, unite: "l", categorie: "boissons", alias: a("eau 5 litres", "ماء 5 لتر", "lma 5 litre", "water 5 l") },
  { slug: "soda-1l", nom: "Boisson gazeuse 1 L", valeur: 1, unite: "l", categorie: "boissons", alias: a("soda", "مشروب غازي", "gazouz", "soda") },
  { slug: "jus-orange-1l", nom: "Jus d'orange 1 L", valeur: 1, unite: "l", categorie: "boissons", alias: a("jus", "عصير", "3asir", "juice") },
  // Ménage et hygiène
  { slug: "lessive-poudre-3kg", nom: "Lessive en poudre 3 kg", valeur: 3, unite: "kg", categorie: "menage", alias: a("lessive", "مسحوق الغسيل", "lessive", "detergent") },
  { slug: "liquide-vaisselle-1l", nom: "Liquide vaisselle 1 L", valeur: 1, unite: "l", categorie: "menage", alias: a("liquide vaisselle", "سائل الأطباق", "sabon dyal lmwaa3en", "dish soap") },
  { slug: "eau-de-javel-1l", nom: "Eau de Javel 1 L", valeur: 1, unite: "l", categorie: "menage", alias: a("javel", "ماء جافيل", "javel", "bleach") },
  { slug: "nettoyant-sol-1l", nom: "Nettoyant sol 1 L", valeur: 1, unite: "l", categorie: "menage", alias: a("nettoyant sol", "منظف الأرضية", "nettoyant dyal l'ard", "floor cleaner") },
  { slug: "savon-liquide-250ml", nom: "Savon liquide 250 ml", valeur: 250, unite: "ml", categorie: "hygiene", alias: a("savon liquide", "صابون سائل", "saboun", "liquid soap") },
  { slug: "savon-toilette-x4", nom: "Savon de toilette (lot de 4)", valeur: 4, unite: "piece", categorie: "hygiene", alias: a("savon", "صابون", "saboun", "soap bar") },
  { slug: "shampoing-400ml", nom: "Shampoing 400 ml", valeur: 400, unite: "ml", categorie: "hygiene", alias: a("shampoing", "شامبو", "shampooing", "shampoo") },
  { slug: "dentifrice-75ml", nom: "Dentifrice 75 ml", valeur: 75, unite: "ml", categorie: "hygiene", alias: a("dentifrice", "معجون الأسنان", "dentifrice", "toothpaste") },
  { slug: "papier-toilette-x12", nom: "Papier toilette (12 rouleaux)", valeur: 12, unite: "piece", categorie: "hygiene", alias: a("papier toilette", "ورق المرحاض", "papier", "toilet paper") },
];

export type PresetLine = { slug: string; quantite: number };
/** Ligne « n'importe quelle marque » : une quantité (kg, L ou pièces) d'une famille, au prix de la variante la moins chère. */
export type PresetFamilleLigne = { famille: string; quantiteBase: number; unite: "kg" | "l" | "piece" };
export type PresetLigne = PresetLine | PresetFamilleLigne;
export type PresetDef = {
  slug: string;
  profil: "essentiel" | "budget_serre" | "classe_moyenne" | "confort";
  nom: { fr: string; ar: string; en: string };
  description: { fr: string; ar: string; en: string };
  menage: number;
  lignes: PresetLigne[];
};

const UNITE_FAMILLE = { masse: "kg", volume: "l", piece: "piece" } as const;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
/** Taille d'un format exprimée dans l'unité de comptage de sa famille (kg, L ou pièces). */
function tailleEnUniteFamille(valeur: number, unite: CatalogueItem["unite"]): number {
  return { g: valeur / 1000, kg: valeur, ml: valeur / 1000, cl: valeur / 100, l: valeur, piece: valeur }[unite];
}

/**
 * Convertit les lignes « produit précis » des paniers de base en lignes « famille » : « 3 × riz 1 kg » devient « 3 kg de riz, n'importe quelle marque ».
 * Les produits sans famille restent des lignes précises. Deux produits d'une même famille sont additionnés.
 */
export function lignesAvecFamilles(lignes: PresetLine[]): PresetLigne[] {
  const out: PresetLigne[] = [];
  const index = new Map<string, number>();
  for (const l of lignes) {
    const famille = FAMILLE_DE_PRODUIT[l.slug];
    const item = CATALOGUE.find((c) => c.slug === l.slug);
    const def = FAMILLES.find((f) => f.slug === famille);
    if (!famille || !item || !def) { out.push(l); continue; }
    const q = l.quantite * tailleEnUniteFamille(item.valeur, item.unite);
    const i = index.get(famille);
    if (i === undefined) { index.set(famille, out.length); out.push({ famille, quantiteBase: round3(q), unite: UNITE_FAMILLE[def.classe] }); }
    else { const cur = out[i] as PresetFamilleLigne; cur.quantiteBase = round3(cur.quantiteBase + q); }
  }
  return out;
}

const L = (...pairs: [string, number][]): PresetLine[] => pairs.map(([slug, quantite]) => ({ slug, quantite }));

const essentiel = L(
  ["riz-long-grain-1kg", 3], ["sucre-1kg", 6], ["farine-ble-5kg", 2], ["huile-table-1l", 3], ["the-vert-200g", 2], ["lait-demi-ecreme-1l", 16],
  ["oeufs-plateau-30", 1], ["pates-spaghetti-500g", 4], ["couscous-1kg", 2], ["concentre-tomate-400g", 3], ["lentilles-1kg", 1], ["sel-fin-1kg", 1],
  ["savon-toilette-x4", 1], ["lessive-poudre-3kg", 1], ["liquide-vaisselle-1l", 1], ["eau-de-javel-1l", 1], ["papier-toilette-x12", 1], ["dentifrice-75ml", 2],
);
const budget = L(
  ["riz-long-grain-1kg", 4], ["sucre-1kg", 6], ["farine-ble-5kg", 3], ["huile-table-1l", 3], ["the-vert-200g", 2], ["lait-demi-ecreme-1l", 12],
  ["oeufs-plateau-30", 1], ["pates-spaghetti-500g", 5], ["semoule-fine-1kg", 2], ["concentre-tomate-400g", 3], ["lentilles-1kg", 2], ["pois-chiches-1kg", 1],
  ["haricots-blancs-1kg", 1], ["pommes-de-terre-1kg", 10], ["oignons-1kg", 5], ["tomates-1kg", 6], ["carottes-1kg", 3], ["poulet-frais-1kg", 2],
  ["sardines-conserve-125g", 4], ["sel-fin-1kg", 1], ["lessive-poudre-3kg", 1], ["liquide-vaisselle-1l", 1], ["eau-de-javel-1l", 1], ["savon-toilette-x4", 1], ["papier-toilette-x12", 1],
);
const moyenne = L(
  ["riz-long-grain-1kg", 4], ["sucre-1kg", 6], ["farine-ble-5kg", 2], ["huile-table-1l", 4], ["the-vert-200g", 2], ["cafe-moulu-250g", 1], ["lait-demi-ecreme-1l", 20],
  ["oeufs-plateau-30", 2], ["pates-spaghetti-500g", 5], ["couscous-1kg", 2], ["concentre-tomate-400g", 3], ["lentilles-1kg", 1], ["pois-chiches-1kg", 1],
  ["pommes-de-terre-1kg", 8], ["oignons-1kg", 4], ["tomates-1kg", 6], ["carottes-1kg", 3], ["poulet-frais-1kg", 4], ["viande-hachee-1kg", 2], ["viande-boeuf-1kg", 2],
  ["yaourt-nature-x4", 4], ["fromage-portions-x8", 2], ["beurre-1kg", 1], ["bananes-1kg", 3], ["pommes-1kg", 3], ["oranges-1kg", 4], ["thon-conserve-160g", 3],
  ["confiture-370g", 1], ["olives-500g", 1], ["jus-orange-1l", 4], ["soda-1l", 4], ["eau-minerale-1-5l", 12], ["lessive-poudre-3kg", 1], ["liquide-vaisselle-1l", 1],
  ["eau-de-javel-1l", 1], ["nettoyant-sol-1l", 1], ["savon-toilette-x4", 2], ["shampoing-400ml", 1], ["dentifrice-75ml", 2], ["papier-toilette-x12", 2],
);
const confort = L(
  ["riz-long-grain-1kg", 3], ["sucre-1kg", 5], ["farine-ble-5kg", 2], ["huile-table-1l", 3], ["huile-olive-1l", 2], ["the-vert-200g", 2], ["cafe-moulu-250g", 2],
  ["lait-demi-ecreme-1l", 24], ["oeufs-plateau-30", 2], ["pates-spaghetti-500g", 4], ["couscous-1kg", 2], ["concentre-tomate-400g", 2], ["pommes-de-terre-1kg", 6],
  ["oignons-1kg", 3], ["tomates-1kg", 6], ["carottes-1kg", 3], ["poulet-frais-1kg", 5], ["viande-hachee-1kg", 3], ["viande-boeuf-1kg", 4], ["yaourt-nature-x4", 8],
  ["fromage-portions-x8", 3], ["beurre-1kg", 2], ["bananes-1kg", 4], ["pommes-1kg", 4], ["oranges-1kg", 6], ["thon-conserve-160g", 4], ["confiture-370g", 2],
  ["miel-500g", 1], ["olives-500g", 2], ["jus-orange-1l", 8], ["soda-1l", 6], ["eau-minerale-5l", 6], ["lessive-poudre-3kg", 2], ["liquide-vaisselle-1l", 2],
  ["eau-de-javel-1l", 1], ["nettoyant-sol-1l", 2], ["savon-liquide-250ml", 3], ["savon-toilette-x4", 2], ["shampoing-400ml", 2], ["dentifrice-75ml", 3], ["papier-toilette-x12", 3],
);

/**
 * Paniers prédéfinis. COMPOSITION ET QUANTITÉS = HYPOTHÈSES DE DÉPART pour un ménage de 4 personnes, PAS des statistiques officielles.
 * Repères publics utilisés pour le cadrage seulement : l'alimentation pèse environ 38 % du budget des ménages (HCP, enquête 2022),
 * environ 50 % pour les ménages les plus modestes et environ 30 % pour les plus aisés.
 */
const PRESETS_PRODUITS: (Omit<PresetDef, "lignes"> & { lignes: PresetLine[] })[] = [
  {
    slug: "essentiel", profil: "essentiel", menage: 4, lignes: essentiel,
    nom: { fr: "Essentiel", ar: "الأساسيات", en: "Essentials" },
    description: { fr: "Les produits de base d'un mois pour une famille de 4 personnes.", ar: "المنتوجات الأساسية ديال شهر لعائلة من 4 أشخاص.", en: "A month of basics for a household of 4." },
  },
  {
    slug: "mensuel-budget-serre", profil: "budget_serre", menage: 4, lignes: budget,
    nom: { fr: "Mensuel — Budget serré", ar: "شهري — ميزانية ضيقة", en: "Monthly — Tight budget" },
    description: { fr: "Féculents, légumineuses et légumes en priorité, peu de viande et de laitages.", ar: "الحبوب والقطاني والخضر أولا، شوية ديال اللحم والحليب.", en: "Staples, pulses and vegetables first, little meat and dairy." },
  },
  {
    slug: "mensuel-classe-moyenne", profil: "classe_moyenne", menage: 4, lignes: moyenne,
    nom: { fr: "Mensuel — Classe moyenne", ar: "شهري — الطبقة الوسطى", en: "Monthly — Middle class" },
    description: { fr: "Plus de variété : viandes, laitages, fruits, boissons et entretien.", ar: "تنوع أكثر: اللحوم، الحليب ومشتقاته، الفواكه، المشروبات والتنظيف.", en: "More variety: meat, dairy, fruit, drinks and cleaning." },
  },
  {
    slug: "mensuel-confort", profil: "confort", menage: 4, lignes: confort,
    nom: { fr: "Mensuel — Confort", ar: "شهري — مريح", en: "Monthly — Comfort" },
    description: { fr: "Davantage de viandes, de produits frais et de produits d'hygiène.", ar: "كثر من اللحوم، المنتوجات الطرية ومنتوجات النظافة.", en: "More meat, fresh produce and personal-care products." },
  },
];

/** Paniers prédéfinis tels que servis : lignes de base converties en lignes famille. */
export const PRESETS: PresetDef[] = PRESETS_PRODUITS.map((p) => ({ ...p, lignes: lignesAvecFamilles(p.lignes) }));

/** Ajoute les produits du catalogue absents (clé : slug). Idempotent. Ne crée aucun prix. */
export async function seedCatalogue(db: Db) {
  const existing = new Set((await db.select({ slug: products.slug }).from(products)).map((p) => p.slug));
  let added = 0;
  for (const item of CATALOGUE) {
    if (existing.has(item.slug)) continue;
    const [p] = await db
      .insert(products)
      .values({
        slug: item.slug, nomNormalise: item.nom.toLowerCase(), nomAffiche: item.nom, formatValeur: String(item.valeur),
        formatUnite: item.unite, categorie: item.categorie, famille: FAMILLE_DE_PRODUIT[item.slug] ?? null,
      })
      .returning();
    await db.insert(productAliases).values(item.alias.map(([texte, langue]) => ({ productId: p.id, texte, formeNormalisee: texte.toLowerCase(), langue })));
    added++;
  }
  return added;
}

export async function seedPresets(db: Db) {
  for (const p of PRESETS) {
    const [row] = await db.select({ slug: presetBaskets.slug }).from(presetBaskets).where(eq(presetBaskets.slug, p.slug));
    if (row) {
      await db.update(presetBaskets).set({ profil: p.profil, nom: p.nom, description: p.description, menage: p.menage, lignes: p.lignes }).where(eq(presetBaskets.slug, p.slug));
      continue;
    }
    await db.insert(presetBaskets).values({ slug: p.slug, profil: p.profil, nom: p.nom, description: p.description, menage: p.menage, lignes: p.lignes });
  }
}
