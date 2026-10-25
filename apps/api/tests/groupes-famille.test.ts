import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, FAMILLES, seedBasketFixture, seedButterFixture, seedCatalogue, seedHmizateProducts, type DbHandle } from "@chhal/db";
import { toBase } from "@chhal/matching";
import { buildApp, withGap } from "../src/app.js";
import { LIGNES_MANUELLES } from "../../scraper/src/manuel-proposition.js";
import { FAMILLES_OFF } from "../../scraper/src/off-families.js";

const ADMIN = { authorization: "Bearer jeton-groupes" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;

const get = (url: string) => app.inject({ url });
const post = (url: string, payload: object) => app.inject({ method: "POST", url, headers: ADMIN, payload });
const variante = (marque: string, valeur: number, unite: string, nom = "Huile de table") => ({ famille: "huile-de-table", nom, marque, valeur, unite, categorie: "epicerie" });

beforeAll(async () => {
  h = await createTestDb();
  await seedButterFixture(h.db);
  await seedBasketFixture(h.db);
  await seedCatalogue(h.db);
  await seedHmizateProducts(h.db);
  app = buildApp(h.db, { adminToken: "jeton-groupes", today: () => "2026-10-20" });
  // Trois variantes d'huile avec des prix publiés (données de test de ce fichier, jamais publiques)
  expect((await post("/admin/catalogue/import", { origine: "manuel", variantes: [variante("Lesieur", 1, "l"), variante("Lesieur", 5, "l"), variante("Afia", 2, "l")] })).statusCode).toBe(201);
  const id = async (marque: string, f: string) => (await get(`/produits?q=${marque}`)).json().resultats.find((r: any) => r.marque === marque && r.format === f).id;
  const l1 = await id("Lesieur", "1 l");
  const l5 = await id("Lesieur", "5 l");
  const a2 = await id("Afia", "2 l");
  for (const [produitId, enseigne, prixMad] of [[l1, "marjane", 22], [l5, "marjane", 100], [a2, "carrefour", 38]] as const) {
    expect((await post("/admin/observations", { produitId, enseigne, ville: "Casablanca", prixMad, dateReleve: "2026-10-18" })).statusCode).toBe(201);
  }
});
afterAll(async () => {
  await app.close();
  await h.close();
});

describe("withGap avec valeur de comparaison", () => {
  it("compare au prix unitaire quand on le demande ; comportement par défaut inchangé", () => {
    const r = withGap([{ prixUnitaire: 19 }, { prixUnitaire: 20 }, { prixUnitaire: 22 }], (x) => x.prixUnitaire);
    expect(r.map((x) => x.ecartVsPlusCherPct)).toEqual([13.6, 9.1, 0]);
    expect(withGap([{ prixMad: 50 }, { prixMad: 100 }]).map((x) => x.ecartVsPlusCherPct)).toEqual([50, 0]);
  });
});

describe("recherche groupée par famille", () => {
  it("« huile » : une carte famille avec toutes les variantes, le meilleur prix AU LITRE et un top 3 trié par prix unitaire", async () => {
    const r = (await get("/produits?q=huile&ville=Casablanca")).json();
    const g = r.groupes.find((x: any) => x.famille === "huile-de-table");
    expect(g.nom).toEqual({ fr: "Huile de table", ar: "زيت المائدة", en: "Cooking oil" });
    expect(g.classe).toBe("volume");
    expect(g.nbVariantesAvecPrix).toBe(3);
    expect(g.meilleurPrixUnitaire).toMatchObject({ marque: "Afia", enseigne: "Carrefour", prixUnitaire: 19, par: "l" });
    expect(g.top3.map((t: any) => [t.marque, t.format, t.prixUnitaire])).toEqual([["Afia", "2 l", 19], ["Lesieur", "5 l", 20], ["Lesieur", "1 l", 22]]);
    expect(g.top3.map((t: any) => t.ecartVsPlusCherPct)).toEqual([13.6, 9.1, 0]);
    expect(g.variantes.map((v: any) => [v.marque, v.format])).toEqual([["Afia", "2 l"], ["Lesieur", "5 l"], ["Lesieur", "1 l"]]);
    expect(g.variantes[0].meilleurPrixUnitaire).toEqual({ prix: 19, par: "l" });
  });

  it("la réponse historique est conservée : resultats garde sa forme, groupes et isoles s'ajoutent", async () => {
    const r = (await get("/produits?q=huile&ville=Casablanca")).json();
    expect(r.resultats.length).toBeGreaterThanOrEqual(3);
    expect(r.resultats[0]).toHaveProperty("top3");
    expect(r.resultats[0]).toHaveProperty("meilleurPrix");
    expect(Array.isArray(r.groupes) && Array.isArray(r.isoles)).toBe(true);
  });

  it("une famille est trouvée par SON nom ou alias même si aucune variante ne le contient (arabe complet)", async () => {
    const r = (await get("/produits?q=" + encodeURIComponent("زيت المائدة") + "&ville=Casablanca")).json();
    expect(r.groupes.map((g: any) => g.famille)).toContain("huile-de-table");
  });

  it("darija et arabizi : « zit » trouve la famille", async () => {
    const r = (await get("/produits?q=zit&ville=Casablanca")).json();
    expect(r.groupes.map((g: any) => g.famille)).toContain("huile-de-table");
  });

  it("avec une ville, seules les variantes AVEC prix sont montrées ; une famille sans prix disparaît", async () => {
    const g = (await get("/produits?q=huile&ville=Casablanca")).json().groupes.find((x: any) => x.famille === "huile-de-table");
    expect(g.variantes.every((v: any) => v.meilleurPrix)).toBe(true);
    expect((await get("/produits?q=riz&ville=Casablanca")).json().groupes).toEqual([]);
  });

  it("sans ville, toutes les variantes de la famille sont listées, même sans prix", async () => {
    const g = (await get("/produits?q=huile")).json().groupes.find((x: any) => x.famille === "huile-de-table");
    expect(g.nbVariantes).toBeGreaterThanOrEqual(4); // 3 variantes ajoutées + « Huile de table 1 L » du catalogue de base
    expect(g.variantes.length).toBe(g.nbVariantes);
  });

  it("un produit sans famille reste isolé et n'apparaît dans aucun groupe", async () => {
    const r = (await get("/produits?q=tic%20tac")).json();
    expect(r.groupes).toEqual([]);
    expect(r.isoles.map((x: any) => x.nom)).toContain("Tic Tac");
  });

  it("filtre par enseigne : les prix unitaires ne concernent que cette enseigne", async () => {
    const g = (await get("/produits?q=huile&ville=Casablanca&enseigne=marjane")).json().groupes.find((x: any) => x.famille === "huile-de-table");
    expect(g.top3.map((t: any) => t.enseigne)).toEqual(["Marjane", "Marjane"]);
    expect(g.meilleurPrixUnitaire).toMatchObject({ marque: "Lesieur", format: "5 l", prixUnitaire: 20 });
  });

  it("GET /familles : variantes et variantes tarifées par famille", async () => {
    const f = (await get("/familles?ville=Casablanca")).json().familles;
    expect(f.length).toBe(FAMILLES.length);
    expect(f.find((x: any) => x.slug === "huile-de-table")).toMatchObject({ nbVariantesAvecPrix: 3, classe: "volume" });
    expect(f.find((x: any) => x.slug === "riz")).toMatchObject({ nbVariantesAvecPrix: 0 });
  });
});

describe("import : la famille et la classe de format sont contrôlées", () => {
  it("famille inconnue ou format d'une autre classe : refusé, rien d'importé", async () => {
    const r = await post("/admin/catalogue/import", { origine: "manuel", variantes: [
      { ...variante("Marque A", 1, "kg", "Huile en kilos") }, // masse dans une famille « volume »
      { ...variante("Marque B", 1, "l", "Famille fantôme"), famille: "famille-fantome" },
    ] });
    expect(r.statusCode).toBe(422);
    const msgs = r.json().erreurs.map((e: any) => e.message).join(" | ");
    expect(msgs).toMatch(/Format incompatible : la famille « huile-de-table » est de classe volume, pas masse/);
    expect(msgs).toMatch(/Famille inconnue : « famille-fantome »/);
    expect((await get("/produits?q=huile%20en%20kilos")).json().resultats).toEqual([]);
  });
});

describe("cohérence des propositions de catalogue avec les familles", () => {
  const classe = new Map(FAMILLES.map((f) => [f.slug, f.classe]));

  it("proposition manuelle : chaque ligne vise une famille existante avec un format de la même classe", () => {
    for (const l of LIGNES_MANUELLES) {
      expect(classe.has(l.famille), `${l.marque} ${l.nom} → ${l.famille}`).toBe(true);
      expect(toBase(l.valeur, l.unite).famille, `${l.marque} ${l.nom} (${l.valeur} ${l.unite})`).toBe(classe.get(l.famille));
    }
  });

  it("proposition Open Food Facts : chaque famille recherchée existe et accepte la classe de format de sa famille", () => {
    for (const f of FAMILLES_OFF) {
      expect(classe.has(f.slug), f.slug).toBe(true);
      expect(f.unites, f.slug).toContain(classe.get(f.slug));
    }
  });
});
