import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupByEan, searchByName } from "../src/adapters/openfoodfacts.js";
afterEach(() => vi.unstubAllGlobals());
describe("adaptateur Open Food Facts (contrat hors reseau)", () => {
  it("normalise la reponse produit par EAN", async () => {
    const fetcher = vi.fn(async (_url: string) => Response.json({ status: 1, product: { code: "3017620422003", product_name: "Nutella", brands: "Ferrero", quantity: "400 g" } }));
    vi.stubGlobal("fetch", fetcher);
    expect(await lookupByEan("3017620422003")).toMatchObject({ ean: "3017620422003", product_name: "Nutella", brands: "Ferrero", image_url: null });
    expect(fetcher.mock.calls[0][0]).toContain("/api/v2/product/3017620422003.json");
  });
  it("produit absent ou erreur HTTP : null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: 0 })));
    expect(await lookupByEan("0000000000000")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    expect(await lookupByEan("0000000000000")).toBeNull();
  });
  it("normalise la recherche et encode les termes", async () => {
    const fetcher = vi.fn(async (_url: string) => Response.json({ hits: [{ code: "123", product_name_fr: "Huile d'olive", brands_tags: ["marque"], categories_tags: ["en:olive-oils"] }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await searchByName("huile d olive", 3)).toMatchObject([{ code: "123", product_name: "Huile d'olive", brands: "marque", image_url: null }]);
    expect(fetcher.mock.calls[0][0]).toContain("q=huile%20d%20olive&size=3");
  });
  it("recherche en erreur HTTP : aucun resultat", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429 })));
    expect(await searchByName("huile")).toEqual([]);
  });
});
