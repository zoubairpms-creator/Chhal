import { describe, expect, it } from "vitest";
import { arabiziKey, comparable, matchProduct, normalize, searchAliases, unitPrice } from "../src/index.js";

const aliases = [
  { productId: 1, texte: "Huile de table", langue: "fr" },
  { productId: 1, texte: "زيت", langue: "ar" },
  { productId: 1, texte: "zit", langue: "darija" },
  { productId: 1, texte: "oil", langue: "en" },
  { productId: 2, texte: "Beurre", langue: "fr" },
  { productId: 2, texte: "زبدة", langue: "ar" },
  { productId: 2, texte: "zebda", langue: "darija" },
];

describe("normalize", () => {
  it("retire accents et voyelles arabes", () => {
    expect(normalize("Crème  Fraîche!")).toBe("creme fraiche");
    expect(normalize("زُبْدَة")).toBe(normalize("زبدة"));
  });
});

describe("recherche d'alias", () => {
  it("trouve par FR, AR, EN", () => {
    expect(searchAliases("beurre", aliases)[0].productId).toBe(2);
    expect(searchAliases("زيت", aliases)[0].productId).toBe(1);
    expect(searchAliases("oil", aliases)[0].productId).toBe(1);
  });
  it("accepte l'arabizi : zit, zeit, zayt → huile", () => {
    for (const q of ["zit", "zeit", "zayt"]) expect(searchAliases(q, aliases)[0]?.productId).toBe(1);
    expect(searchAliases("zebda", aliases)[0].productId).toBe(2);
  });
  it("ne renvoie rien pour une requête vide ou inconnue", () => {
    expect(searchAliases("", aliases)).toEqual([]);
    expect(searchAliases("xyzxyz", aliases)).toEqual([]);
  });
  it("clé phonétique stable", () => {
    expect(arabiziKey("zit")).toBe(arabiziKey("zeit"));
  });
});

describe("unités", () => {
  it("prix au kg et au litre", () => {
    expect(unitPrice(45, 500, "g")).toMatchObject({ prix: 90, par: "kg" });
    expect(unitPrice(12, 75, "cl")).toMatchObject({ prix: 16, par: "l" });
  });
  it("refuse de comparer masse et volume", () => {
    expect(comparable({ valeur: 1, unite: "kg" }, { valeur: 1, unite: "l" })).toBe(false);
    expect(comparable({ valeur: 1000, unite: "g" }, { valeur: 1, unite: "kg" })).toBe(true);
  });
});

describe("appariement", () => {
  const catalog = [{ id: 7, ean: "611", marque: "Centrale", valeur: 1, unite: "kg" as const, nom: "Beurre frais" }];
  it("EAN → certain", () => {
    expect(matchProduct({ ean: "611", valeur: 1000, unite: "g", nom: "x" }, catalog).kind).toBe("certain");
  });
  it("un EAN identique avec format contradictoire exige une validation",()=>{expect(matchProduct({ean:"611",valeur:9,unite:"g",nom:"x"},catalog)).toMatchObject({kind:"incertain",productId:7});});
  it("marque + format + nom → certain (1000 g = 1 kg)", () => {
    expect(matchProduct({ marque: "centrale", valeur: 1000, unite: "g", nom: "beurre frais" }, catalog)).toMatchObject({
      kind: "certain",
      productId: 7,
    });
  });
  it("partiel → incertain, jamais automatique", () => {
    expect(matchProduct({ marque: "Centrale", valeur: 1000, unite: "g", nom: "beurre doux" }, catalog).kind).toBe("incertain");
  });
});
