import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedBasketFixture, seedButterFixture, seedCatalogue, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";

const ADMIN = { authorization: "Bearer jeton-lignes" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;
let sucreId: number; // produit PRÉCIS (Cosumar 1 kg)

const post = (url: string, payload: object, headers: Record<string, string> = {}) => app.inject({ method: "POST", url, payload, headers });
const adm = (url: string, payload: object) => post(url, payload, ADMIN);
const optimiser = (articles: object[], extra: object = {}) => post("/paniers/optimiser", { ville: "Casablanca", articles, ...extra });

const variante = (marque: string, valeur: number, unite: string, famille = "huile-de-table", nom = "Huile de table") => ({ famille, nom, marque, valeur, unite, categorie: "epicerie" });
async function idDe(q: string, marque: string, format: string): Promise<number> {
  return (await app.inject({ url: `/produits?q=${encodeURIComponent(q)}` })).json().resultats.find((r: any) => r.marque === marque && r.format === format).id;
}
const prix = (produitId: number, enseigne: string, prixMad: number, dateReleve = "2026-10-18") =>
  adm("/admin/observations", { produitId, enseigne, ville: "Casablanca", prixMad, dateReleve });

/*
 * Prix de test de ce fichier (aucun n'est réel) :
 *   huile 1 L Lesieur : Marjane 20, Carrefour 25
 *   huile 5 L Lesieur : Marjane 92
 *   huile 2 L Afia    : Carrefour 38, Atacadao 36
 *   sucre 1 kg Cosumar (ligne précise) : Marjane 9, Atacadao 8
 *   riz 1 kg Dari / 5 kg Dari : Atacadao 14 / 60
 */
beforeAll(async () => {
  h = await createTestDb();
  await seedButterFixture(h.db);
  await seedBasketFixture(h.db);
  await seedCatalogue(h.db);
  app = buildApp(h.db, { adminToken: "jeton-lignes", today: () => "2026-10-20" });
  expect((await adm("/admin/catalogue/import", { origine: "manuel", variantes: [
    variante("Lesieur", 1, "l"), variante("Lesieur", 5, "l"), variante("Afia", 2, "l"),
    variante("Cosumar", 1, "kg", "sucre", "Sucre cristallisé"),
    variante("Dari", 1, "kg", "riz", "Riz long grain"), variante("Dari", 5, "kg", "riz", "Riz long grain"),
  ] })).statusCode).toBe(201);
  const l1 = await idDe("huile", "Lesieur", "1 l");
  const l5 = await idDe("huile", "Lesieur", "5 l");
  const a2 = await idDe("huile", "Afia", "2 l");
  sucreId = await idDe("sucre", "Cosumar", "1 kg");
  const r1 = await idDe("riz", "Dari", "1 kg");
  const r5 = await idDe("riz", "Dari", "5 kg");
  for (const [id, e, p] of [[l1, "marjane", 20], [l1, "carrefour", 25], [l5, "marjane", 92], [a2, "carrefour", 38], [a2, "atacadao", 36], [sucreId, "marjane", 9], [sucreId, "atacadao", 8], [r1, "atacadao", 14], [r5, "atacadao", 60]] as const) {
    expect((await prix(id, e, p)).statusCode).toBe(201);
  }
});
afterAll(async () => {
  await app.close();
  await h.close();
});

describe("panier avec une ligne famille", () => {
  it("5 L d'huile, n'importe quelle marque : le calcul choisit la variante la moins chère de chaque magasin", async () => {
    const r = (await optimiser([{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }])).json();
    // Marjane : 5 × 1 L = 100 ou 1 × 5 L = 92 → 92 ; Carrefour : 5 × 25 = 125 ou 3 × 2 L = 114 → 114 ; Atacadao : 3 × 2 L = 108
    expect(r.totalMad).toBe(92);
    expect(r.plan).toHaveLength(1);
    const ligne = r.plan[0].articles[0];
    expect(r.plan[0].enseigne).toBe("Marjane");
    expect(ligne).toMatchObject({ famille: "huile-de-table", quantite: 1, prixUnitaireMad: 92, totalMad: 92 });
    expect(ligne.nom).toMatch(/Lesieur/);
    expect(ligne.ligneFamille).toMatchObject({ quantiteDemandee: 5, unite: "l", quantiteAchetee: 5, surplus: 0, format: "5 l", marque: "Lesieur" });
    expect(r.resolutionFamilles).toBe("familles-1.0.0");
  });

  it("cohérence des lignes : quantité × prix du paquet = total de la ligne, somme des lignes = total du panier", async () => {
    const r = (await optimiser([{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }, { produitId: sucreId, quantite: 2 }], { ageMaxJours: 30 })).json();
    let somme = 0;
    for (const p of r.plan) for (const a of p.articles) { expect(Math.round(a.quantite * a.prixUnitaireMad * 100)).toBe(Math.round(a.totalMad * 100)); somme += a.totalMad; }
    expect(Math.round(somme * 100) / 100).toBe(r.totalMad);
  });

  it("panier MIXTE (ligne précise + ligne famille) : total = recalcul indépendant, tous magasins", async () => {
    const r = (await optimiser([{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }, { produitId: sucreId, quantite: 3 }, { famille: "riz", quantiteBase: 5, unite: "kg" }])).json();
    // Huile : meilleur magasin = Marjane 92 ; sucre ×3 : Atacadao 3 × 8 = 24 ; riz 5 kg : Atacadao 5 × 14 = 70 ou 1 × 5 kg = 60 → 60
    expect(r.totalMad).toBe(92 + 24 + 60);
    const parEnseigne = Object.fromEntries(r.plan.map((p: any) => [p.enseigne, p.sousTotalMad]));
    expect(parEnseigne).toEqual({ Marjane: 92, Atacadao: 84 });
    expect(r.exclus).toEqual([]);
  });

  it("limite de magasins : un seul magasin ne peut couvrir tout le panier mixte, la couverture est signalée", async () => {
    const cmp = (await post("/paniers/comparer", { ville: "Casablanca", articles: [{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }, { produitId: sucreId, quantite: 3 }, { famille: "riz", quantiteBase: 5, unite: "kg" }] })).json();
    const [un, deux, opt] = cmp.options;
    expect(opt.articlesCouverts).toBe(3);
    expect(opt.articlesDemandes).toBe(3);
    expect(un.articlesCouverts).toBeLessThanOrEqual(deux.articlesCouverts);
    expect(deux.articlesCouverts).toBe(3); // Marjane + Atacadao couvrent les trois lignes
    expect(opt.totalMad).toBe(176);
  });

  it("deux lignes de la même famille sont additionnées : 3 L + 2 L = 5 L", async () => {
    const a = (await optimiser([{ famille: "huile-de-table", quantiteBase: 3, unite: "l" }, { famille: "huile-de-table", quantiteBase: 2, unite: "l" }])).json();
    const b = (await optimiser([{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }])).json();
    expect(a.totalMad).toBe(b.totalMad);
    expect(a.plan[0].articles).toHaveLength(1);
  });

  it("enseigne exclue : le choix se fait parmi les autres magasins", async () => {
    const r = (await optimiser([{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }], { enseignesExclues: ["marjane"] })).json();
    // Atacadao : 3 × 2 L Afia à 36 = 108 ; Carrefour : 114
    expect(r.plan[0].enseigne).toBe("Atacadao");
    expect(r.totalMad).toBe(108);
    expect(r.plan[0].articles[0].ligneFamille).toMatchObject({ marque: "Afia", format: "2 l", quantiteAchetee: 6, surplus: 1 });
  });

  it("prix périmés : ignorés ; sans aucun prix récent la ligne est signalée et hors total", async () => {
    const r = (await optimiser([{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }], { ageMaxJours: 1 })).json();
    expect(r.plan).toEqual([]);
    expect(r.totalMad).toBe(0);
    expect(r.exclus[0]).toMatchObject({ produitId: null, famille: "huile-de-table", raison: "Aucun prix de moins de 1 jours." });
    const sansPrix = (await optimiser([{ famille: "lentilles", quantiteBase: 1, unite: "kg" }])).json();
    expect(sansPrix.exclus[0]).toMatchObject({ famille: "lentilles", raison: "Aucun prix connu dans cette ville." });
  });

  it("reproductible : même panier, même résultat, variante retenue comprise", async () => {
    const body = [{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }, { famille: "riz", quantiteBase: 5, unite: "kg" }];
    const a = (await optimiser(body)).json();
    const b = (await optimiser([...body].reverse())).json();
    expect(b).toEqual(a);
  });
});

describe("validation des lignes famille", () => {
  const rejette = async (ligne: object, statut: number, motif: RegExp) => {
    const r = await optimiser([ligne]);
    expect(r.statusCode).toBe(statut);
    expect(r.json().erreur).toMatch(motif);
  };
  it("famille inconnue → 404 ; unité d'une autre classe → 400 ; pièces non entières, quantité nulle ou excessive → 400", async () => {
    await rejette({ famille: "famille-fantome", quantiteBase: 1, unite: "kg" }, 404, /Famille inconnue/);
    await rejette({ famille: "huile-de-table", quantiteBase: 1, unite: "kg" }, 400, /Unité incompatible.*se compte en l/);
    await rejette({ famille: "riz", quantiteBase: 1, unite: "l" }, 400, /Unité incompatible.*se compte en kg/);
    await rejette({ famille: "oeufs", quantiteBase: 1.5, unite: "piece" }, 400, /Requête invalide/);
    await rejette({ famille: "riz", quantiteBase: 0, unite: "kg" }, 400, /Requête invalide/);
    await rejette({ famille: "riz", quantiteBase: 100, unite: "kg" }, 400, /Requête invalide/);
    await rejette({ famille: "Riz Invalide!", quantiteBase: 1, unite: "kg" }, 400, /Requête invalide/);
  });
  it("les anciens corps de requête (lignes précises seules) restent acceptés et inchangés", async () => {
    const r = (await optimiser([{ produitId: sucreId, quantite: 2 }])).json();
    expect(r.totalMad).toBe(16);
    expect(r.resolutionFamilles).toBeNull();
    expect(r.plan[0].articles[0]).toMatchObject({ famille: null, ligneFamille: null, produitId: sucreId });
  });
  it("50 lignes au plus, précises et famille confondues", async () => {
    const lignes = Array.from({ length: 51 }, () => ({ famille: "riz", quantiteBase: 1, unite: "kg" }));
    expect((await optimiser(lignes)).statusCode).toBe(400);
  });
});

describe("QA — cas limites des lignes famille", () => {
  it("quantité minimale 0,1 kg : un paquet entier est acheté, le surplus est chiffré", async () => {
    const r = (await optimiser([{ famille: "riz", quantiteBase: 0.1, unite: "kg" }])).json();
    expect(r.plan[0].articles[0]).toMatchObject({ quantite: 1, totalMad: 14 });
    expect(r.plan[0].articles[0].ligneFamille).toMatchObject({ format: "1 kg", surplus: 0.9, quantiteAchetee: 1 });
  });

  it("quantité maximale 99 kg : 20 sacs de 5 kg (1 200 MAD) battent 99 paquets de 1 kg (1 386 MAD)", async () => {
    const r = (await optimiser([{ famille: "riz", quantiteBase: 99, unite: "kg" }])).json();
    expect(r.totalMad).toBe(1200);
    expect(r.plan[0].articles[0]).toMatchObject({ quantite: 20, prixUnitaireMad: 60 });
    expect(r.plan[0].articles[0].ligneFamille).toMatchObject({ quantiteAchetee: 100, surplus: 1 });
  });

  it("injection dans le nom de famille : refusée par la validation, aucune erreur serveur", async () => {
    for (const famille of ["'; DROP TABLE products; --", "riz' OR '1'='1", "../../etc/passwd", ""]) {
      const r = await optimiser([{ famille, quantiteBase: 1, unite: "kg" }]);
      expect(r.statusCode, famille).toBe(400);
    }
    expect((await optimiser([{ famille: "riz", quantiteBase: 1, unite: "kg" }])).statusCode).toBe(200); // la base est intacte
  });

  it("toutes les enseignes qui ont un prix sont exclues : ligne signalée, total nul, pas d'erreur", async () => {
    const r = (await optimiser([{ famille: "riz", quantiteBase: 1, unite: "kg" }], { enseignesExclues: ["atacadao"] })).json();
    expect(r.plan).toEqual([]);
    expect(r.totalMad).toBe(0);
    expect(r.exclus).toHaveLength(1);
  });

  it("lignes famille seules dans la comparaison : trois options cohérentes, couverture comptée par ligne", async () => {
    const cmp = (await post("/paniers/comparer", { ville: "Casablanca", articles: [{ famille: "huile-de-table", quantiteBase: 2, unite: "l" }, { famille: "riz", quantiteBase: 1, unite: "kg" }] })).json();
    const [un, deux, opt] = cmp.options;
    expect(opt.articlesDemandes).toBe(2);
    expect(opt.articlesCouverts).toBe(2);
    expect(un.articlesCouverts).toBeLessThanOrEqual(deux.articlesCouverts);
    expect(deux.articlesCouverts).toBeLessThanOrEqual(opt.articlesCouverts);
  });

  it("une ligne précise et une ligne famille sur le même produit ne se confondent pas dans le décompte demandé", async () => {
    const cmp = (await post("/paniers/comparer", { ville: "Casablanca", articles: [{ produitId: sucreId, quantite: 1 }, { famille: "sucre", quantiteBase: 1, unite: "kg" }] })).json();
    expect(cmp.options[2].articlesDemandes).toBe(2);
  });
});

describe("enregistrement, partage et rapport", () => {
  it("le panier enregistré garde la variante retenue ; le lien relit le même résultat même si les prix changent ensuite", async () => {
    const saved = await post("/paniers", { ville: "Casablanca", articles: [{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }] });
    expect(saved.statusCode).toBe(201);
    const { token, totalMad } = saved.json();
    // un prix plus bas apparaît ensuite : le panier partagé ne bouge pas
    const l5 = await idDe("huile", "Lesieur", "5 l");
    await prix(l5, "marjane", 50, "2026-10-19");
    const relu = (await app.inject({ url: `/paniers/${token}` })).json();
    expect(relu.totalMad).toBe(totalMad);
    expect(relu.articles).toEqual([{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }]);
    expect(relu.plan[0].articles[0].ligneFamille.marque).toBe("Lesieur");
    // …alors qu'un nouveau calcul tient compte du nouveau prix
    expect((await optimiser([{ famille: "huile-de-table", quantiteBase: 5, unite: "l" }])).json().totalMad).toBe(50);
  });

  it("rapport : une ligne famille dans la matrice, case = coût de la variante retenue, détail lisible, meilleur prix effectif", async () => {
    const r = (await post("/rapports/panier", { ville: "Casablanca", articles: [{ famille: "riz", quantiteBase: 5, unite: "kg" }, { produitId: sucreId, quantite: 1 }] })).json();
    expect(r.matrice).toHaveLength(2);
    const fam = r.matrice.find((m: any) => m.famille === "riz");
    expect(fam.produitId).toBeNull();
    expect(fam.nom).toMatch(/Riz — 5 kg \(n'importe quelle marque\)/);
    const atacadao = fam.prix.find((c: any) => c.enseigne === "Atacadao");
    expect(atacadao).toMatchObject({ prixMad: 60, detail: "Dari 5 kg × 1", perime: false });
    expect(fam.prix.find((c: any) => c.enseigne === "Marjane").prixMad).toBeNull();
    expect(fam.meilleur).toMatchObject({ enseigne: "Atacadao", prixMad: 60, prixUnitaire: { prix: 12, par: "kg" } });
    expect(r.options.map((o: any) => o.cle)).toEqual(["un_magasin", "deux_magasins", "optimal"]);
  });

  it("libellé de quantité lisible dans le rapport : « 1,5 L », « 5 kg », « 12 pièces »", async () => {
    const { libelleQte } = await import("../src/app.js");
    expect(libelleQte(1.5, "l")).toBe("1,5 L");
    expect(libelleQte(5, "kg")).toBe("5 kg");
    expect(libelleQte(12, "piece")).toBe("12 pièces");
    expect(libelleQte(1, "piece")).toBe("1 pièce");
    const r = (await post("/rapports/panier", { ville: "Casablanca", articles: [{ famille: "huile-de-table", quantiteBase: 1.5, unite: "l" }] })).json();
    expect(r.matrice[0].nom).toBe("Huile de table — 1,5 L (n'importe quelle marque)");
  });

  it("rapport d'un panier enregistré contenant une ligne famille : relu sans erreur", async () => {
    const saved = (await post("/paniers", { ville: "Casablanca", articles: [{ famille: "riz", quantiteBase: 2, unite: "kg" }] })).json();
    const rap = await app.inject({ url: `/paniers/${saved.token}/rapport` });
    expect(rap.statusCode).toBe(200);
    expect(rap.json().matrice[0].famille).toBe("riz");
  });
});
