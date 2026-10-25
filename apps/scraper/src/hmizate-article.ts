import * as cheerio from "cheerio";
import { parsePrice } from "./adapters/modele.js";
import { parseSizeHmizate } from "./adapters/hmizate.js";
import type { Releve } from "./adapters/types.js";

/** Version du parseur, enregistrée avec chaque donnée brute. */
export const PARSEUR_VERSION = "hmizate-article-2.0.0";

const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MOIS_RE = "(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)";

function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Lit une date française (« mardi 1er septembre 2026 »). null = pas de date ; { erreur } = date impossible ou jour de semaine incohérent. */
export function parseDateFr(text: string): { iso: string } | { erreur: string } | null {
  const m = sansAccent(text).match(new RegExp(`(?:(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\s+)?(\\d{1,2})(?:er)?\\s+${MOIS_RE.replace(/[éû]/g, ".")}\\s+(\\d{4})`));
  if (!m) return null;
  const d = iso(Number(m[4]), MOIS.indexOf(m[3]) + 1, Number(m[2]));
  if (!d) return { erreur: `Date impossible : « ${m[0]} ».` };
  if (m[1] && JOURS[new Date(`${d}T00:00:00Z`).getUTCDay()] !== m[1]) return { erreur: `Jour de semaine incohérent : « ${m[0]} ».` };
  return { iso: d };
}

export type Validite = { validFrom: string; validUntil: string | null; status: "connue" | "estimee" | "inconnue"; motif: string };

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function dateDuSlug(url: string): { iso: string } | { erreur: string } | null {
  const m = sansAccent(url).match(new RegExp(`(\\d{1,2})-${MOIS_RE.replace(/[éû]/g, ".")}-(\\d{4})`));
  return m ? parseDateFr(`${m[1]} ${m[2]} ${m[3]}`) : null;
}

/**
 * Début : texte, titre et adresse doivent concorder (au moins un des deux premiers). Fin : seulement si l'article la dit.
 * Jamais la date du jour. `estimerFin` : « semaine de promotions » sans fin → début + 7 jours, statut « estimee ».
 */
export function extraireValidite(a: { texte: string; titre: string; url: string; estimerFin?: boolean }): Validite | { erreur: string } {
  const flat = a.texte.replace(/\s+/g, " ");
  const fromTexte = (() => {
    const m = flat.match(/[àa] partir du\s+([^.,;]{3,40}?\d{4})/i);
    return m ? parseDateFr(m[1]) : null;
  })();
  const plage = flat.match(new RegExp(`du\\s+(\\d{1,2})(?:er)?(?:\\s+${MOIS_RE})?(?:\\s+(\\d{4}))?\\s+au\\s+(?:\\w+\\s+)?(\\d{1,2})(?:er)?\\s+${MOIS_RE}\\s+(\\d{4})`, "i"));
  let debutPlage: { iso: string } | { erreur: string } | null = null;
  let finPlage: { iso: string } | { erreur: string } | null = null;
  if (plage) {
    const mFin = plage[5], aFin = plage[6];
    debutPlage = parseDateFr(`${plage[1]} ${plage[2] ?? mFin} ${plage[3] ?? aFin}`);
    finPlage = parseDateFr(`${plage[4]} ${mFin} ${aFin}`);
  }
  const jusqu = flat.match(/jusqu['’]au\s+([^.,;]{3,40}?\d{4})/i);
  const finJusqu = jusqu ? parseDateFr(jusqu[1]) : null;

  const candidats: { src: string; v: { iso: string } | { erreur: string } | null }[] = [
    { src: "texte", v: fromTexte ?? debutPlage },
    { src: "titre", v: parseDateFr(a.titre) },
    { src: "adresse", v: dateDuSlug(a.url) },
  ];
  for (const c of candidats) if (c.v && "erreur" in c.v) return { erreur: `${c.src} : ${c.v.erreur}` };
  const trouves = candidats.filter((c) => c.v && "iso" in c.v) as { src: string; v: { iso: string } }[];
  if (!trouves.some((c) => c.src !== "adresse")) return { erreur: "Aucune date de début lisible dans le texte ni le titre." };
  const distinct = new Set(trouves.map((c) => c.v.iso));
  if (distinct.size > 1) return { erreur: `Dates de début discordantes : ${trouves.map((c) => `${c.src}=${c.v.iso}`).join(", ")}.` };
  const validFrom = trouves[0].v.iso;

  const fin = finJusqu ?? finPlage;
  if (fin && "erreur" in fin) return { erreur: `fin : ${fin.erreur}` };
  if (fin) {
    if (fin.iso < validFrom) return { erreur: `Fin (${fin.iso}) antérieure au début (${validFrom}).` };
    return { validFrom, validUntil: fin.iso, status: "connue", motif: "Fin de validité écrite dans l'article." };
  }
  if (a.estimerFin && /semaine de promotions?/i.test(flat)) {
    return { validFrom, validUntil: addDays(validFrom, 7), status: "estimee", motif: "Fin non écrite : « semaine de promotions » → début + 7 jours (estimation)." };
  }
  return { validFrom, validUntil: null, status: "inconnue", motif: "Fin de validité non indiquée dans l'article." };
}

const ENSEIGNES: [RegExp, string | null][] = [
  [/carrefour/, null], // exclue : conditions d'utilisation non évaluées
  [/\bbim\b/, "bim"],
  [/kazyon/, "kazyon"],
  [/marjane/, "marjane"],
  [/a[sz]+wak/, "aswak"],
];

export type LigneArticle = Releve & { conditionnelle: boolean };
export type Rejet = { texte: string; raison: string };
export type ArticleResult =
  | { ok: true; enseigne: string; titre: string; validite: Validite; lignes: LigneArticle[]; rejets: Rejet[]; parseur: string }
  | { ok: false; raison: string };

const CONDITIONNEL = /\b\d+\s*(?:pour|achet)|\bcarte\b|\bfid[eé]lit|\blot de\b|\b[2-9](?:[eè]me|e)\b|\bgratuit|\bd[eè]s\s+\d+/i;
const PACK = /\s+\d+\s*[×x]\s*\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|cl|lt|l|pcs|piece|u)\s*$/i;
const SIMPLE = /\s+\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|cl|lt|l|pcs|piece|u)\s*$/i;

