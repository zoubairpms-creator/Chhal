import { describe, expect, it } from "vitest";
import { resolveFamilyLine, type VariantOffer } from "../src/familles.js";

const REF = "2026-10-20";
const o = (produitId: number, valeur: number, unite: VariantOffer["unite"], prixMad: number, storeId = 1, dateReleve = "2026-10-18", marque: string | null = "M"): VariantOffer => ({
  produitId, nom: `Produit ${produitId}`, marque, valeur, unite, storeId, prixMad, dateReleve, source: "manuel",
});
const run = (quantiteBase: number, offers: VariantOffer[], classe: "masse" | "volume" | "piece" = "volume", maxAgeDays = 30) =>
  resolveFamilyLine({ classe, quantiteBase, offers, referenceDate: REF, maxAgeDays });

/** Recalcul INDÉPENDANT : boucle explicite, aucune formule partagée avec l'implémentation. */
function brute(quantiteBase: number, classe: string, offers: VariantOffer[], storeId: number) {
  const need = classe === "piece" ? quantiteBase : quantiteBase * 1000;
  let best: { cost: number; id: number; surplus: number } | null = null;
  for (const x of offers.filter((v) => v.storeId === storeId)) {
    const size = x.unite === "kg" || x.unite === "l" ? x.valeur * 1000 : x.unite === "cl" ? x.valeur * 10 : x.valeur; // g, ml ou pièce
    let n = 1;
    while (n * size < need - 1e-6) n++;
    const cost = Math.round(n * x.prixMad * 100);
    const surplus = n * size - need;
    if (!best || cost < best.cost || (cost === best.cost && (surplus < best.surplus - 1e-6 || (Math.abs(surplus - best.surplus) < 1e-6 && x.produitId < best.id)))) best = { cost, id: x.produitId, surplus };
  }
  return best;
}

describe("ligne famille : paquets entiers", () => {
  const huile = [o(1, 1, "l", 20), o(2, 5, "l", 92), o(3, 2, "l", 38)];

  it("exemple du plan : 5 L → la bouteille de 5 L (92 MAD) bat 5 × 1 L (100 MAD) et 3 × 2 L (114 MAD)", () => {
    const c = run(5, huile).choices.get(1)!;
    expect(c).toMatchObject({ produitId: 2, nbPaquets: 1, quantiteAchetee: 5, surplus: 0, totalMad: 92, prixPaquetMad: 92 });
  });

  it("surplus affiché : 6 L → 2 × 5 L = 184, 3 × 2 L = 114 (surplus 0), 6 × 1 L = 120 → 3 × 2 L", () => {
    const c = run(6, huile).choices.get(1)!;
    expect(c).toMatchObject({ produitId: 3, nbPaquets: 3, quantiteAchetee: 6, surplus: 0, totalMad: 114 });
  });

  it("quantité non multiple : 3 L → 3 × 1 L = 60 (surplus 0) ; 2 × 2 L = 76 ; 1 × 5 L = 92 → 3 × 1 L", () => {
    expect(run(3, huile).choices.get(1)).toMatchObject({ produitId: 1, nbPaquets: 3, totalMad: 60, surplus: 0 });
  });

  it("quand le surplus est inévitable, il est chiffré : 0,5 L → 1 × 1 L, surplus 0,5 L", () => {
    expect(run(0.5, [o(1, 1, "l", 20)]).choices.get(1)).toMatchObject({ nbPaquets: 1, quantiteAchetee: 1, surplus: 0.5, totalMad: 20 });
  });

  it("pas d'erreur d'arrondi flottant : 3 kg avec des paquets de 1 kg = 3 paquets, pas 4", () => {
    expect(run(3, [o(1, 1, "kg", 10)], "masse").choices.get(1)).toMatchObject({ nbPaquets: 3, totalMad: 30, surplus: 0 });
    expect(run(0.3, [o(1, 100, "g", 5)], "masse").choices.get(1)).toMatchObject({ nbPaquets: 3, totalMad: 15 });
  });

  it("formats mélangés (g, kg, cl, l) comparés dans la même unité de base", () => {
    // 1 kg : 2 × 500 g = 16 MAD, 1 × 1 kg = 14 MAD → le kilo
    expect(run(1, [o(1, 500, "g", 8), o(2, 1, "kg", 14)], "masse").choices.get(1)).toMatchObject({ produitId: 2, nbPaquets: 1, totalMad: 14 });
    // 0,25 L = 25 cl : 1 × 25 cl à 4 MAD bat 1 × 1 L à 12 MAD
    expect(run(0.25, [o(1, 25, "cl", 4), o(2, 1, "l", 12)]).choices.get(1)).toMatchObject({ produitId: 1, nbPaquets: 1, totalMad: 4, surplus: 0 });
  });
});

