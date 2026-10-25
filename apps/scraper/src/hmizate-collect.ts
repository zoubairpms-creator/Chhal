import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import robotsModule from "robots-parser";
import { BlockedError, RateLimiter } from "./politeness.js";
import { parseArticle, type ArticleResult } from "./hmizate-article.js";

type RobotsFn = (url: string, txt: string) => { isAllowed(url: string, ua?: string): boolean | undefined };
const robotsParser = robotsModule as unknown as RobotsFn;

export const HMIZATE_ORIGIN = "https://hmizate.ma";
export const BOT_TOKEN = "ChhalBot";
/** Statuts qui signifient « stop » : arrêt immédiat, aucun contournement. */
const STOP_STATUS = new Set([403, 429, 503]);
const ANTI_BOT = /cf-challenge|just a moment|captcha|access denied|verify you are human/i;

export type HttpFetcher = (url: string, init: { headers: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>;

export type CollectOptions = {
  fetcher: HttpFetcher;
  /** Contact publié dans le User-Agent (SCRAPER_CONTACT) : obligatoire. */
  contact: string;
  /** Page de liste des catalogues (une seule page lue, jamais d'exploration). */
  listUrl: string;
  /** Slugs d'enseignes à lire (périmètre). */
  enseignes?: string[];
  maxArticles?: number;
  /** Plafond TOTAL de requêtes (robots.txt + liste + articles). */
  maxRequests?: number;
  estimerFin?: boolean;
  now?: () => Date;
  limiter?: RateLimiter;
};

export type ArticleCollecte = {
  url: string;
  html: string;
  hash: string;
  fetchedAt: string;
  resultat: ArticleResult;
};
export type Collecte = {
  userAgent: string;
  requetes: number;
  robots: { hash: string; autorise: boolean } | null;
  candidats: string[];
  articles: ArticleCollecte[];
  arret: string | null;
};

export function userAgent(contact: string) {
  return `${BOT_TOKEN}/1.0 (comparateur de prix; contact: ${contact})`;
}

/** Liens d'articles « catalogue-<enseigne>-… -n<id> » de la page de liste, même origine uniquement, du plus récent au plus ancien. */
export function extraireCandidats(listHtml: string, enseignes: string[]): string[] {
  const $ = cheerio.load(listHtml);
  const vus = new Set<string>();
  for (const a of $("a[href]").toArray()) {
    let u: URL;
    try { u = new URL($(a).attr("href")!, HMIZATE_ORIGIN); } catch { continue; }
    if (u.origin !== HMIZATE_ORIGIN) continue;
    const m = u.pathname.match(/^\/deal\/catalogue-([a-z0-9-]+?)-(\d{1,2}-[a-z]+-\d{4})-n(\d+)$/);
    if (!m) continue;
    if (!enseignes.some((e) => m[1] === e || m[1].startsWith(`${e}-`))) continue;
    vus.add(`${HMIZATE_ORIGIN}${u.pathname}`);
  }
  const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  const cle = (p: string) => {
    const m = p.match(/(\d{1,2})-([a-z]+)-(\d{4})/);
    return m ? `${m[3]}-${String(MOIS.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  };
  return [...vus].sort((x, y) => cle(y).localeCompare(cle(x)));
}

/**
 * Collecte polie : robots.txt relu à chaque exécution, une requête toutes les ≥ 2 s, plafond de requêtes, arrêt sur 403/429/503
 * ou page anti-robot. Ne touche à aucune base : renvoie les pages brutes et leur lecture.
 */
export async function collecter(o: CollectOptions): Promise<Collecte> {
  if (new URL(o.listUrl).origin !== HMIZATE_ORIGIN || new URL(o.listUrl).username || new URL(o.listUrl).password) throw new Error("La liste doit appartenir à hmizate.ma en HTTPS.");
  const contact = o.contact?.trim();
  if (!contact || contact.length < 5 || /non configur/i.test(contact)) throw new Error("SCRAPER_CONTACT obligatoire : le robot refuse de tourner sans contact.");
  const ua = userAgent(contact);
  const now = o.now ?? (() => new Date());
  const limiter = o.limiter ?? new RateLimiter();
  const maxRequests = o.maxRequests ?? 3;
  const out: Collecte = { userAgent: ua, requetes: 0, robots: null, candidats: [], articles: [], arret: null };

  const get = async (url: string) => {
    if (out.requetes >= maxRequests) throw new Error(`Plafond de ${maxRequests} requêtes atteint.`);
    await limiter.wait();
    out.requetes++;
    const res = await o.fetcher(url, { headers: { "user-agent": ua } });
    if (STOP_STATUS.has(res.status)) throw new BlockedError(url, res.status);
    const text = await res.text();
    return { status: res.status, text };
  };

  try {
    const robotsUrl = `${HMIZATE_ORIGIN}/robots.txt`;
    const rb = await get(robotsUrl);
    if (rb.status !== 200) { out.arret = `robots.txt inaccessible (HTTP ${rb.status}) : abstention.`; return out; }
    const robots = robotsParser(robotsUrl, rb.text);
    const autorise = (u: string) => robots.isAllowed(u, BOT_TOKEN) !== false;
    out.robots = { hash: createHash("sha256").update(rb.text).digest("hex"), autorise: autorise(o.listUrl) };
    if (!out.robots.autorise) { out.arret = "robots.txt interdit la page de liste."; return out; }

    const list = await get(o.listUrl);
    if (list.status !== 200 || ANTI_BOT.test(list.text)) { out.arret = `Page de liste inutilisable (HTTP ${list.status} ou contrôle anti-robot).`; return out; }
    out.candidats = extraireCandidats(list.text, o.enseignes ?? ["bim"]);

    const nb = Math.min(o.maxArticles ?? 2, Math.max(0, maxRequests - out.requetes));
    for (const url of out.candidats.slice(0, nb)) {
      if (!autorise(url)) { out.arret = `robots.txt interdit ${url}.`; break; }
      const r = await get(url);
      if (r.status !== 200 || ANTI_BOT.test(r.text)) { out.arret = `Article inutilisable (HTTP ${r.status} ou contrôle anti-robot) : ${url}`; break; }
      out.articles.push({
        url, html: r.text, hash: createHash("sha256").update(r.text).digest("hex"), fetchedAt: now().toISOString(),
        resultat: parseArticle(r.text, url, { estimerFin: o.estimerFin ?? true }),
      });
    }
  } catch (e) {
    out.arret = e instanceof BlockedError ? `BLOQUÉ : ${e.message}` : `Erreur : ${(e as Error).message}`;
  }
  return out;
}

export type Poster = (path: string, body: unknown) => Promise<{ status: number; json: any }>;

/**
 * Envoi à l'API. Essai à blanc (par défaut) : seul l'essai à blanc de l'ingestion est appelé, rien n'est écrit.
 * Réel : donnée brute d'abord, puis relevés (sans les promotions conditionnelles) avec traçabilité.
 */
export async function envoyer(c: Collecte, post: Poster, o: { confirm: boolean; ville: string; sourceSlug?: string; parserVersion?: string }) {
  const sourceSlug = o.sourceSlug ?? "hmizate";
  const rapport: { url: string; statut: string; detail?: unknown }[] = [];
  for (const a of c.articles) {
    const r = a.resultat;
    if (!r.ok) { rapport.push({ url: a.url, statut: `rejeté : ${r.raison}` }); continue; }
    let rawDataId: number | undefined;
    if (o.confirm) {
      const brut = await post("/admin/sources/brut", { sourceSlug, url: a.url, html: a.html, httpStatus: 200, fetchedAt: a.fetchedAt, parserVersion: r.parseur });
      if (brut.status !== 201) { rapport.push({ url: a.url, statut: `donnée brute refusée (${brut.status})`, detail: brut.json }); continue; }
      rawDataId = brut.json.rawDataId;
    }
    const retenues = r.lignes.filter((l) => !l.conditionnelle);
    const releves = retenues.map(({ conditionnelle: _c, ...l }) => ({ ...l, enseigne: r.enseigne, ville: o.ville, dateReleve: r.validite.validFrom, source: "catalogue" as const }));
    const res = await post("/admin/scraping/releves", {
      releves, essaiABlanc: !o.confirm,
      tracabilite: {
        sourceSlug, sourceUrl: a.url, observedAt: a.fetchedAt, validFrom: r.validite.validFrom, validUntil: r.validite.validUntil,
        validityStatus: r.validite.status, rawDataId, motif: r.validite.motif.slice(0, 300),
      },
    });
    rapport.push({ url: a.url, statut: res.status === 200 ? (o.confirm ? "ingéré" : "essai à blanc") : `refusé (${res.status})`, detail: { ...res.json, conditionnellesExclues: r.lignes.length - retenues.length, rejetsLecture: r.rejets.length } });
  }
  return rapport;
}
