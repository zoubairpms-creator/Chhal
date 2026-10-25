/**
 * PROPOSITION MANUELLE — NON VÉRIFIÉE.
 * Produits de base absents d'Open Food Facts : marques et formats issus de la CONNAISSANCE GÉNÉRALE de Claude, pas d'une source.
 * Aucun code-barres, aucune photo. Rien n'est importé tant que vous n'avez pas vérifié chaque ligne EN MAGASIN
 * (colonnes « verifie_le » et « enseignes_vues » à remplir, « valider » à passer à « oui »).
 *
 * Confiance (colonnes confiance_marque / confiance_format) : mon degré de certitude que la marque, puis le format, existent au Maroc.
 *  haute = très répandu ; moyenne = plausible, à confirmer ; basse = incertain, probablement à corriger.
 * Les marques entre parenthèses « (à préciser …) » sont des emplacements à compléter : elles sont refusées à l'import tant qu'elles restent ainsi.
 */
export type Confiance = "haute" | "moyenne" | "basse";
export type LigneManuelle = {
  famille: string;
  categorie: "epicerie" | "frais" | "cremerie" | "boissons" | "charcuterie" | "menage" | "hygiene";
  nom: string;
  marque: string;
  valeur: number;
  unite: "g" | "kg" | "ml" | "cl" | "l" | "piece";
  confianceMarque: Confiance;
  confianceFormat: Confiance;
  indice: string;
  remarque?: string;
};

const MEM = "connaissance générale de Claude (aucune source)";
const A_PRECISER = "(à préciser : marque lue en magasin)";
const DISTRIB = "(à préciser : marque distributeur)";

const L = (
  famille: string, categorie: LigneManuelle["categorie"], nom: string, marque: string, valeur: number, unite: LigneManuelle["unite"],
  cm: Confiance, cf: Confiance, indice = MEM, remarque?: string,
): LigneManuelle => ({ famille, categorie, nom, marque, valeur, unite, confianceMarque: cm, confianceFormat: cf, indice, remarque });