describe("ligne famille : déterminisme, magasins, fraîcheur", () => {
  it("égalité de coût : surplus le plus faible, puis identifiant le plus petit", () => {
    // 2 L : A 1 L à 10 (2 paquets, surplus 0) ; B 2 L à 20 (surplus 0) ; C 3 L à 20 (surplus 1) → A, B, C coûtent 20 ; A et B ex æquo → id le plus petit
    const c = run(2, [o(7, 3, "l", 20), o(5, 2, "l", 20), o(4, 1, "l", 10)]).choices.get(1)!;
    expect(c.produitId).toBe(4);
    expect(run(2, [o(7, 3, "l", 20), o(5, 2, "l", 20)]).choices.get(1)!.produitId).toBe(5); // surplus 0 contre surplus 1
  });

  it("un choix par magasin, indépendant d'un magasin à l'autre", () => {
    const r = run(1, [o(1, 1, "l", 25, 1), o(2, 1, "l", 22, 1), o(3, 1, "l", 19, 2), o(1, 1, "l", 28, 2)]).choices;
    expect([r.get(1)!.produitId, r.get(1)!.totalMad]).toEqual([2, 22]);
    expect([r.get(2)!.produitId, r.get(2)!.totalMad]).toEqual([3, 19]);
  });

  it("prix périmés ignorés ; si TOUT est périmé : aucun choix mais l'offre existe (« périmé », pas « introuvable »)", () => {
    const r = run(1, [o(1, 1, "l", 10, 1, "2026-08-01"), o(2, 1, "l", 30, 1, "2026-10-19")]);
    expect(r.choices.get(1)!.produitId).toBe(2); // le moins cher est périmé : écarté
    const stale = run(1, [o(1, 1, "l", 10, 1, "2026-08-01")]);
    expect(stale.choices.size).toBe(0);
    expect(stale.hasAnyOffer).toBe(true);
    expect(run(1, []).hasAnyOffer).toBe(false);
  });

  it("offres d'une autre classe de format ignorées (jamais de comparaison masse/volume)", () => {
    const r = run(1, [o(1, 1, "kg", 5), o(2, 1, "l", 30)], "volume");
    expect(r.choices.get(1)!.produitId).toBe(2);
    expect(run(1, [o(1, 1, "kg", 5)], "volume").hasAnyOffer).toBe(false);
  });

  it("pièces : 60 œufs avec des plateaux de 30 = 2 plateaux", () => {
    expect(run(60, [o(1, 30, "piece", 40), o(2, 12, "piece", 18)], "piece").choices.get(1)).toMatchObject({ produitId: 1, nbPaquets: 2, totalMad: 80, quantiteAchetee: 60 });
  });
});

describe("ligne famille : recalcul indépendant sur de nombreux cas", () => {
  it("le choix et le coût égalent la force brute pour 200 combinaisons de quantités, formats et prix", () => {
    const formats: [number, VariantOffer["unite"]][] = [[250, "g"], [500, "g"], [1, "kg"], [2, "kg"], [5, "kg"]];
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 200; i++) {
      const offers = formats.filter(() => rnd() > 0.3).map(([v, u], k) => o(k + 1, v, u, Math.round((5 + rnd() * 60) * 100) / 100));
      if (!offers.length) continue;
      const q = Math.round((0.2 + rnd() * 12) * 10) / 10;
      const got = run(q, offers, "masse").choices.get(1)!;
      const want = brute(q, "masse", offers, 1)!;
      expect({ cout: Math.round(got.totalMad * 100), id: got.produitId }, `q=${q}`).toEqual({ cout: want.cost, id: want.id });
    }
  });
});
