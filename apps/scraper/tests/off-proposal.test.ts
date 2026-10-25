import { describe, expect, it } from "vitest";
import { FAMILLES_OFF } from "../src/off-families.js";
import { buildFamily, buildProposal, imageOff, toCsv, type OffHit } from "../src/off-proposal.js";
import { isValidGtin, parseQuantity } from "../src/quantity.js";

const huile = FAMILLES_OFF.find((f) => f.slug === "huile-de-table")!;
const img = "https://images.openfoodfacts.org/images/products/611/125/865/0504/front_en.3.400.jpg";
const hit = (over: Partial<OffHit> = {}): OffHit => ({ code: "6111258650504", product_name: "Huile de tournesol", brands: ["Marque Test"], quantity: "1 L", categories_tags: ["en:vegetable-oils"], image_front_url: img, ...over });

describe("quantités et codes-barres", () => {
  it("formats usuels, packs et valeurs absurdes", () => {
    expect(parseQuantity("75cl")).toEqual({ valeur: 75, unite: "cl" });
    expect(parseQuantity("1,5 L")).toEqual({ valeur: 1.5, unite: "l" });
    expect(parseQuantity("500 g")).toEqual({ valeur: 500, unite: "g" });
    expect(parseQuantity("6 x 30 g")).toEqual({ valeur: 180, unite: "g" });
    expect(parseQuantity("4×100g")).toEqual({ valeur: 400, unite: "g" });
    expect(parseQuantity("1 litre")).toEqual({ valeur: 1, unite: "l" });
    for (const bad of ["", "beaucoup", "0 g", "9999 kg", null, undefined]) expect(parseQuantity(bad as string), String(bad)).toBeNull();
  });
  it("clé de contrôle GTIN", () => {
    expect(isValidGtin("6111258650504")).toBe(true);
    expect(isValidGtin("3017620422003")).toBe(true); // Nutella
    expect(isValidGtin("6111258650505")).toBe(false);
    expect(isValidGtin("12345")).toBe(false);
    expect(isValidGtin("61112586505AB")).toBe(false);
  });
});

