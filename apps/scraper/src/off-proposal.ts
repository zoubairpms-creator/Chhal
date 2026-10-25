import type { Unite } from "@chhal/matching";
import type { Classe, FamilleOff } from "./off-families.js";
import { isValidGtin, parseQuantity } from "./quantity.js";

/** Un résultat brut de l'API Open Food Facts (champs demandés uniquement). */
export type OffHit = {
  code?: string;
  product_name?: string | Record<string, string>;
  brands?: string[] | string;
  quantity?: string;
  categories_tags?: string[];
  image_front_url?: string;
  countries_tags?: string[];
};

export type Variante = {
  ean: string;
  nom: string;
  marque: string;
  valeur: number;
  unite: Unite;
  imageUrl: string | null;
  ficheUrl: string;
  hors611: boolean;
  drapeaux: string[];
  /** « oui » = importable tel quel ; « a_revoir » = à regarder avant de passer à « oui ». Seules les lignes « oui » seront importées. */
  valider: "oui" | "a_revoir";
};
export type Rejet = { famille: string; ean?: string; nom?: string; raison: string };
export type ProposalFamily = { slug: string; nom: string; categorie: string; variantes: Variante[]; rejets: Rejet[] };
export type Proposal = {
  genereLe: string;
  source: string;
  licence: { base: string; contenus: string; photos: string; attribution: string };
  stats: { familles: number; variantes: number; oui: number; aRevoir: number; rejets: number; rejetsParRaison: Record<string, number> };
  familles: ProposalFamily[];
};

const MAX_PAR_FAMILLE = 25;
const NON_ALIMENTAIRE = /(^|-)(beauty|cosmetics?|hygiene|pet-foods?|animal-feeds?|household)(-|$)/;

const classeDe = (u: Unite): Classe => (u === "g" || u === "kg" ? "masse" : u === "ml" || u === "cl" || u === "l" ? "volume" : "piece");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function nomDe(h: OffHit): string {
  const n = h.product_name;
  const raw = typeof n === "string" ? n : n ? (n.fr ?? n.en ?? Object.values(n)[0] ?? "") : "";
  return raw.replace(/\s+/g, " ").trim();
}
function marqueDe(h: OffHit): string {
  const b = h.brands;
  const first = Array.isArray(b) ? b.find((x) => x && x.trim()) : typeof b === "string" ? b.split(",")[0] : "";
  return (first ?? "").replace(/\s+/g, " ").trim();
}

