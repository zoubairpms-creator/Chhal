import { describe, expect, it } from "vitest";
import { estFamille, pasDeFamille, toArticles, type BasketItem } from "../lib/basket";

describe("panier : lignes précises et lignes famille", () => {
  const items: BasketItem[] = [
    { produitId: 7, nom: "Sucre", quantite: 2 },
    { famille: "riz", nom: "Riz", quantiteBase: 3, unite: "kg" },
    { famille: "oeufs", nom: "Œufs", quantiteBase: 30, unite: "piece" },
  ];

  it("reconnaît une ligne famille", () => {
    expect(items.map(estFamille)).toEqual([false, true, true]);
  });

  it("produit le corps attendu par l'API pour chaque type de ligne", () => {
    expect(toArticles(items)).toEqual([
      { produitId: 7, quantite: 2 },
      { famille: "riz", quantiteBase: 3, unite: "kg" },
      { famille: "oeufs", quantiteBase: 30, unite: "piece" },
    ]);
  });

  it("pas de quantité : 0,5 kg ou 0,5 L ; 1 pièce", () => {
    expect(pasDeFamille("kg")).toBe(0.5);
    expect(pasDeFamille("l")).toBe(0.5);
    expect(pasDeFamille("piece")).toBe(1);
  });

  it("un ancien panier (lignes précises seules) reste lisible tel quel", () => {
    expect(toArticles([{ produitId: 1, nom: "Beurre", quantite: 1 }])).toEqual([{ produitId: 1, quantite: 1 }]);
  });
});
