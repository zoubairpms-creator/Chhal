import * as cheerio from "cheerio";
import { parsePrice } from "./modele.js";
import type { Unite } from "@chhal/matching";
import type { Adapter, Releve } from "./types.js";

const UNITES: Record<string, Unite> = { g: "g", gr: "g", kg: "kg", ml: "ml", cl: "cl", l: "l", lt: "l", piece: "piece", pcs: "piece", u: "piece" };

/**
 * Parse un format de taille, y compris les packs (ex. "6 × 30 g" → 180 g).
 * Renvoie null si illisible.
 */
export function parseSizeHmizate(text: string): { valeur: number; unite: Unite } | null {
  // Pack : "6 × 30 g" ou "6x30g" ou "6 × 30g"
  const packMatch = text.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(g|gr|kg|ml|cl|lt|l|pcs|piece|u)\b/i);
  if (packMatch) {
    const count = Number(packMatch[1]);
    const val = Number(packMatch[2].replace(",", "."));
    const unit = UNITES[packMatch[3].toLowerCase()];
    if (unit && count > 0 && val > 0) {
      return { valeur: count * val, unite: unit };
    }
  }
  // Format simple : "290 ml", "1 L", "300 g", "1,5 L"
  const simpleMatch = text.toLowerCase().replace(/\s+/g, " ").match(/(\d+(?:[.,]\d+)?)\s?(kg|gr|g|ml|cl|lt|l|pcs|piece|u)\b/);
  if (simpleMatch) {
    const val = Number(simpleMatch[1].replace(",", "."));
    const unit = UNITES[simpleMatch[2]];
    if (unit && val > 0) {
      return { valeur: val, unite: unit };
    }
  }
  return null;
}

/**
 * Adaptateur pour les articles de catalogue hmizate.ma.
 *
 * hmizate.ma publie des articles de blog détaillant les promotions par enseigne
 * (ex. "Catalogue BIM 1 septembre 2026"). Chaque article contient une liste de
 * produits au format : "Nom du produit [format] à [prix] DH".
 *
 * Les données sont en texte brut (HTML), pas en images : parsing possible avec cheerio.
 *
 * ÉTAT : DÉSACTIVÉ (enabled: false) jusqu'à décision du porteur du projet.
 * hmizate.ma est un site TIERS qui republie des catalogues d'enseignes : l'usage de ce contenu
 * (droits, conditions d'utilisation, robots.txt) est une décision juridique à valider avant toute activation.
 * Les prix lus sont des PRIX PROMOTIONNELS d'une période donnée : ils sont donc datés par la date du
 * catalogue (`dateReleve` de la page), jamais par la date de lecture, et enregistrés en source « catalogue ».
 */

export type HmizateOptions = {
  /** Slug d'enseigne dans la table chains (ex. "bim"). */
  enseigne: string;
  /** URL de l'article hmizate.ma. */
  url: string;
  /** Ville cible. */
  ville: string;
  /** Date de validité du catalogue (AAAA-MM-JJ) : c'est elle qui date les relevés. */
  dateReleve: string;
};

/**
 * Parse un article hmizate.ma et extrait les relevés.
 *
 * Stratégie : on cherche les éléments de liste (<li>) et les paragraphes qui contiennent
 * le pattern "à X,XX DH" ou "à X DH". On extrait le libellé (tout avant "à") et le prix.
 * Le format est ensuite parsé depuis la fin du libellé.
 */
export function parseHmizate(html: string): Releve[] {
  const $ = cheerio.load(html);
  const out: Releve[] = [];

  // Collecter tous les textes de liste et de paragraphe
  const candidates: string[] = [];
  $("li, p").each((_, el) => {
    const text = $(el).text().trim();
    if (text) candidates.push(text);
  });

  for (const text of candidates) {
    // Pattern : "..." à "prix" DH
    // On cherche " à " suivi d'un prix et "DH" ou "Dh" ou "DHS"
    const match = text.match(/^(.+?)\s+à\s+(\d+(?:[.,]\d{1,2})?)\s*(?:DH|Dh|DHS|dh)\s*$/i);
    if (!match) continue;

    const label = match[1].trim();
    const prixMad = parsePrice(match[2]);
    if (prixMad === null) continue;

    // Essayer de parser le format depuis le libellé
    const size = parseSizeHmizate(label);
    if (!size) continue; // pas de format → on ignore (jamais de données incomplètes)

    // Le libellé sans le format = nom du produit
    // On retire le format (et le pack) de la fin du libellé
    const packRegex = /\s+\d+\s*[×x]\s*\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|cl|lt|l|pcs|piece|u)\s*$/i;
    const simpleRegex = /\s+\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|cl|lt|l|pcs|piece|u)\s*$/i;
    const libelle = label.replace(packRegex, "").replace(simpleRegex, "").trim() || label;

    out.push({
      libelle,
      prixMad,
      valeur: size.valeur,
      unite: size.unite,
    });
  }

  // Déduplication par libellé + prix
  const seen = new Set<string>();
  return out.filter((r) => {
    const key = `${r.libelle}|${r.prixMad}|${r.valeur}|${r.unite}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Crée un adaptateur hmizate pour une enseigne et un article donné.
 */
export function createHmizateAdapter(opts: HmizateOptions): Adapter {
  return {
    slug: opts.enseigne,
    enabled: false, // désactivé : décision juridique et vérification robots.txt / conditions d'utilisation requises
    source: "catalogue",
    pages: [{ ville: opts.ville, url: opts.url, dateReleve: opts.dateReleve }],
    parse: parseHmizate,
  };
}

// Export d'un adaptateur pré-configuré pour BIM (article de septembre 2026)
export const hmizateBim: Adapter = createHmizateAdapter({
  enseigne: "bim",
  url: "https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1085",
  ville: "Casablanca",
  dateReleve: "2026-09-01",
});