/** Les photos ne sont acceptées que si elles viennent des serveurs d'images d'Open Food Facts, en HTTPS. */
export function imageOff(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "images.openfoodfacts.org" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Filtre et classe les résultats d'UNE famille. `seen` : codes-barres déjà retenus dans d'autres familles. */
export function buildFamily(f: FamilleOff, hits: OffHit[], seen: Set<string>): ProposalFamily {
  const variantes: Variante[] = [];
  const rejets: Rejet[] = [];
  const reject = (h: OffHit, raison: string) => rejets.push({ famille: f.slug, ean: h.code, nom: nomDe(h) || undefined, raison });
  const local = new Set<string>();

  for (const h of hits) {
    const code = (h.code ?? "").trim();
    if (!code) { reject(h, "sans_code"); continue; }
    if (!isValidGtin(code)) { reject(h, "ean_invalide"); continue; }
    if (code.length !== 13) { reject(h, "ean_non_ean13"); continue; }
    if (code.startsWith("2")) { reject(h, "ean_interne_magasin"); continue; }
    if (seen.has(code) || local.has(code)) { reject(h, "doublon"); continue; }
    const nom = nomDe(h);
    if (nom.length < 4 || /^[^\p{L}\p{N}]/u.test(nom)) { reject(h, "nom_suspect"); continue; }
    const marque = marqueDe(h);
    if (!marque) { reject(h, "sans_marque"); continue; }
    if ((h.categories_tags ?? []).some((c) => NON_ALIMENTAIRE.test(c.replace(/^\w\w:/, "")))) { reject(h, "hors_alimentaire"); continue; }
    if (f.exclure && f.exclure.test(norm(`${nom} ${marque}`))) { reject(h, "hors_famille"); continue; }
    const texte = norm(`${nom} ${marque} ${(h.categories_tags ?? []).join(" ").replace(/\w\w:/g, "")}`);
    if (f.pertinent && !f.pertinent.test(texte)) { reject(h, "hors_famille"); continue; }
    let q = parseQuantity(h.quantity);
    const formatDepuisNom = !q;
    if (!q) q = parseQuantity(nom);
    if (!q) { reject(h, "sans_format"); continue; }
    if (!f.unites.includes(classeDe(q.unite))) { reject(h, "format_incoherent"); continue; }

    const imageUrl = imageOff(h.image_front_url);
    const drapeaux: string[] = [];
    if (!imageUrl) drapeaux.push("sans_image");
    if (!code.startsWith("611")) drapeaux.push("hors_611");
    if (nom.length < 8) drapeaux.push("nom_court");
    if (marque.length > 30) drapeaux.push("marque_suspecte");
    if (formatDepuisNom) drapeaux.push("format_lu_dans_le_nom");
    local.add(code);
    variantes.push({
      ean: code, nom, marque, valeur: q.valeur, unite: q.unite, imageUrl,
      ficheUrl: `https://world.openfoodfacts.org/product/${code}`,
      hors611: !code.startsWith("611"), drapeaux, valider: drapeaux.length === 0 ? "oui" : "a_revoir",
    });
  }

  // Les fiches les plus complètes d'abord (à valider = oui, puis préfixe 611), plafond par famille.
  variantes.sort((a, b) => Number(b.valider === "oui") - Number(a.valider === "oui") || Number(a.hors611) - Number(b.hors611) || a.nom.localeCompare(b.nom));
  const gardees = variantes.slice(0, MAX_PAR_FAMILLE);
  for (const v of variantes.slice(MAX_PAR_FAMILLE)) rejets.push({ famille: f.slug, ean: v.ean, nom: v.nom, raison: "au_dela_du_plafond" });
  for (const v of gardees) seen.add(v.ean);
  return { slug: f.slug, nom: f.nom, categorie: f.categorie, variantes: gardees, rejets };
}

export function buildProposal(families: { famille: FamilleOff; hits: OffHit[] }[], now = new Date()): Proposal {
  const seen = new Set<string>();
  const familles = families.map(({ famille, hits }) => buildFamily(famille, hits, seen));
  const rejetsParRaison: Record<string, number> = {};
  for (const r of familles.flatMap((f) => f.rejets)) rejetsParRaison[r.raison] = (rejetsParRaison[r.raison] ?? 0) + 1;
  const toutes = familles.flatMap((f) => f.variantes);
  return {
    genereLe: now.toISOString(),
    source: "Open Food Facts (https://world.openfoodfacts.org), produits dont le pays de vente est le Maroc",
    licence: {
      base: "Open Database License (ODbL) 1.0",
      contenus: "Database Contents License (DbCL) 1.0",
      photos: "Creative Commons Attribution-ShareAlike (CC BY-SA)",
      attribution: "Données et photos : Open Food Facts (contributeurs), CC BY-SA / ODbL. Lien vers la fiche du produit requis.",
    },
    stats: {
      familles: familles.length,
      variantes: toutes.length,
      oui: toutes.filter((v) => v.valider === "oui").length,
      aRevoir: toutes.filter((v) => v.valider === "a_revoir").length,
      rejets: Object.values(rejetsParRaison).reduce((a, b) => a + b, 0),
      rejetsParRaison,
    },
    familles,
  };
}

const csvCell = (s: string | number) => {
  const t = String(s);
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV à ouvrir dans Excel : modifiez la colonne « valider » (oui / non / a_revoir). Seules les lignes « oui » seront importées. */
export function toCsv(p: Proposal): string {
  const head = ["valider", "famille", "ean", "nom", "marque", "format_valeur", "format_unite", "categorie", "image_url", "fiche_off", "drapeaux"];
  const rows = p.familles.flatMap((f) =>
    f.variantes.map((v) => [v.valider, f.slug, v.ean, v.nom, v.marque, v.valeur, v.unite, f.categorie, v.imageUrl ?? "", v.ficheUrl, v.drapeaux.join(",")].map(csvCell).join(";")),
  );
  return "\ufeff" + [head.join(";"), ...rows].join("\n") + "\n";
}
