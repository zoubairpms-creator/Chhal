import { describe, expect, it } from "vitest";
import { parseCsvLine, parseValidatedCsv } from "../src/off-import.js";
import { buildProposal, toCsv } from "../src/off-proposal.js";
import { FAMILLES_OFF } from "../src/off-families.js";

const HEAD = "valider;famille;ean;nom;marque;format_valeur;format_unite;categorie;image_url;fiche_off;drapeaux";
const row = (o: Record<string, string> = {}) =>
  [o.valider ?? "oui", o.famille ?? "huile-de-table", o.ean ?? "6111258650504", o.nom ?? "Huile Soleil", o.marque ?? "Soleil", o.v ?? "1", o.u ?? "l", o.cat ?? "epicerie", o.img ?? "", o.fiche ?? "", ""].join(";");

describe("lecture du CSV validé", () => {
  it("lignes entre guillemets, guillemets doublés, point-virgule dans un nom", () => {
    expect(parseCsvLine('oui;a;"Huile ""spéciale""; 1ère";b')).toEqual(["oui", "a", 'Huile "spéciale"; 1ère', "b"]);
  });

  it("seules les lignes « oui » sont retenues (insensible à la casse et aux espaces) ; non, a_revoir et vide ignorés", () => {
    const r = parseValidatedCsv(["﻿" + HEAD, row({ valider: "oui" }), row({ valider: " OUI " }), row({ valider: "non" }), row({ valider: "a_revoir" }), row({ valider: "" })].join("\n"));
    expect(r.erreurs).toEqual([]);
    expect(r.variantes).toHaveLength(2);
    expect(r.ignores).toBe(3);
  });

  it("format décimal à virgule, photo absente → null, fiche absente → undefined", () => {
    const r = parseValidatedCsv([HEAD, row({ v: "1,5" })].join("\n"));
    expect(r.variantes[0]).toMatchObject({ valeur: 1.5, imageUrl: null, ficheUrl: undefined, unite: "l" });
  });

  it("colonne absente, fichier vide, format illisible : erreurs claires, rien d'importé", () => {
    expect(parseValidatedCsv("").erreurs[0].message).toMatch(/vide/);
    expect(parseValidatedCsv("valider;ean\noui;1").erreurs.map((e) => e.message).join(" ")).toMatch(/Colonne absente : famille/);
    const bad = parseValidatedCsv([HEAD, row({ v: "abc" })].join("\n"));
    expect(bad.variantes).toEqual([]);
    expect(bad.erreurs[0]).toMatchObject({ ligne: 2 });
  });

  it("aller-retour : le CSV produit par la proposition est relu à l'identique", () => {
    const huile = FAMILLES_OFF.find((f) => f.slug === "huile-de-table")!;
    const img = "https://images.openfoodfacts.org/images/products/611/125/865/0504/front_en.3.400.jpg";
    const p = buildProposal([{ famille: huile, hits: [{ code: "6111258650504", product_name: 'Huile "extra"; pure', brands: ["Soleil"], quantity: "1 L", categories_tags: ["en:vegetable-oils"], image_front_url: img }] }]);
    const r = parseValidatedCsv(toCsv(p));
    expect(r.erreurs).toEqual([]);
    expect(r.variantes).toEqual([{ famille: "huile-de-table", ean: "6111258650504", nom: 'Huile "extra"; pure', marque: "Soleil", valeur: 1, unite: "l", categorie: "epicerie", imageUrl: img, ficheUrl: "https://world.openfoodfacts.org/product/6111258650504" }]);
  });
});