describe("construction d'une famille", () => {
  it("accepte une fiche complète (valider = oui) et lie la fiche Open Food Facts", () => {
    const f = buildFamily(huile, [hit()], new Set());
    expect(f.variantes).toHaveLength(1);
    expect(f.variantes[0]).toMatchObject({ ean: "6111258650504", marque: "Marque Test", valeur: 1, unite: "l", valider: "oui", drapeaux: [], hors611: false });
    expect(f.variantes[0].ficheUrl).toBe("https://world.openfoodfacts.org/product/6111258650504");
  });

  it("rejette avec une raison explicite : EAN invalide ou interne, sans marque, sans format, format incohérent, hors famille, nom suspect, hors alimentaire", () => {
    const hits: OffHit[] = [
      hit({ code: "6111258650505" }), // clé fausse
      hit({ code: "02201023" }), // EAN-8
      hit({ code: "2000000000008" }), // code interne magasin
      hit({ code: "6111245041384", brands: [] }),
      hit({ code: "3017620422003", quantity: undefined }),
      hit({ code: "5449000000996", quantity: "500 g" }), // masse pour une famille « volume »
      hit({ code: "4006381333931", product_name: "Huile d'argan pour cheveux" }),
      hit({ code: "7622210449283", product_name: "- 250ml" }),
      hit({ code: "8000500310427", categories_tags: ["en:beauty", "en:oils"] }),
    ];
    const f = buildFamily(huile, hits, new Set());
    expect(f.variantes).toEqual([]);
    expect(f.rejets.map((r) => r.raison)).toEqual(["ean_invalide", "ean_non_ean13", "ean_interne_magasin", "sans_marque", "sans_format", "format_incoherent", "hors_famille", "nom_suspect", "hors_alimentaire"]);
  });

  it("drapeaux : sans photo, hors préfixe 611, nom court → « a_revoir », jamais importé d'office", () => {
    const f = buildFamily(huile, [hit({ image_front_url: undefined }), hit({ code: "3017620422003", product_name: "Huile", image_front_url: img })], new Set());
    // « Huile » (5 lettres) est accepté mais court ; le second est hors 611
    const a = f.variantes.find((v) => v.ean === "6111258650504")!;
    const b = f.variantes.find((v) => v.ean === "3017620422003")!;
    expect(a.drapeaux).toEqual(["sans_image"]);
    expect(b.drapeaux).toEqual(["hors_611", "nom_court"]);
    expect([a.valider, b.valider]).toEqual(["a_revoir", "a_revoir"]);
  });

  it("doublons : un même code-barres n'apparaît qu'une fois, même entre familles", () => {
    const olive = FAMILLES_OFF.find((f) => f.slug === "huile-d-olive")!;
    const p = buildProposal([{ famille: huile, hits: [hit()] }, { famille: olive, hits: [hit(), hit({ code: "6111245041384", product_name: "Huile d'olive vierge extra", quantity: "50 cl" })] }]);
    expect(p.familles[0].variantes).toHaveLength(1);
    expect(p.familles[1].variantes.map((v) => v.ean)).toEqual(["6111245041384"]);
    expect(p.stats.rejetsParRaison.doublon).toBe(1);
  });

  it("plafond de 25 variantes par famille, les plus complètes d'abord", () => {
    const many = Array.from({ length: 30 }, (_, i) => {
      const body = `611125865${String(i).padStart(3, "0")}`;
      const digits = body.split("").map(Number).reverse();
      const check = (10 - (digits.reduce((s, d, k) => s + d * (k % 2 === 0 ? 3 : 1), 0) % 10)) % 10;
      return hit({ code: body + check, product_name: `Huile numéro ${i}`, image_front_url: i < 5 ? undefined : img });
    });
    const f = buildFamily(huile, many, new Set());
    expect(f.variantes).toHaveLength(25);
    expect(f.rejets.filter((r) => r.raison === "au_dela_du_plafond")).toHaveLength(5);
    expect(f.variantes.slice(0, 25).filter((v) => v.valider === "oui").length).toBe(25); // les 5 sans photo passent en dernier et sont coupés
  });

  it("photos : uniquement HTTPS depuis images.openfoodfacts.org", () => {
    expect(imageOff(img)).toBe(img);
    expect(imageOff("http://images.openfoodfacts.org/x.jpg")).toBeNull();
    expect(imageOff("https://exemple.org/x.jpg")).toBeNull();
    expect(imageOff("https://images.openfoodfacts.org.evil.test/x.jpg")).toBeNull();
    expect(imageOff("pas une url")).toBeNull();
    expect(imageOff(undefined)).toBeNull();
  });
});

describe("fichier de proposition", () => {
  const p = buildProposal([{ famille: huile, hits: [hit(), hit({ code: "3017620422003", product_name: 'Huile "spéciale"; 1ère pression' })] }], new Date("2026-10-17T00:00:00Z"));

  it("mentionne la source, la licence et l'attribution ; statistiques cohérentes", () => {
    expect(p.licence.photos).toMatch(/CC BY-SA|ShareAlike/);
    expect(p.licence.attribution).toMatch(/Open Food Facts/);
    expect(p.stats.variantes).toBe(2);
    expect(p.stats.oui + p.stats.aRevoir).toBe(p.stats.variantes);
  });

  it("CSV : BOM, séparateur « ; », guillemets échappés, une ligne par variante", () => {
    const csv = toCsv(p);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.split("\n").filter(Boolean); // pas de trim() : il retirerait le BOM
    expect(lines[0]).toBe("﻿valider;famille;ean;nom;marque;format_valeur;format_unite;categorie;image_url;fiche_off;drapeaux");
    expect(lines).toHaveLength(3);
    expect(csv).toContain('"Huile ""spéciale""; 1ère pression"');
  });

  it("ne contient aucune donnée personnelle ni secret", () => {
    const text = JSON.stringify(p) + toCsv(p);
    expect(text).not.toMatch(/@|token|authorization|password/i);
  });
});

