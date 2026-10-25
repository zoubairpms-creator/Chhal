import type { Unite } from "@chhal/matching";

const UNITES: Record<string, Unite> = {
  g: "g", gr: "g", kg: "kg", ml: "ml", cl: "cl", l: "l", lt: "l", litre: "l", litres: "l", pcs: "piece", pc: "piece", piece: "piece", pieces: "piece", u: "piece",
};
const UNIT_RE = "(kg|gr|g|ml|cl|litres?|lt|l|pcs|pc|pieces?|u)";

/**
 * Lit une quantité de produit : « 75cl », « 1,5 L », « 500 g », « 6 × 30 g » (pack → total).
 * Renvoie null si illisible ou absurde : un format incertain n'est jamais deviné.
 */
export function parseQuantity(text: string | null | undefined): { valeur: number; unite: Unite } | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/℮/g, "").replace(/\s+/g, " ").replace(/é/g, "e").trim();
  const pack = t.match(new RegExp(`(\\d+)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}\\b`));
  if (pack) {
    const total = Number(pack[1]) * Number(pack[2].replace(",", "."));
    return valid(total, UNITES[pack[3]]);
  }
  const simple = t.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}\\b`));
  if (simple) return valid(Number(simple[1].replace(",", ".")), UNITES[simple[2]]);
  return null;
}

function valid(valeur: number, unite: Unite | undefined) {
  if (!unite || !Number.isFinite(valeur) || valeur <= 0) return null;
  const max: Record<Unite, number> = { g: 50_000, kg: 50, ml: 50_000, cl: 5_000, l: 50, piece: 500 };
  return valeur > max[unite] ? null : { valeur: Math.round(valeur * 1000) / 1000, unite };
}

export { isValidGtin } from "@chhal/matching";
