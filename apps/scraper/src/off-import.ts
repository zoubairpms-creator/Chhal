/** Lecture du CSV de proposition après validation humaine : seules les lignes dont « valider » vaut « oui » sont importées. */
export type ImportVariante = {
  famille: string; ean?: string; nom: string; marque: string; valeur: number; unite: string; categorie: string;
  imageUrl: string | null; ficheUrl?: string;
};

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const REQUIRED = ["valider", "famille", "ean", "nom", "marque", "format_valeur", "format_unite", "categorie", "image_url", "fiche_off"];

export function parseValidatedCsv(csv: string): { variantes: ImportVariante[]; ignores: number; erreurs: { ligne: number; message: string }[] } {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const erreurs: { ligne: number; message: string }[] = [];
  if (lines.length === 0) return { variantes: [], ignores: 0, erreurs: [{ ligne: 1, message: "Fichier vide." }] };
  const head = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  for (const col of REQUIRED) if (!head.includes(col)) erreurs.push({ ligne: 1, message: `Colonne absente : ${col}.` });
  if (erreurs.length) return { variantes: [], ignores: 0, erreurs };

  const at = (cells: string[], name: string) => (cells[head.indexOf(name)] ?? "").trim();
  const variantes: ImportVariante[] = [];
  let ignores = 0;
  lines.slice(1).forEach((line, i) => {
    const n = i + 2;
    const cells = parseCsvLine(line);
    if (at(cells, "valider").toLowerCase() !== "oui") { ignores++; return; }
    const valeur = Number(at(cells, "format_valeur").replace(",", "."));
    if (!(valeur > 0)) { erreurs.push({ ligne: n, message: `Format invalide : « ${at(cells, "format_valeur")} ».` }); return; }
    variantes.push({
      famille: at(cells, "famille"), ean: at(cells, "ean"), nom: at(cells, "nom"), marque: at(cells, "marque"), valeur,
      unite: at(cells, "format_unite"), categorie: at(cells, "categorie"),
      imageUrl: at(cells, "image_url") || null, ficheUrl: at(cells, "fiche_off") || undefined,
    });
  });
  return { variantes, ignores, erreurs };
}

const REQUIRED_MANUEL = ["valider", "verifie_le", "famille", "categorie", "nom", "marque", "format_valeur", "format_unite"];

/**
 * CSV de la proposition MANUELLE (non vérifiée). Une ligne « valider = oui » n'est importable que si « verifie_le » contient la date
 * (AAAA-MM-JJ) de votre vérification en magasin et si la marque n'est plus un emplacement « (à préciser…) ».
 */
export function parseManualCsv(csv: string, today = new Date().toISOString().slice(0, 10)) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const erreurs: { ligne: number; message: string }[] = [];
  if (lines.length === 0) return { variantes: [] as ImportVariante[], ignores: 0, erreurs: [{ ligne: 1, message: "Fichier vide." }] };
  const head = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  for (const col of REQUIRED_MANUEL) if (!head.includes(col)) erreurs.push({ ligne: 1, message: `Colonne absente : ${col}.` });
  if (erreurs.length) return { variantes: [] as ImportVariante[], ignores: 0, erreurs };

  const at = (cells: string[], name: string) => (cells[head.indexOf(name)] ?? "").trim();
  const variantes: ImportVariante[] = [];
  let ignores = 0;
  lines.slice(1).forEach((line, i) => {
    const n = i + 2;
    const cells = parseCsvLine(line);
    if (at(cells, "valider").toLowerCase() !== "oui") { ignores++; return; }
    const date = at(cells, "verifie_le");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) { erreurs.push({ ligne: n, message: `« oui » sans vérification datée valide (verifie_le = « ${date} », attendu AAAA-MM-JJ, pas dans le futur).` }); return; }
    const marque = at(cells, "marque");
    if (!marque || /^\(|à préciser/i.test(marque)) { erreurs.push({ ligne: n, message: `Marque non renseignée : « ${marque} ». Indiquez la marque lue en magasin.` }); return; }
    const valeur = Number(at(cells, "format_valeur").replace(",", "."));
    if (!(valeur > 0)) { erreurs.push({ ligne: n, message: `Format invalide : « ${at(cells, "format_valeur")} ».` }); return; }
    variantes.push({ famille: at(cells, "famille"), nom: at(cells, "nom"), marque, valeur, unite: at(cells, "format_unite"), categorie: at(cells, "categorie"), imageUrl: null });
  });
  return { variantes, ignores, erreurs };
}
