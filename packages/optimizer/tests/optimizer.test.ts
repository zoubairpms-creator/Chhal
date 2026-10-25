import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSION, MAX_SUBSETS, OptimizerLimitError, countSubsets, optimize, type Offer } from "../src/index.js";

// Fixture FICTIVE : 10 articles, 4 magasins (ids 1..4), prix inventés pour les tests.
const REF = "2026-10-20";
const PRICES: Record<number, number[]> = {
  // produit: [m1, m2, m3, m4] (0 = absent)
  1: [10.0, 9.5, 11.0, 0],
  2: [20.0, 22.0, 18.5, 19.0],
  3: [5.0, 0, 4.2, 4.2],
  4: [30.0, 28.0, 0, 29.0],
  5: [12.5, 12.5, 12.5, 12.5],
  6: [8.0, 7.0, 9.0, 6.5],
  7: [15.0, 14.0, 16.0, 0],
  8: [3.0, 3.5, 2.8, 3.2],
  9: [50.0, 0, 47.0, 49.0],
  10: [6.0, 5.5, 0, 5.0],
};
const offers: Offer[] = Object.entries(PRICES).flatMap(([p, arr]) =>
  arr.flatMap((prix, i) => (prix > 0 ? [{ productId: Number(p), storeId: i + 1, prixMad: prix, dateReleve: "2026-10-17", source: "fixture" }] : [])),
);
const items = Object.keys(PRICES).map((p, i) => ({ productId: Number(p), quantity: (i % 3) + 1 }));

/** Recalcul indépendant : force brute sur tous les sous-ensembles, sans réutiliser le code de l'optimiseur. */
function bruteForce(maxStores: number | null) {
  const stores = [1, 2, 3, 4];
  let best = Infinity;
  for (let mask = 1; mask < 1 << stores.length; mask++) {
    const subset = stores.filter((_, i) => mask & (1 << i));
    if (maxStores !== null && subset.length > maxStores) continue;
    let total = 0;
    let covered = 0;
    for (const it of items) {
      const prices = subset.map((s) => PRICES[it.productId][s - 1]).filter((x) => x > 0);
      if (prices.length) {
        total += Math.min(...prices) * it.quantity;
        covered++;
      }
    }
    if (covered === items.length) best = Math.min(best, Math.round(total * 100));
  }
  return best / 100;
}

describe("optimiseur — panier fixture de 10 articles", () => {
  it("sans limite : total = recalcul indépendant et ≤ meilleur mono-magasin", () => {
    const r = optimize({ items, offers, referenceDate: REF });
    expect(r.totalMad).toBe(bruteForce(null));
    expect(r.bestSingleStore).not.toBeNull();
    expect(r.totalMad).toBeLessThanOrEqual(r.bestSingleStore!.totalMad);
    expect(r.savingsMad).toBeGreaterThanOrEqual(0);
    expect(r.plan.length).toBeGreaterThanOrEqual(3);
    expect(r.algorithmVersion).toBe(ALGORITHM_VERSION);
  });

  it("limite k : total = force brute pour k = 1, 2, 3", () => {
    for (const k of [1, 2, 3]) {
      const r = optimize({ items, offers, referenceDate: REF, maxStores: k });
      expect(r.plan.length).toBeLessThanOrEqual(k);
      if (r.excluded.length === 0) expect(r.totalMad).toBe(bruteForce(k));
    }
  });

  it("le total est la somme des sous-totaux, eux-mêmes sommes de quantité × prix", () => {
    const r = optimize({ items, offers, referenceDate: REF, maxStores: 2 });
    const recomputed = r.plan.reduce((s, st) => s + st.lines.reduce((x, l) => x + l.quantity * l.prixUnitaireMad, 0), 0);
    expect(Math.round(recomputed * 100) / 100).toBe(r.totalMad);
  });

  it("une offre future ne finance jamais un panier actuel",()=>{const r=optimize({items:[{productId:1,quantity:1}],offers:[{productId:1,storeId:1,prixMad:1,dateReleve:"2026-10-30",source:"catalogue"}],referenceDate:REF});expect(r.plan).toEqual([]);expect(r.totalMad).toBe(0);});
  it("reproductible : même entrée, même sortie", () => {
    const a = optimize({ items, offers, referenceDate: REF, maxStores: 2 });
    const b = optimize({ items: [...items].reverse(), offers: [...offers].reverse(), referenceDate: REF, maxStores: 2 });
    expect(b).toEqual(a);
  });

  it("égalité de coût : ordre lexicographique des identifiants", () => {
    const tie: Offer[] = [
      { productId: 1, storeId: 5, prixMad: 10, dateReleve: "2026-10-17", source: "fixture" },
      { productId: 1, storeId: 2, prixMad: 10, dateReleve: "2026-10-17", source: "fixture" },
      { productId: 1, storeId: 9, prixMad: 10, dateReleve: "2026-10-17", source: "fixture" },
    ];
    for (const k of [null, 1, 2]) {
      const r = optimize({ items: [{ productId: 1, quantity: 1 }], offers: tie, referenceDate: REF, maxStores: k });
      expect(r.plan.map((p) => p.storeId)).toEqual([2]);
    }
  });

  it("signale introuvable et périmé, hors total", () => {
    const old: Offer = { productId: 99, storeId: 1, prixMad: 5, dateReleve: "2026-01-01", source: "manuel" };
    const r = optimize({
      items: [...items, { productId: 99, quantity: 1 }, { productId: 100, quantity: 1 }],
      offers: [...offers, old],
      referenceDate: REF,
      maxAgeDays: 30,
    });
    expect(r.excluded).toEqual(expect.arrayContaining([{ productId: 99, reason: "perime" }, { productId: 100, reason: "introuvable" }]));
    expect(r.totalMad).toBe(bruteForce(null));
  });

  it("enseignes exclues", () => {
    const r = optimize({ items, offers, referenceDate: REF, excludedStoreIds: [3] });
    expect(r.plan.some((p) => p.storeId === 3)).toBe(false);
  });

  it("garde-fou : refus explicite au-delà du seuil", () => {
    expect(countSubsets(4, 2)).toBe(10);
    expect(countSubsets(30, 3)).toBe(4525);
    const many: Offer[] = Array.from({ length: 60 }, (_, i) => ({ productId: 1, storeId: i + 1, prixMad: 10 + i, dateReleve: "2026-10-17", source: "fixture" }));
    expect(() => optimize({ items: [{ productId: 1, quantity: 1 }], offers: many, referenceDate: REF, maxStores: 5 })).toThrow(OptimizerLimitError);
    expect(MAX_SUBSETS).toBe(20_000);
  });

  it("panier vide ou sans prix : résultat vide sans erreur", () => {
    const r = optimize({ items: [{ productId: 1, quantity: 1 }], offers: [], referenceDate: REF });
    expect(r.plan).toEqual([]);
    expect(r.totalMad).toBe(0);
    expect(r.bestSingleStore).toBeNull();
  });
});
