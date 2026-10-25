import * as cheerio from "cheerio";
import type { Unite } from "@chhal/matching";
import type { Adapter, Releve } from "./types.js";

const UNITES: Record<string, Unite> = { g: "g", gr: "g", kg: "kg", ml: "ml", cl: "cl", l: "l", lt: "l", piece: "piece", pcs: "piece", u: "piece" };

/** « 1 kg », « 500g », « 75 cl », « 1,5 L », « 30 pcs » → { valeur, unite }. Renvoie null si illisible. */
export function parseSize(text: string): { valeur: number; unite: Unite } | null {
  const m = text.toLowerCase().replace(/\s+/g, " ").match(/(\d+(?:[.,]\d+)?)\s?(kg|gr|g|ml|cl|lt|l|pcs|piece|u)\b/);
  if (!m) return null;
  return { valeur: Number(m[1].replace(",", ".")), unite: UNITES[m[2]] };
}

/** « 79,95 DH » → 79.95. Renvoie null si illisible : un prix illisible n'est jamais stocké. */
export function parsePrice(text: string): number | null {
  const m = text.replace(/\s/g, "").match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return v > 0 ? v : null;
}

/**
 * Adaptateur MODÈLE : lit un balisage documenté (data-attributs). Il sert de gabarit et de test.
 * Un vrai adaptateur d'enseigne s'écrit en copiant ce fichier, APRÈS vérification de robots.txt et des conditions d'utilisation.
 */
export function parseModele(html: string): Releve[] {
  const $ = cheerio.load(html);
  const out: Releve[] = [];
  $(".product").each((_, el) => {
    const $el = $(el);
    const libelle = $el.find(".name").text().trim();
    const prixMad = parsePrice($el.find(".price").text());
    const size = parseSize($el.attr("data-size") ?? $el.find(".size").text());
    if (!libelle || prixMad === null || !size) return; // illisible → aucune observation
    out.push({ libelle, prixMad, ...size, ean: $el.attr("data-ean") || undefined, marque: $el.attr("data-brand") || undefined });
  });
  return out;
}

export const modele: Adapter = {
  slug: "modele",
  enabled: false,
  pages: [],
  parse: parseModele,
};
