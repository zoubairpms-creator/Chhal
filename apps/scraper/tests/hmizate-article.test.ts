import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseArticle, parseDateFr, extraireValidite } from "../src/hmizate-article.js";

const html = readFileSync(new URL("../fixtures/hmizate-article-fictif.html", import.meta.url), "utf8");
const URL_OK = "https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1";

describe("dates françaises", () => {
  it.each([
    ["1 septembre 2026", "2026-09-01"],
    ["1er septembre 2026", "2026-09-01"],
    ["mardi 1er septembre 2026", "2026-09-01"],
    ["15 août 2026", "2026-08-15"],
    ["15 aout 2026", "2026-08-15"],
    ["3 décembre 2026", "2026-12-03"],
    ["28 février 2026", "2026-02-28"],
  ])("%s → %s", (txt, iso) => expect(parseDateFr(txt)).toEqual({ iso }));

  it("refuse une date impossible", () => expect(parseDateFr("31 février 2026")).toHaveProperty("erreur"));
  it("refuse un jour de semaine incohérent", () => expect(parseDateFr("lundi 1er septembre 2026")).toHaveProperty("erreur"));
  it("renvoie null sans date", () => expect(parseDateFr("bientôt")).toBeNull());
});

describe("validité", () => {
  it("début lu dans le texte, fin inconnue", () => {
    const v = extraireValidite({ texte: "à partir du mardi 1er septembre 2026", titre: "Catalogue BIM 1 septembre 2026", url: URL_OK });
    expect(v).toMatchObject({ validFrom: "2026-09-01", validUntil: null, status: "inconnue" });
  });
  it("fin explicite « jusqu'au »", () => {
    const v = extraireValidite({ texte: "à partir du mardi 1er septembre 2026, jusqu'au dimanche 6 septembre 2026", titre: "Catalogue BIM 1 septembre 2026", url: URL_OK });
    expect(v).toMatchObject({ validUntil: "2026-09-06", status: "connue" });
  });
  it("fin explicite « du … au … »", () => {
    const v = extraireValidite({ texte: "offres du 1er septembre au 7 septembre 2026", titre: "Catalogue BIM 1 septembre 2026", url: URL_OK });
    expect(v).toMatchObject({ validFrom: "2026-09-01", validUntil: "2026-09-07", status: "connue" });
  });
  it("« semaine de promotions » sans fin : estimée +7 jours seulement si demandé", () => {
    const args = { texte: "à partir du mardi 1er septembre 2026. Cette nouvelle semaine de promotions", titre: "Catalogue BIM 1 septembre 2026", url: URL_OK };
    expect(extraireValidite(args)).toMatchObject({ validUntil: null, status: "inconnue" });
    expect(extraireValidite({ ...args, estimerFin: true })).toMatchObject({ validUntil: "2026-09-08", status: "estimee" });
  });
  it("texte, titre et adresse discordants → rejet", () => {
    const r = extraireValidite({ texte: "à partir du mardi 1er septembre 2026", titre: "Catalogue BIM 8 septembre 2026", url: URL_OK });
    expect(r).toHaveProperty("erreur");
  });
  it("fin antérieure au début → rejet", () => {
    const r = extraireValidite({ texte: "à partir du mardi 1er septembre 2026, jusqu'au 30 août 2026", titre: "Catalogue BIM 1 septembre 2026", url: URL_OK });
    expect(r).toHaveProperty("erreur");
  });
  it("aucune date → rejet, jamais la date du jour", () => {
    expect(extraireValidite({ texte: "des offres", titre: "Catalogue BIM", url: "https://hmizate.ma/deal/catalogue-bim" })).toHaveProperty("erreur");
  });
});

describe("article fictif (balisage de la vraie page)", () => {
  const r = parseArticle(html, URL_OK, { estimerFin: true });
  if (!r.ok) throw new Error(r.raison);

  it("enseigne et validité", () => {
    expect(r.enseigne).toBe("bim");
    expect(r.validite).toMatchObject({ validFrom: "2026-09-01", validUntil: "2026-09-08", status: "estimee" });
  });
  it("ne lit PAS les prix du menu, du bandeau latéral, du pied de page", () => {
    const libs = r.lignes.map((l) => l.libelle).join("|");
    expect(libs).not.toMatch(/menu|latérale|pied|Autre bloc/i);
  });
  it("lit les lignes valides, packs convertis, doublon supprimé", () => {
    const g = r.lignes.find((l) => l.libelle.includes("Gamma"))!;
    expect(g).toMatchObject({ valeur: 180, unite: "g", prixMad: 12.9 });
    expect(r.lignes.filter((l) => l.libelle.includes("Eta"))).toHaveLength(1);
  });
  it("marque les promotions conditionnelles", () => {
    expect(r.lignes.find((l) => l.libelle.includes("Zeta"))?.conditionnelle).toBe(true);
    expect(r.lignes.find((l) => l.libelle.includes("Alpha"))?.conditionnelle).toBe(false);
  });
  it("journalise les rejets avec raison (sans format, pas de « à prix »)", () => {
    expect(r.rejets.some((x) => x.texte.includes("Delta") && /format/i.test(x.raison))).toBe(true);
    expect(r.rejets.some((x) => x.texte.includes("Epsilon"))).toBe(true);
  });
  it("enseigne exclue (Carrefour) → rejet", () => {
    const x = parseArticle(html.replaceAll("BIM", "Carrefour"), "https://hmizate.ma/deal/catalogue-carrefour-1-septembre-2026-n2");
    expect(x.ok).toBe(false);
  });
  it("sans <article> → rejet", () => {
    expect(parseArticle("<html><body><ul><li>X 1 kg à <strong>5 DH</strong></li></ul></body></html>", URL_OK).ok).toBe(false);
  });
});

// Test local seulement : copie réelle de la page (jamais dans le dépôt de tests). Ignoré si absente.
const reelle = new URL("../../../.cache/bim/6e5e52605fb56747b323b7b411e276b1fe1f42bd.html", import.meta.url);
describe.skipIf(!existsSync(reelle))("copie réelle locale (BIM 1 septembre 2026)", () => {
  it("début 2026-09-01, fin inconnue, prix uniquement de l'article", () => {
    const r = parseArticle(readFileSync(reelle, "utf8"), "https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1085");
    if (!r.ok) throw new Error(r.raison);
    expect(r.validite).toMatchObject({ validFrom: "2026-09-01", validUntil: null, status: "inconnue" });
    expect(r.lignes.length).toBeGreaterThanOrEqual(15);
    expect(r.lignes.every((l) => l.prixMad > 0)).toBe(true);
  });
});