export const LIGNES_MANUELLES: LigneManuelle[] = [
  // Sucre
  L("sucre", "epicerie", "Sucre en morceaux", "Cosumar", 1, "kg", "haute", "haute", MEM, "Un produit « Sucre en morceaux 1 kg » SANS marque existe déjà dans le catalogue : rapprochez-le plutôt qu'en créer un second."),
  L("sucre", "epicerie", "Sucre cristallisé", "Cosumar", 1, "kg", "haute", "moyenne"),
  L("sucre", "epicerie", "Sucre cristallisé", "Cosumar", 5, "kg", "haute", "basse"),
  // Riz
  L("riz", "epicerie", "Riz long grain", "Dari", 1, "kg", "moyenne", "moyenne", "Dari est confirmée par Open Food Facts pour le couscous et les pâtes, pas pour le riz"),
  L("riz", "epicerie", "Riz long grain étuvé", "Uncle Ben's", 1, "kg", "moyenne", "moyenne"),
  L("riz", "epicerie", "Riz basmati", "Tilda", 1, "kg", "moyenne", "moyenne"),
  L("riz", "epicerie", "Riz long grain", DISTRIB, 1, "kg", "basse", "moyenne"),
  // Farine
  L("farine", "epicerie", "Farine de blé tendre", A_PRECISER, 1, "kg", "basse", "moyenne", MEM, "Aucune marque de farine retenue avec une confiance suffisante : à compléter en magasin."),
  L("farine", "epicerie", "Farine de blé tendre", A_PRECISER, 5, "kg", "basse", "moyenne"),
  L("farine", "epicerie", "Farine de blé tendre", A_PRECISER, 10, "kg", "basse", "moyenne"),
  // Huile de table
  L("huile-de-table", "epicerie", "Huile de table", "Lesieur", 1, "l", "haute", "haute", MEM, "Préciser le type (tournesol, soja, maïs) lu sur l'étiquette."),
  L("huile-de-table", "epicerie", "Huile de table", "Lesieur", 2, "l", "haute", "moyenne"),
  L("huile-de-table", "epicerie", "Huile de table", "Lesieur", 5, "l", "haute", "moyenne"),
  L("huile-de-table", "epicerie", "Huile de table", "Fleurial", 1, "l", "moyenne", "moyenne"),
  L("huile-de-table", "epicerie", "Huile de table", "Fleurial", 5, "l", "moyenne", "basse"),
  L("huile-de-table", "epicerie", "Huile de table", "Afia", 1, "l", "moyenne", "moyenne"),
  L("huile-de-table", "epicerie", "Huile de table", "Afia", 5, "l", "moyenne", "basse"),
  L("huile-de-table", "epicerie", "Huile de table", "Huilor", 1, "l", "basse", "basse"),
  // Huile d'olive
  L("huile-d-olive", "epicerie", "Huile d'olive vierge extra", "Lesieur", 50, "cl", "moyenne", "moyenne"),
  L("huile-d-olive", "epicerie", "Huile d'olive vierge extra", "Lesieur", 1, "l", "moyenne", "moyenne"),
  L("huile-d-olive", "epicerie", "Huile d'olive", "Zaëria", 75, "cl", "moyenne", "moyenne", "Open Food Facts a une fiche « huile d'olive Zaëria 75 cl », trop incomplète pour être importée"),
  // Légumineuses
  L("lentilles", "epicerie", "Lentilles", A_PRECISER, 500, "g", "basse", "moyenne"),
  L("lentilles", "epicerie", "Lentilles", A_PRECISER, 1, "kg", "basse", "moyenne"),
  L("pois-chiches", "epicerie", "Pois chiches", A_PRECISER, 500, "g", "basse", "moyenne"),
  L("pois-chiches", "epicerie", "Pois chiches", A_PRECISER, 1, "kg", "basse", "moyenne"),
  L("haricots", "epicerie", "Haricots blancs", A_PRECISER, 500, "g", "basse", "moyenne"),
  L("haricots", "epicerie", "Haricots blancs", A_PRECISER, 1, "kg", "basse", "moyenne"),
  // Thé, beurre, confiture, vermicelles
  L("the", "epicerie", "Thé noir Yellow Label (25 sachets)", "Lipton", 50, "g", "haute", "moyenne", MEM, "25 sachets ≈ 50 g : poids à lire sur la boîte (la famille « thé » se compare en grammes)."),
  L("the", "epicerie", "Thé noir Yellow Label (100 sachets)", "Lipton", 200, "g", "haute", "basse", MEM, "100 sachets ≈ 200 g : poids à lire sur la boîte."),
  L("the", "epicerie", "Thé vert", "Sultan", 200, "g", "basse", "basse", MEM, "Cette marque figure aussi dans NOS DONNÉES DE DÉMONSTRATION FICTIVES : ne pas la tenir pour confirmée."),
  L("the", "epicerie", "Thé vert (gunpowder)", A_PRECISER, 200, "g", "basse", "moyenne"),
  L("beurre", "cremerie", "Beurre doux", "Président", 250, "g", "moyenne", "moyenne"),
  L("beurre", "cremerie", "Beurre", "Jibal", 250, "g", "basse", "basse"),
  L("beurre", "cremerie", "Beurre", "Centrale", 250, "g", "moyenne", "basse", "Beurre Centrale 1 kg : relevé fourni par vous (déjà au catalogue) ; le format 250 g est à confirmer"),
  L("confiture", "epicerie", "Confiture", "Aïcha", 370, "g", "moyenne", "moyenne", "Aïcha est confirmée par Open Food Facts pour le concentré de tomate, pas pour la confiture"),
  L("vermicelles", "epicerie", "Vermicelles", "Dari", 500, "g", "moyenne", "moyenne", "Dari est confirmée par Open Food Facts pour le couscous et les pâtes"),
  // Entretien et hygiène (hors périmètre d'Open Food Facts)
  L("lessive", "menage", "Lessive en poudre", "Ariel", 3, "kg", "haute", "moyenne", MEM, "Un produit « Lessive en poudre 3 kg » SANS marque existe déjà : à rapprocher."),
  L("lessive", "menage", "Lessive en poudre", "Tide", 3, "kg", "haute", "moyenne"),
  L("lessive", "menage", "Lessive en poudre", "Omo", 3, "kg", "haute", "moyenne"),
  L("liquide-vaisselle", "menage", "Liquide vaisselle", "Fairy", 1, "l", "moyenne", "basse"),
  L("eau-de-javel", "menage", "Eau de Javel", "La Croix", 1, "l", "moyenne", "moyenne"),
  L("savon", "hygiene", "Savon de toilette", "Dove", 100, "g", "haute", "moyenne"),
  L("savon", "hygiene", "Savon de toilette", "Lux", 85, "g", "haute", "basse"),
  L("savon", "hygiene", "Savon de toilette", "Palmolive", 100, "g", "haute", "basse"),
  L("dentifrice", "hygiene", "Dentifrice", "Colgate", 75, "ml", "haute", "haute"),
  L("dentifrice", "hygiene", "Dentifrice", "Signal", 75, "ml", "haute", "moyenne"),
  L("dentifrice", "hygiene", "Dentifrice sensibilité", "Sensodyne", 75, "ml", "moyenne", "moyenne"),
  L("shampoing", "hygiene", "Shampoing antipelliculaire", "Head & Shoulders", 400, "ml", "haute", "moyenne"),
  L("shampoing", "hygiene", "Shampoing", "Dove", 400, "ml", "haute", "moyenne"),
  L("papier-toilette", "hygiene", "Papier toilette (rouleaux)", "Lotus", 12, "piece", "moyenne", "basse", MEM, "Format = nombre de rouleaux."),
];

const cell = (s: string | number) => {
  const t = String(s);
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/**
 * CSV de vérification en magasin. `valider`, `verifie_le` et `enseignes_vues` sont VIDES : c'est à vous de les remplir.
 * Seules les lignes « valider = oui » ET « verifie_le » renseignée (AAAA-MM-JJ) pourront être importées.
 */
export function toCsvManuel(lignes: LigneManuelle[] = LIGNES_MANUELLES): string {
  const head = ["valider", "verifie_le", "enseignes_vues", "statut", "famille", "categorie", "nom", "marque", "format_valeur", "format_unite", "confiance_marque", "confiance_format", "indice", "remarque"];
  const rows = lignes.map((l) => ["", "", "", "NON_VERIFIE", l.famille, l.categorie, l.nom, l.marque, l.valeur, l.unite, l.confianceMarque, l.confianceFormat, l.indice, l.remarque ?? ""].map(cell).join(";"));
  return "﻿" + [head.join(";"), ...rows].join("\n") + "\n";
}