/** EAN-13 valide à partir de 12 chiffres. */
const ean13 = (body12: string) => {
  const d = body12.split("").map(Number).reverse();
  return body12 + ((10 - (d.reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0) % 10)) % 10);
};

describe("pertinence : la recherche d'Open Food Facts est large, la proposition ne l'est pas", () => {
  const olive = FAMILLES_OFF.find((f) => f.slug === "huile-d-olive")!;
  const eau = FAMILLES_OFF.find((f) => f.slug === "eau")!;

  it("une « eau de table » n'est pas une huile de table, mais elle est bien dans la famille eau", () => {
    const water = hit({ code: ean13("611225242157"), product_name: "Eau de table Aquafina", brands: ["Aquafina"], quantity: "50 cl", categories_tags: ["en:beverages", "en:waters"] });
    expect(buildFamily(huile, [water], new Set()).rejets.map((r) => r.raison)).toEqual(["hors_famille"]);
    expect(buildFamily(eau, [water], new Set()).variantes).toHaveLength(1);
  });

  it("une huile d'olive va dans la famille olive, pas dans l'huile de table", () => {
    const oo = hit({ code: ean13("611124504138"), product_name: "Huile d'olive vierge extra", categories_tags: ["en:olive-oils"] });
    expect(buildFamily(huile, [oo], new Set()).rejets.map((r) => r.raison)).toEqual(["hors_famille"]);
    expect(buildFamily(olive, [oo], new Set()).variantes).toHaveLength(1);
  });

  it("fromage dans la famille pâtes, café dans la famille thé : refusés", () => {
    const pates = FAMILLES_OFF.find((f) => f.slug === "pates")!;
    const the = FAMILLES_OFF.find((f) => f.slug === "the")!;
    const cheese = hit({ code: ean13("611245341460"), product_name: "Emmental", brands: ["Or blanc"], quantity: "100 g", categories_tags: ["en:cheeses"] });
    const coffee = hit({ code: ean13("611207001678"), product_name: "Cappuccino", brands: ["Dubois"], quantity: "225 g", categories_tags: ["en:coffees"] });
    expect(buildFamily(pates, [cheese], new Set()).variantes).toEqual([]);
    expect(buildFamily(the, [coffee], new Set()).variantes).toEqual([]);
  });

  it("« petit beurre » (biscuit) n'est pas du beurre ; une crème pour bébé n'est pas de la crème fraîche", () => {
    const beurre = FAMILLES_OFF.find((f) => f.slug === "beurre")!;
    const creme = FAMILLES_OFF.find((f) => f.slug === "creme-fraiche")!;
    const pb = hit({ code: ean13("611000000011"), product_name: "Petit beurre", brands: ["Bé"], quantity: "300 g", categories_tags: ["en:biscuits"] });
    const bebe = hit({ code: ean13("611000000022"), product_name: "bebe jhonson", brands: ["creme"], quantity: "100 ml", categories_tags: ["en:creams"] });
    expect(buildFamily(beurre, [pb], new Set()).variantes).toEqual([]);
    expect(buildFamily(creme, [bebe], new Set()).variantes).toEqual([]);
  });

  it("marque démesurée (probable erreur de saisie) : signalée « a_revoir »", () => {
    const f = buildFamily(huile, [hit({ brands: ["Eau minérale naturelle des Montagnes d'Atlas et autres"] })], new Set());
    expect(f.variantes[0].drapeaux).toContain("marque_suspecte");
    expect(f.variantes[0].valider).toBe("a_revoir");
  });

  it("format absent du champ quantité mais lisible dans le nom : retenu, signalé « à revoir »", () => {
    const f = buildFamily(huile, [hit({ code: ean13("611125865099"), product_name: "Huile Soleil 1 L", quantity: undefined })], new Set());
    expect(f.variantes).toHaveLength(1);
    expect(f.variantes[0]).toMatchObject({ valeur: 1, unite: "l", valider: "a_revoir" });
    expect(f.variantes[0].drapeaux).toContain("format_lu_dans_le_nom");
  });
});
