import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedBasketFixture, seedButterFixture, type DbHandle } from "@chhal/db";
import { buildApp, withGap } from "../src/app.js";

let h: DbHandle;
let app: ReturnType<typeof buildApp>;
let appPublic: ReturnType<typeof buildApp>;
let butterId: number;

beforeAll(async () => {
  h = await createTestDb();
  butterId = (await seedButterFixture(h.db)).productId;
  await seedBasketFixture(h.db);
  app = buildApp(h.db, { allowTestData: true, today: () => "2026-10-20" });
  appPublic = buildApp(h.db, { today: () => "2026-10-20" });
});
afterAll(async () => {
  await app.close();
  await appPublic.close();
  await h.close();
});

describe("withGap", () => {
  it("rang, écart en % face à la plus chère, liste vide et un seul prix", () => {
    const r = withGap([{ prixMad: 78 }, { prixMad: 90 }, { prixMad: 100 }]);
    expect(r.map((x) => x.rang)).toEqual([1, 2, 3]);
    expect(r.map((x) => x.ecartVsPlusCherPct)).toEqual([22, 10, 0]);
    expect(withGap([])).toEqual([]);
    expect(withGap([{ prixMad: 5 }])[0]).toMatchObject({ rang: 1, ecartVsPlusCherPct: 0 });
  });
});

describe("Top 3", () => {
  it("recherche : top 3 du moins cher au plus cher, écart face à la plus chère (beurre)", async () => {
    const hit = (await appPublic.inject({ url: "/produits?q=beurre&ville=Casablanca" })).json().resultats[0];
    expect(hit.nbEnseignes).toBe(5);
    expect(hit.top3.map((x: any) => [x.rang, x.enseigne, x.prixMad])).toEqual([
      [1, "Al Hari", 78],
      [2, "Marjane", 79.95],
      [3, "Atacadao", 90],
    ]);
    expect(hit.top3[0].ecartVsPlusCherPct).toBe(30.5); // (112,30 - 78) / 112,30
    expect(hit.meilleurPrix.enseigne).toBe("Al Hari");
  });
  it("moins de 3 enseignes : top3 plus court, jamais complété", async () => {
    const hit = (await appPublic.inject({ url: "/produits?q=beurre&ville=Casablanca&enseigne=marjane" })).json().resultats[0];
    expect(hit.top3).toHaveLength(1);
    expect(hit.top3[0].ecartVsPlusCherPct).toBe(0);
  });
  it("fiche produit : chaque ligne porte rang et écart", async () => {
    const rows = (await appPublic.inject({ url: `/produits/${butterId}/prix?ville=Casablanca` })).json().resultats;
    expect(rows.map((r: any) => r.rang)).toEqual([1, 2, 3, 4, 5]);
    expect(rows[4].ecartVsPlusCherPct).toBe(0);
  });
});

describe("Trois options de panier", () => {
  const ids = async () => (await app.inject({ url: "/produits" })).json().resultats.filter((p: any) => p.id !== butterId).map((p: any) => p.id);

  it("un seul magasin / deux / optimal : couverture et totaux cohérents", async () => {
    const articles = (await ids()).map((produitId: number, i: number) => ({ produitId, quantite: (i % 3) + 1 }));
    const res = (await app.inject({ method: "POST", url: "/paniers/comparer", payload: { ville: "Casablanca", articles } })).json();
    const [un, deux, opt] = res.options;
    expect([un.cle, deux.cle, opt.cle]).toEqual(["un_magasin", "deux_magasins", "optimal"]);
    expect(un.nbMagasins).toBe(1);
    expect(deux.nbMagasins).toBeLessThanOrEqual(2);
    expect(opt.articlesCouverts).toBe(10);
    expect(un.articlesCouverts).toBeLessThanOrEqual(deux.articlesCouverts);
    expect(deux.articlesCouverts).toBeLessThanOrEqual(opt.articlesCouverts);
    // à couverture égale, plus de magasins ne coûte jamais plus cher
    if (deux.articlesCouverts === opt.articlesCouverts) expect(opt.totalMad).toBeLessThanOrEqual(deux.totalMad);
    if (un.articlesCouverts === deux.articlesCouverts) expect(deux.totalMad).toBeLessThanOrEqual(un.totalMad);
    expect(res.recommande).toBe("optimal");
  });
  it("sans données de test : aucune option ne couvre d'article, pas d'erreur", async () => {
    const articles = (await ids()).slice(0, 2).map((produitId: number) => ({ produitId, quantite: 1 }));
    const res = (await appPublic.inject({ method: "POST", url: "/paniers/comparer", payload: { ville: "Casablanca", articles } })).json();
    expect(res.options.every((o: any) => o.articlesCouverts === 0 && o.totalMad === 0)).toBe(true);
  });
  it("validation : panier vide → 400", async () => {
    expect((await app.inject({ method: "POST", url: "/paniers/comparer", payload: { ville: "Casablanca", articles: [] } })).statusCode).toBe(400);
  });
});
