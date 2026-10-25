import { toBase, type Unite } from "@chhal/matching";

/** Classe de format d'une famille et unité dans laquelle on exprime une quantité de cette famille. */
export type Classe = "masse" | "volume" | "piece";
export const UNITE_DE_CLASSE: Record<Classe, "kg" | "l" | "piece"> = { masse: "kg", volume: "l", piece: "piece" };

export type VariantOffer = {
  produitId: number;
  nom: string;
  marque: string | null;
  valeur: number;
  unite: Unite;
  storeId: number;
  prixMad: number;
  dateReleve: string;
  source: string;
};

export type FamilyChoice = {
  storeId: number;
  produitId: number;
  nom: string;
  marque: string | null;
  format: string;
  nbPaquets: number;
  /** Quantité réellement achetée, dans l'unité de la ligne (kg, L ou pièces). */
  quantiteAchetee: number;
  /** Quantité achetée en trop, même unité. */
  surplus: number;
  prixPaquetMad: number;
  totalMad: number;
  dateReleve: string;
  source: string;
};

const cents = (x: number) => Math.round(x * 100);
const round3 = (x: number) => Math.round(x * 1000) / 1000;
const daysBetween = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Ligne « n'importe quelle marque » : pour CHAQUE magasin, retient la variante la moins chère pour la quantité demandée.
 *  - on achète des paquets entiers : paquets = ⌈ quantité ÷ taille du format ⌉, coût = paquets × prix du paquet ;
 *  - une seule variante par magasin et par ligne (pas de mélange de formats) ;
 *  - égalité de coût : surplus le plus faible, puis identifiant de produit le plus petit (déterminisme) ;
 *  - prix plus anciens que `maxAgeDays` ignorés ; offres d'une autre classe de format ignorées.
 * `quantiteBase` : en kg (masse), litres (volume) ou pièces.
 */
export function resolveFamilyLine(input: {
  classe: Classe;
  quantiteBase: number;
  offers: VariantOffer[];
  referenceDate: string;
  maxAgeDays: number;
}): { choices: Map<number, FamilyChoice>; hasAnyOffer: boolean } {
  const { classe, quantiteBase, offers, referenceDate, maxAgeDays } = input;
  const diviseur = classe === "piece" ? 1 : 1000; // kg → g, L → ml
  const besoin = quantiteBase * diviseur;
  const choices = new Map<number, FamilyChoice>();
  const best = new Map<number, { costC: number; surplus: number; offer: VariantOffer; packs: number; taille: number }>();
  let hasAnyOffer = false;

  for (const o of offers) {
    const b = toBase(o.valeur, o.unite);
    if (b.famille !== classe || b.quantite <= 0) continue; // jamais de comparaison entre classes de format
    hasAnyOffer = true;
    if (o.dateReleve > referenceDate || daysBetween(o.dateReleve, referenceDate) > maxAgeDays) continue;
    const packs = Math.max(1, Math.ceil(besoin / b.quantite - 1e-9));
    const costC = packs * cents(o.prixMad);
    const surplus = packs * b.quantite - besoin;
    const cur = best.get(o.storeId);
    if (!cur || costC < cur.costC || (costC === cur.costC && (surplus < cur.surplus - 1e-9 || (Math.abs(surplus - cur.surplus) <= 1e-9 && o.produitId < cur.offer.produitId)))) {
      best.set(o.storeId, { costC, surplus, offer: o, packs, taille: b.quantite });
    }
  }

  for (const [storeId, c] of best) {
    choices.set(storeId, {
      storeId,
      produitId: c.offer.produitId,
      nom: c.offer.nom,
      marque: c.offer.marque,
      format: `${c.offer.valeur} ${c.offer.unite}`,
      nbPaquets: c.packs,
      quantiteAchetee: round3((c.packs * c.taille) / diviseur),
      surplus: round3(c.surplus / diviseur),
      prixPaquetMad: c.offer.prixMad,
      totalMad: c.costC / 100,
      dateReleve: c.offer.dateReleve,
      source: c.offer.source,
    });
  }
  return { choices, hasAnyOffer };
}
