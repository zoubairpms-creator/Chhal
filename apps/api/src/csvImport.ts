export type ImportCell = { colonne: string; brut: string };
export type ImportRow = { ligne: number; slug: string; ville: string; date: string; cellules: ImportCell[] };
export type ImportError = { ligne: number; colonne?: string; message: string };

const FIXED = new Set(["slug", "produit", "ville", "date_releve"]);
export const MAX_ROWS = 500;

/** Lit un CSV de relevés (séparateur « ; », ou « , » à défaut), avec ou sans BOM. Ne valide que la forme, pas le contenu métier. */
export function parseReleves(csv: string): { colonnes: string[]; rows: ImportRow[]; erreurs: ImportError[] } {
  const erreurs: ImportError[] = [];
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).map((l, i) => ({ n: i + 1, text: l })).filter((l) => l.text.trim() !== "");
  if (lines.length === 0) return { colonnes: [], rows: [], erreurs: [{ ligne: 1, message: "Fichier vide." }] };
  const sep = lines[0].text.includes(";") ? ";" : ",";
  const split = (t: string) => t.split(sep).map((c) => c.trim().replace(/^"|"$/g, "").trim());
  const header = split(lines[0].text).map((h) => h.toLowerCase());
  for (const need of ["slug", "ville", "date_releve"]) {
    if (!header.includes(need)) erreurs.push({ ligne: lines[0].n, colonne: need, message: `Colonne obligatoire absente : ${need}.` });
  }
  const colonnes = split(lines[0].text).filter((h) => !FIXED.has(h.toLowerCase()) && h !== "");
  if (colonnes.length === 0) erreurs.push({ ligne: lines[0].n, message: "Aucune colonne d'enseigne." });
  if (lines.length - 1 > MAX_ROWS) erreurs.push({ ligne: 1, message: `Trop de lignes (${lines.length - 1} > ${MAX_ROWS}).` });
  if (erreurs.length) return { colonnes, rows: [], erreurs };

  const rawHeader = split(lines[0].text);
  const idx = (name: string) => header.indexOf(name);
  const rows: ImportRow[] = lines.slice(1).map((l) => {
    const cells = split(l.text);
    return {
      ligne: l.n,
      slug: cells[idx("slug")] ?? "",
      ville: cells[idx("ville")] ?? "",
      date: cells[idx("date_releve")] ?? "",
      cellules: colonnes.map((c) => ({ colonne: c, brut: cells[rawHeader.indexOf(c)] ?? "" })),
    };
  });
  return { colonnes, rows, erreurs };
}

/** « 79.95 » ou « 79,95 » → 79.95 ; null si vide ; lève une erreur lisible sinon (2 décimales max, strictement positif). */
export function parsePrix(brut: string): number | null {
  const s = brut.replace(/\s/g, "");
  if (s === "") return null;
  const norm = /^\d+,\d{1,2}$/.test(s) ? s.replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) throw new Error(`Prix invalide « ${brut} » (format 79.95, 2 décimales maximum, jamais 0).`);
  const v = Number(norm);
  if (!(v > 0)) throw new Error("Le prix doit être strictement positif ; laissez la cellule vide si le prix est inconnu.");
  if (v > 100000) throw new Error("Prix trop élevé.");
  return v;
}

/** Date AAAA-MM-JJ valide du calendrier, pas dans le futur. */
export function checkDate(date: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return `Date invalide « ${date} » (format 2026-10-17).`;
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return `Date inexistante « ${date} ».`;
  if (date > today) return "La date du relevé ne peut pas être dans le futur.";
  return null;
}
