import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedBasketFixture, seedButterFixture, seedCatalogue, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";
import { checkDate, parsePrix, parseReleves } from "../src/csvImport.js";

const ADMIN = { authorization: "Bearer jeton-import" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;

const HEADER = "slug;produit;ville;date_releve;BIM;Kazyon;Supeco;Marjane;Carrefour;Atacadao;Al Hari;Asswak Assalam";
const row = (slug: string, prices: Record<string, string>, ville = "Casablanca", date = "2026-10-19") => {
  const cols = ["BIM", "Kazyon", "Supeco", "Marjane", "Carrefour", "Atacadao", "Al Hari", "Asswak Assalam"].map((c) => prices[c] ?? "");
  return [slug, "x", ville, date, ...cols].join(";");
};
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");
const importer = (body: object, headers = ADMIN) => app.inject({ method: "POST", url: "/admin/releves/import", headers, payload: body });

beforeAll(async () => {
  h = await createTestDb();
  await seedButterFixture(h.db);
  await seedBasketFixture(h.db);
  await seedCatalogue(h.db);
  app = buildApp(h.db, { adminToken: "jeton-import", today: () => "2026-10-20" });
});
afterAll(async () => {
  await app.close();
  await h.close();
});

describe("analyse du CSV", () => {
  it("BOM, séparateur « ; », lignes vides ignorées, cellules vides conservées", () => {
    const r = parseReleves("﻿" + csv(row("sucre-1kg", { Marjane: "8.9" }), "", row("riz-long-grain-1kg", {})));
    expect(r.erreurs).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.colonnes).toHaveLength(8);
    expect(r.rows[0].cellules.find((c) => c.colonne === "Marjane")?.brut).toBe("8.9");
  });
  it("colonnes obligatoires absentes, fichier vide, trop de lignes", () => {
    expect(parseReleves("").erreurs[0].message).toMatch(/vide/);
    expect(parseReleves("slug;ville\nx;y").erreurs.map((e) => e.colonne)).toContain("date_releve");
    const big = [HEADER, ...Array.from({ length: 501 }, () => row("sucre-1kg", {}))].join("\n");
    expect(parseReleves(big).erreurs[0].message).toMatch(/Trop de lignes/);
  });
  it("prix : point ou virgule, 2 décimales max, jamais 0 ou négatif ou texte", () => {
    expect(parsePrix("79.95")).toBe(79.95);
    expect(parsePrix("79,95")).toBe(79.95);
    expect(parsePrix(" 12 ")).toBe(12);
    expect(parsePrix("")).toBeNull();
    for (const bad of ["0", "0.00", "-5", "79.999", "abc", "n/a", "1,234.5", "1e3"]) expect(() => parsePrix(bad), bad).toThrow();
  });
  it("dates : format, calendrier réel, pas de futur", () => {
    expect(checkDate("2026-10-19", "2026-10-20")).toBeNull();
    expect(checkDate("2026-10-20", "2026-10-20")).toBeNull();
    expect(checkDate("2026-10-21", "2026-10-20")).toMatch(/futur/);
    expect(checkDate("2026-02-30", "2026-10-20")).toMatch(/inexistante/);
    expect(checkDate("19/10/2026", "2026-10-20")).toMatch(/invalide/);
  });
});