/** Lit un article hmizate.ma : uniquement le contenu de <article> (jamais menus, barres latérales, pied de page). */
export function parseArticle(html: string, url: string, opts: { estimerFin?: boolean } = {}): ArticleResult {
  const $ = cheerio.load(html);
  const art = $("article").first();
  if (art.length === 0) return { ok: false, raison: "Aucun <article> : page non reconnue (balisage changé ?)." };
  const titre = art.find("h1").first().text().trim() || $("title").first().text().trim();

  const cle = sansAccent(`${titre} ${url}`);
  const hits = ENSEIGNES.filter(([re]) => re.test(cle));
  if (hits.length !== 1) return { ok: false, raison: hits.length === 0 ? "Enseigne non reconnue dans le titre ni l'adresse." : "Enseigne ambiguë (plusieurs dans le titre/l'adresse)." };
  const enseigne = hits[0][1];
  if (!enseigne) return { ok: false, raison: "Enseigne exclue du périmètre (conditions d'utilisation non évaluées)." };

  const texte = art.find("p, li, h2").map((_, el) => $(el).text()).get().join(" ");
  const validite = extraireValidite({ texte, titre, url, estimerFin: opts.estimerFin });
  if ("erreur" in validite) return { ok: false, raison: validite.erreur };

  const lignes: LigneArticle[] = [];
  const rejets: Rejet[] = [];
  const vus = new Set<string>();
  art.find("li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t) return;
    const conditionnelle = CONDITIONNEL.test(t);
    const m = t.match(/^(.+?)\s+à\s+(\d+(?:[.,]\d{1,2})?)\s*(?:DH|Dh|DHS|dh)\b(.*)$/i);
    if (!m) { rejets.push({ texte: t, raison: "Prix non lisible (pas de « à X DH »)." }); return; }
    const prixMad = parsePrice(m[2]);
    if (prixMad === null) { rejets.push({ texte: t, raison: "Prix invalide." }); return; }
    const label = m[1].trim();
    const size = parseSizeHmizate(label);
    if (!size) { rejets.push({ texte: t, raison: "Format illisible ou absent." }); return; }
    const libelle = label.replace(PACK, "").replace(SIMPLE, "").trim() || label;
    const key = `${libelle}|${prixMad}|${size.valeur}|${size.unite}`;
    if (vus.has(key)) return;
    vus.add(key);
    lignes.push({ libelle, prixMad, valeur: size.valeur, unite: size.unite, conditionnelle: conditionnelle || CONDITIONNEL.test(m[3] ?? "") });
  });
  return { ok: true, enseigne, titre, validite, lignes, rejets, parseur: PARSEUR_VERSION };
}
