import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/politeness.js";
import { collecter, envoyer, extraireCandidats, type HttpFetcher, type Poster } from "../src/hmizate-collect.js";

const ARTICLE = readFileSync(new URL("../fixtures/hmizate-article-fictif.html", import.meta.url), "utf8");
const LISTE = `<html><body>
<a href="/deal/catalogue-bim-1-septembre-2026-n1">BIM sept</a>
<a href="https://hmizate.ma/deal/catalogue-bim-8-septembre-2026-n2">BIM sept 8</a>
<a href="/deal/catalogue-bim-25-aout-2026-n3">BIM août</a>
<a href="/deal/catalogue-kazyon-1-septembre-2026-n4">Kazyon</a>
<a href="/deal/catalogue-carrefour-1-septembre-2026-n5">Carrefour</a>
<a href="https://autre-site.example/deal/catalogue-bim-1-septembre-2026-n9">Autre hôte</a>
</body></html>`;
const ROBOTS_OK = "User-agent: *\nAllow: /\n";
const CONTACT = "contact-test@example.org";

type Reponses = Record<string, { status: number; body: string }>;
function faux(rep: Reponses) {
  const appels: { url: string; ua: string }[] = [];
  const fetcher: HttpFetcher = async (url, init) => {
    appels.push({ url, ua: init.headers["user-agent"] });
    const r = rep[url] ?? { status: 404, body: "" };
    return { status: r.status, text: async () => r.body };
  };
  return { fetcher, appels };
}
const base = (): Reponses => ({
  "https://hmizate.ma/robots.txt": { status: 200, body: ROBOTS_OK },
  "https://hmizate.ma/deal": { status: 200, body: LISTE },
  "https://hmizate.ma/deal/catalogue-bim-8-septembre-2026-n2": { status: 200, body: ARTICLE.replaceAll("1 septembre", "8 septembre").replace("1er septembre", "8 septembre").replace("mardi", "mardi") },
  "https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1": { status: 200, body: ARTICLE },
});
const limiteurRapide = () => {
  const attentes: number[] = [];
  let t = 1_000_000;
  return { attentes, limiter: new RateLimiter(2000, () => t, async (ms) => { attentes.push(ms); t += ms; }) };
};
const opts = (f: HttpFetcher, extra: object = {}) => ({ fetcher: f, contact: CONTACT, listUrl: "https://hmizate.ma/deal", limiter: limiteurRapide().limiter, ...extra });

describe("candidats de la page de liste", () => {
  it("garde la même origine et l'enseigne demandée, du plus récent au plus ancien", () => {
    expect(extraireCandidats(LISTE, ["bim"])).toEqual([
      "https://hmizate.ma/deal/catalogue-bim-8-septembre-2026-n2",
      "https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1",
      "https://hmizate.ma/deal/catalogue-bim-25-aout-2026-n3",
    ]);
  });
});

