export type OcrSuggestion = { prixMad: number | null; candidats: number[]; confiance: "basse" | "moyenne" };

/** Extrait un prix en MAD d'un texte OCR (« 79,95 DH », « 79.95 MAD », « 79 95 »). Renvoie plusieurs candidats si ambigu. */
export function parseOcrPrice(texte: string): OcrSuggestion {
  const cleaned = texte.replace(/\s+/g, " ");
  const found = new Set<number>();
  const re = /(\d{1,4})\s?[.,]\s?(\d{2})\b|(\d{1,4})\s?(?:dh|dhs|mad)\b/gi;
  for (const m of cleaned.matchAll(re)) {
    const value = m[1] ? Number(`${m[1]}.${m[2]}`) : Number(m[3]);
    if (value > 0 && value < 100000) found.add(value);
  }
  const candidats = [...found];
  return { prixMad: candidats.length === 1 ? candidats[0] : null, candidats, confiance: candidats.length === 1 ? "moyenne" : "basse" };
}