describe("import par lot", () => {
  it("le modèle vide fourni dans docs est refusé : aucun prix renseigné (date remplie)", async () => {
    const tpl = await readFile(new URL("../../../docs/releves-a-saisir.csv", import.meta.url), "utf8");
    const r = await importer({ csv: tpl.replace(/Casablanca;;/g, "Casablanca;2026-10-19;") });
    expect(r.statusCode).toBe(422);
    expect(r.json().erreurs[0].message).toMatch(/Aucun prix renseigné/);
  });

  it("essai à blanc : valide et compte sans rien enregistrer", async () => {
    const body = csv(row("sucre-1kg", { Marjane: "8.90", Carrefour: "9,20" }), row("riz-long-grain-1kg", { "Al Hari": "13.5" }));
    const r = await importer({ csv: body, essaiABlanc: true });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ essaiABlanc: true, observations: 3, lignes: 2 });
    const hist = (await app.inject({ url: "/produits?q=sucre&ville=Casablanca" })).json().resultats;
    expect(hist).toEqual([]); // toujours rien de publié : les données de test sont masquées et rien n'a été ajouté
  });

  it("import réel : observations publiées, source manuelle, visibles dans les prix, historique conservé", async () => {
    const body = csv(row("sucre-1kg", { Marjane: "8.90", Carrefour: "9,20", BIM: "8.40" }), row("riz-long-grain-1kg", { "Al Hari": "13.5" }));
    const r = await importer({ csv: body });
    expect(r.statusCode).toBe(201);
    expect(r.json().observations).toBe(4);
    const hits = (await app.inject({ url: "/produits?q=sucre&ville=Casablanca" })).json().resultats;
    const sucre = hits.find((x: any) => /Sucre/.test(x.nom));
    expect(sucre.top3.map((t: any) => [t.enseigne, t.prixMad])).toEqual([["BIM", 8.4], ["Marjane", 8.9], ["Carrefour", 9.2]]);
    expect(sucre.top3[0].source).toBe("manuel");
  });

  it("un relevé existant pour le même produit, magasin et date est refusé : l'historique n'est jamais écrasé", async () => {
    const r = await importer({ csv: csv(row("sucre-1kg", { Marjane: "9.99" })) });
    expect(r.statusCode).toBe(422);
    expect(r.json().erreurs[0].message).toMatch(/existe déjà/);
  });

  it("autre date, même produit : accepté, l'historique s'allonge", async () => {
    const r = await importer({ csv: csv(row("sucre-1kg", { Marjane: "9.10" }, "Casablanca", "2026-10-20")) });
    expect(r.statusCode).toBe(201);
    const prod = (await app.inject({ url: "/produits?q=sucre" })).json().resultats.find((x: any) => /Sucre/.test(x.nom));
    const hist = (await app.inject({ url: `/produits/${prod.id}/historique?ville=Casablanca&enseigne=marjane` })).json().points;
    expect(hist.map((p: any) => p.prixMad)).toEqual([8.9, 9.1]);
  });

  it("tout ou rien : une seule erreur et RIEN n'est enregistré, toutes les erreurs sont listées", async () => {
    const before = (await app.inject({ url: "/produits?q=farine" })).json().resultats.length;
    const body = csv(
      row("farine-ble-5kg", { Marjane: "36.5", Carrefour: "-3" }), // prix négatif
      row("slug-inconnu", { Marjane: "5" }), // produit inconnu
      row("lait-demi-ecreme-1l", { Marjane: "7.5" }, "Casablanca", "2030-01-01"), // futur
      row("sel-fin-1kg", { Marjane: "3.999" }), // 3 décimales
      row("sel-fin-1kg", { Marjane: "3.5" }, "Oujda"), // ville sans magasin
    );
    const r = await importer({ csv: body });
    expect(r.statusCode).toBe(422);
    const msgs = r.json().erreurs.map((e: any) => e.message).join(" | ");
    expect(r.json().erreurs.length).toBeGreaterThanOrEqual(5);
    expect(msgs).toMatch(/strictement positif|invalide/);
    expect(msgs).toMatch(/Produit inconnu/);
    expect(msgs).toMatch(/futur/);
    expect(msgs).toMatch(/Aucun magasin/);
    const after = (await app.inject({ url: "/produits?q=farine" })).json().resultats.length;
    expect(after).toBe(before);
    const farineHist = (await app.inject({ url: "/produits?q=farine&ville=Casablanca" })).json().resultats.flatMap((x: any) => x.top3);
    expect(farineHist.some((t: any) => t.source === "manuel")).toBe(false);
  });

  it("doublon dans le fichier, enseigne inconnue, ligne sans ville : erreurs ciblées", async () => {
    const dup = await importer({ csv: csv(row("sel-fin-1kg", { Marjane: "3" }), row("sel-fin-1kg", { Marjane: "3.2" })) });
    expect(dup.json().erreurs[0].message).toMatch(/double/);
    const bad = await importer({ csv: HEADER.replace("Supeco", "Inconnu") + "\n" + row("sel-fin-1kg", { Marjane: "3" }) });
    expect(bad.json().erreurs.some((e: any) => /Enseigne inconnue/.test(e.message) && e.colonne === "Inconnu")).toBe(true);
    const noCity = await importer({ csv: csv(row("sel-fin-1kg", { Marjane: "3" }, "")) });
    expect(noCity.json().erreurs[0].colonne).toBe("ville");
  });

  it("sécurité : 401 sans jeton, corps invalide → 400", async () => {
    expect((await importer({ csv: "x" }, {} as any)).statusCode).toBe(401);
    expect((await importer({})).statusCode).toBe(400);
    expect((await importer({ csv: "" })).statusCode).toBe(400);
  });
});
