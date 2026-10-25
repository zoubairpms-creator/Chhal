import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedButterFixture, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";

const ADMIN = { authorization: "Bearer jeton-off" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;

/** Fabrique un EAN-13 valide à partir de 12 chiffres. */
const ean = (body12: string) => {
  const digits = body12.split("").map(Number).reverse();
  const check = (10 - (digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0) % 10)) % 10;
  return body12 + check;
};
const IMG = "https://images.openfoodfacts.org/images/products/611/125/865/0504/front_en.3.400.jpg";
const FICHE = "https://world.openfoodfacts.org/product/6111258650504";
const v = (over: Record<string, unknown> = {}) => ({
  famille: "huile-de-table", ean: ean("611125865050"), nom: "Huile de tournesol Soleil", marque: "Soleil", valeur: 1, unite: "l", categorie: "epicerie",
  imageUrl: IMG, ficheUrl: FICHE, ...over,
});
const imp = (variantes: object[], extra: object = {}, headers: Record<string, string> = ADMIN) =>
  app.inject({ method: "POST", url: "/admin/catalogue/import", headers, payload: { origine: "openfoodfacts", variantes, ...extra } });

beforeAll(async () => {
  h = await createTestDb();
  await seedButterFixture(h.db);
  app = buildApp(h.db, { adminToken: "jeton-off", today: () => "2026-10-20" });
});
afterAll(async () => {
  await app.close();
  await h.close();
});

describe("import du catalogue validé (Open Food Facts)", () => {
  it("essai à blanc : compte sans rien créer", async () => {
    const r = await imp([v(), v({ ean: ean("611124504138"), nom: "Huile de soja Plus", marque: "Plus" })], { essaiABlanc: true });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ essaiABlanc: true, crees: 2, ignores: 0 });
    expect((await app.inject({ url: "/produits?q=soleil" })).json().resultats).toEqual([]);
  });

  it("import réel : produits créés avec code-barres, famille, photo, mention de licence et origine", async () => {
    const r = await imp([v(), v({ ean: ean("611124504138"), nom: "Huile de soja Plus", marque: "Plus", imageUrl: null, ficheUrl: undefined })]);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ crees: 2, ignores: 0 });
    const hit = (await app.inject({ url: "/produits?q=soleil" })).json().resultats[0];
    expect(hit).toMatchObject({ nom: "Huile de tournesol Soleil", marque: "Soleil", famille: "huile-de-table", format: "1 l" });
    expect(hit.image).toEqual({ url: IMG, credit: "Photo : Open Food Facts, CC BY-SA", ficheUrl: FICHE });
    const sans = (await app.inject({ url: "/produits?q=plus" })).json().resultats.find((x: any) => x.marque === "Plus");
    expect(sans.image).toBeNull();
  });

  it("la marque est cherchable, la famille regroupe les variantes", async () => {
    const all = (await app.inject({ url: "/produits?q=huile" })).json().resultats.filter((x: any) => x.famille === "huile-de-table");
    expect(all.map((x: any) => x.marque).sort()).toEqual(["Plus", "Soleil"]);
  });

  it("idempotent : un code-barres déjà connu est ignoré, pas de doublon", async () => {
    const r = await imp([v()]);
    expect(r.json()).toMatchObject({ crees: 0, ignores: 1 });
  });

  it("tout ou rien : un seul code-barres invalide et RIEN n'est importé ; erreurs ciblées par ligne", async () => {
    const good = v({ ean: ean("611999999990"), nom: "Huile valide Test", marque: "Test" });
    const r = await imp([good, v({ ean: "6111258650505" }), v({ ean: ean("611888888880"), imageUrl: "https://exemple.org/p.jpg" }), v({ ean: ean("611777777770"), ficheUrl: "https://exemple.org/f" })]);
    expect(r.statusCode).toBe(422);
    const lignes = r.json().erreurs.map((e: any) => e.ligne);
    expect(lignes).toEqual([2, 3, 4]);
    expect((await app.inject({ url: "/produits?q=valide" })).json().resultats).toEqual([]);
  });

  it("doublon dans le fichier, EAN-8 et autres formats refusés", async () => {
    const dup = await imp([v({ ean: ean("611555555550") }), v({ ean: ean("611555555550") })]);
    expect(dup.json().erreurs[0].message).toMatch(/double/);
    expect((await imp([v({ ean: "02201023" })])).statusCode).toBe(422);
  });

  it("validation et sécurité : corps invalide → 400, sans jeton → 401", async () => {
    expect((await imp([])).statusCode).toBe(400);
    expect((await imp([v({ famille: "Famille Invalide!" })])).statusCode).toBe(400);
    expect((await imp([v({ unite: "tonne" })])).statusCode).toBe(400);
    expect((await imp([v()], {}, {})).statusCode).toBe(401);
  });

  it("le rapport produit et la fiche prix exposent la photo et sa licence", async () => {
    const id = (await app.inject({ url: "/produits?q=soleil" })).json().resultats[0].id;
    const prix = (await app.inject({ url: `/produits/${id}/prix?ville=Casablanca` })).json();
    expect(prix.produit.image.url).toBe(IMG);
    expect(prix.produit.famille).toBe("huile-de-table");
    const rapport = (await app.inject({ url: `/produits/${id}/rapport?ville=Casablanca` })).json();
    expect(rapport.produit.image.credit).toMatch(/Open Food Facts/);
  });
});
