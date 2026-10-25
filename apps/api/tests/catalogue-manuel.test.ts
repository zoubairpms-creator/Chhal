import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedBasketFixture, seedButterFixture, seedCatalogue, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";

const ADMIN = { authorization: "Bearer jeton-manuel" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;

const v = (over: Record<string, unknown> = {}) => ({ famille: "sucre", nom: "Sucre cristallisé", marque: "Cosumar", valeur: 1, unite: "kg", categorie: "epicerie", ...over });
const imp = (variantes: object[], extra: object = {}, headers: Record<string, string> = ADMIN) =>
  app.inject({ method: "POST", url: "/admin/catalogue/import", headers, payload: { origine: "manuel", variantes, ...extra } });

beforeAll(async () => {
  h = await createTestDb();
  await seedButterFixture(h.db);
  await seedBasketFixture(h.db);
  await seedCatalogue(h.db);
  app = buildApp(h.db, { adminToken: "jeton-manuel", today: () => "2026-10-20" });
});
afterAll(async () => {
  await app.close();
  await h.close();
});

describe("import manuel (marques vérifiées en magasin)", () => {
  it("essai à blanc puis import : fiches sans code-barres ni photo, origine « manuel », marque cherchable", async () => {
    const dry = await imp([v(), v({ marque: "Autre Marque", nom: "Sucre en poudre", valeur: 500, unite: "g" })], { essaiABlanc: true });
    expect(dry.json()).toMatchObject({ essaiABlanc: true, crees: 2, ignores: 0 });
    const r = await imp([v(), v({ marque: "Autre Marque", nom: "Sucre en poudre", valeur: 500, unite: "g" })]);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ crees: 2, ignores: 0 });
    const hit = (await app.inject({ url: "/produits?q=cosumar" })).json().resultats.find((x: any) => x.marque === "Cosumar");
    expect(hit).toMatchObject({ nom: "Sucre cristallisé", famille: "sucre", format: "1 kg", image: null });
  });

  it("même marque, même nom et même format : ignoré (aucun doublon), même avec une casse différente", async () => {
    const r = await imp([v({ marque: "COSUMAR", nom: "sucre cristallisé" })]);
    expect(r.json()).toMatchObject({ crees: 0, ignores: 1 });
  });

  it("un produit existant AVEC marque n'est jamais dupliqué ; un produit sans marque ne bloque pas la création d'une fiche avec marque", async () => {
    // « Sucre en morceaux 1 kg » (catalogue de base, sans marque) existe déjà : la fiche Cosumar est une nouvelle variante, créée.
    const r = await imp([v({ nom: "Sucre en morceaux", marque: "Cosumar" })]);
    expect(r.json()).toMatchObject({ crees: 1 });
  });

  it("emplacement de marque non rempli, photo ou code-barres invalide : tout refusé, rien d'importé", async () => {
    const r = await imp([v({ marque: "(à préciser : marque lue en magasin)", nom: "Farine test" }), v({ nom: "Riz test", marque: "Marque Riz", imageUrl: "https://images.openfoodfacts.org/x.jpg" }), v({ nom: "Lentilles test", marque: "Marque L", ean: "123" })]);
    expect(r.statusCode).toBe(422);
    const msgs = r.json().erreurs.map((e: any) => e.message).join(" | ");
    expect(msgs).toMatch(/Marque non renseignée/);
    expect(msgs).toMatch(/ne porte pas de photo/);
    expect(msgs).toMatch(/Code-barres invalide/);
    expect((await app.inject({ url: "/produits?q=lentilles%20test" })).json().resultats).toEqual([]);
  });

  it("doublon dans le fichier (insensible à la casse) refusé", async () => {
    const r = await imp([v({ nom: "Test double", marque: "M1" }), v({ nom: "TEST DOUBLE", marque: "m1" })]);
    expect(r.statusCode).toBe(422);
    expect(r.json().erreurs[0].message).toMatch(/double/);
  });

  it("le mode Open Food Facts exige toujours un code-barres ; origine inconnue → 400 ; sans jeton → 401", async () => {
    const off = await app.inject({ method: "POST", url: "/admin/catalogue/import", headers: ADMIN, payload: { origine: "openfoodfacts", variantes: [v({ nom: "Sans EAN", marque: "X1" })] } });
    expect(off.statusCode).toBe(422);
    expect(off.json().erreurs[0].message).toMatch(/Code-barres obligatoire/);
    expect((await app.inject({ method: "POST", url: "/admin/catalogue/import", headers: ADMIN, payload: { origine: "inconnue", variantes: [v()] } })).statusCode).toBe(400);
    expect((await imp([v()], {}, {})).statusCode).toBe(401);
  });
});