describe("collecte polie (réseau simulé)", () => {
  it("refuse de tourner sans contact, avant toute requête", async () => {
    const { fetcher, appels } = faux(base());
    await expect(collecter({ ...opts(fetcher), contact: "" })).rejects.toThrow(/SCRAPER_CONTACT/);
    await expect(collecter({ ...opts(fetcher), contact: "non configuré" })).rejects.toThrow(/SCRAPER_CONTACT/);
    expect(appels).toHaveLength(0);
  });

  it("plafond de 3 requêtes : robots.txt, liste, UN article ; User-Agent avec le contact configuré", async () => {
    const { fetcher, appels } = faux(base());
    const c = await collecter(opts(fetcher));
    expect(appels.map((a) => a.url)).toEqual(["https://hmizate.ma/robots.txt", "https://hmizate.ma/deal", "https://hmizate.ma/deal/catalogue-bim-8-septembre-2026-n2"]);
    expect(c.requetes).toBe(3);
    expect(appels.every((a) => a.ua.includes(CONTACT) && a.ua.startsWith("ChhalBot/"))).toBe(true);
    expect(c.articles).toHaveLength(1);
    expect(c.robots?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.arret).toBeNull();
  });

  it("espace les requêtes d'au moins 2 secondes", async () => {
    const { fetcher } = faux(base());
    const l = limiteurRapide();
    await collecter(opts(fetcher, { limiter: l.limiter }));
    expect(l.attentes).toEqual([2000, 2000]);
  });

  it("lit au plus 2 articles même avec un plafond plus haut", async () => {
    const { fetcher, appels } = faux(base());
    const c = await collecter(opts(fetcher, { maxRequests: 10 }));
    expect(c.articles).toHaveLength(2);
    expect(appels).toHaveLength(4);
  });

  it("robots.txt inaccessible → abstention après 1 requête", async () => {
    const r = base();
    r["https://hmizate.ma/robots.txt"] = { status: 404, body: "" };
    const { fetcher, appels } = faux(r);
    const c = await collecter(opts(fetcher));
    expect(appels).toHaveLength(1);
    expect(c.arret).toMatch(/robots\.txt inaccessible/);
  });

  it("robots.txt qui interdit la liste → arrêt, aucune page lue", async () => {
    const r = base();
    r["https://hmizate.ma/robots.txt"] = { status: 200, body: "User-agent: *\nDisallow: /deal\n" };
    const { fetcher, appels } = faux(r);
    const c = await collecter(opts(fetcher));
    expect(appels).toHaveLength(1);
    expect(c.arret).toMatch(/interdit/);
  });

  it.each([403, 429, 503])("HTTP %i → arrêt immédiat, aucun contournement", async (code) => {
    const r = base();
    r["https://hmizate.ma/deal"] = { status: code, body: "" };
    const { fetcher, appels } = faux(r);
    const c = await collecter(opts(fetcher));
    expect(c.arret).toMatch(/BLOQUÉ/);
    expect(appels).toHaveLength(2);
    expect(c.articles).toHaveLength(0);
  });

  it("page anti-robot → arrêt", async () => {
    const r = base();
    r["https://hmizate.ma/deal/catalogue-bim-8-septembre-2026-n2"] = { status: 200, body: "<html>Just a moment...</html>" };
    const { fetcher } = faux(r);
    const c = await collecter(opts(fetcher));
    expect(c.arret).toMatch(/anti-robot/);
    expect(c.articles).toHaveLength(0);
  });
});

describe("envoi à l'API", () => {
  const poster = () => {
    const appels: { path: string; body: any }[] = [];
    const post: Poster = async (path, body) => {
      appels.push({ path, body });
      return path === "/admin/sources/brut" ? { status: 201, json: { rawDataId: 7 } } : { status: 200, json: { publies: 3, enAttente: 1, ignores: 0, doublons: 0 } };
    };
    return { appels, post };
  };
  const collecte = async () => collecter(opts(faux(base()).fetcher, { maxRequests: 3 }));

  it("essai à blanc : aucune donnée brute envoyée, essaiABlanc = true, promotions conditionnelles exclues", async () => {
    const { appels, post } = poster();
    const rap = await envoyer(await collecte(), post, { confirm: false, ville: "Casablanca" });
    expect(appels.map((a) => a.path)).toEqual(["/admin/scraping/releves"]);
    const b = appels[0].body;
    expect(b.essaiABlanc).toBe(true);
    expect(b.releves.some((r: any) => /Zeta/.test(r.libelle))).toBe(false);
    expect(b.releves.every((r: any) => r.source === "catalogue" && r.enseigne === "bim" && r.dateReleve === b.tracabilite.validFrom)).toBe(true);
    expect(rap[0].statut).toBe("essai à blanc");
  });

  it("réel : donnée brute d'abord, puis relevés avec traçabilité complète", async () => {
    const { appels, post } = poster();
    await envoyer(await collecte(), post, { confirm: true, ville: "Casablanca" });
    expect(appels.map((a) => a.path)).toEqual(["/admin/sources/brut", "/admin/scraping/releves"]);
    expect(appels[1].body.essaiABlanc).toBe(false);
    expect(appels[1].body.tracabilite).toMatchObject({ sourceSlug: "hmizate", rawDataId: 7, validityStatus: "estimee" });
    expect(appels[1].body.tracabilite.observedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
});
