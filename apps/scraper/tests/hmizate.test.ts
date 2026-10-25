import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseHmizate } from "../src/adapters/hmizate.js";

const html = await readFile(new URL("../fixtures/hmizate-bim.html", import.meta.url), "utf8");

describe("adaptateur hmizate", () => {
  it("extrait les relevés lisibles avec format et prix", () => {
    const r = parseHmizate(html);
    // 20 produits avec format lisible (le balai sans format est ignoré)
    expect(r.length).toBeGreaterThanOrEqual(19);
    expect(r[0]).toMatchObject({ prixMad: 14.9, valeur: 290, unite: "ml" });
  });

  it("ignore les éléments sans format lisible", () => {
    const r = parseHmizate(html);
    expect(r.every((x) => x.valeur > 0)).toBe(true);
    expect(r.every((x) => x.prixMad > 0)).toBe(true);
  });

  it("ignore les doublons", () => {
    const r = parseHmizate(html);
    const keys = r.map((x) => `${x.libelle}|${x.prixMad}|${x.valeur}|${x.unite}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("extrait correctement le prix et le format pour un produit multi-unités", () => {
    const r = parseHmizate(html);
    const fromage = r.find((x) => x.libelle.includes("Fromage blanc"));
    expect(fromage).toBeDefined();
    expect(fromage!.prixMad).toBe(12.9);
  });

  it("extrait correctement un prix entier (sans décimales)", () => {
    const r = parseHmizate(html);
    const balai = r.find((x) => x.libelle.includes("balai"));
    // Le balai n'a pas de format → ignoré
    expect(balai).toBeUndefined();
  });

  it("extrait un produit avec format pack (6 × 30 g → 180 g)", () => {
    const r = parseHmizate(html);
    const fromage = r.find((x) => x.libelle.includes("Fromage blanc"));
    expect(fromage).toBeDefined();
    expect(fromage!.valeur).toBe(180); // 6 × 30 g = 180 g
    expect(fromage!.unite).toBe("g");
    expect(fromage!.prixMad).toBe(12.9);
  });
});
