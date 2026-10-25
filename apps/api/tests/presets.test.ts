import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CATALOGUE, FAMILLES, PRESETS, createTestDb, lignesAvecFamilles, seedBasketFixture, seedButterFixture, seedCatalogue, seedPresets, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";

const ADMIN = { authorization: "Bearer jeton-presets" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  h = await createTestDb();
  await seedButterFixture(h.db);
  await seedBasketFixture(h.db);
  await seedCatalogue(h.db);
  await seedPresets(h.db);
  app = buildApp(h.db, { adminToken: "jeton-presets", allowTestData: true, today: () => "2026-10-20" });
});
afterAll(async () => {
  await app.close();
  await h.close();
});

describe("Intégrité du catalogue proposé", () => {
  it("slugs uniques, aucun prix, quatre langues d'alias, formats valides", () => {
    const slugs = CATALOGUE.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(50);
    for (const c of CATALOGUE) {
      expect(c.valeur, c.slug).toBeGreaterThan(0);
      expect(new Set(c.alias.map(([, l]) => l)), c.slug).toEqual(new Set(["fr", "ar", "darija", "en"]));
      expect(c.slug, c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
  it("chaque ligne de chaque panier prédéfini est valide : produit du catalogue (quantité entière) ou famille existante (unité de sa classe), sans doublon", () => {
    const known = new Set(CATALOGUE.map((c) => c.slug));
    const famille = new Map(FAMILLES.map((f) => [f.slug, f.classe]));
    const unite = { masse: "kg", volume: "l", piece: "piece" } as const;
    for (const p of PRESETS) {
      const seen = new Set<string>();
      for (const l of p.lignes) {
        const cle = "slug" in l ? l.slug : `famille:${l.famille}`;
        expect(seen.has(cle), `${p.slug}: doublon ${cle}`).toBe(false);
        seen.add(cle);
        if ("slug" in l) {
          expect(known.has(l.slug), `${p.slug}: ${l.slug}`).toBe(true);
          expect(Number.isInteger(l.quantite) && l.quantite > 0, `${p.slug}: ${l.slug}`).toBe(true);
        } else {
          expect(famille.has(l.famille), `${p.slug}: famille ${l.famille}`).toBe(true);
          expect(l.unite, `${p.slug}: ${l.famille}`).toBe(unite[famille.get(l.famille)!]);
          expect(l.quantiteBase >= 0.1 && l.quantiteBase <= 99, `${p.slug}: ${l.famille} ${l.quantiteBase}`).toBe(true);
          if (l.unite === "piece") expect(Number.isInteger(l.quantiteBase), `${p.slug}: ${l.famille}`).toBe(true);
        }
      }
    }
  });
  it("conversion des lignes de base en lignes famille : « 3 × riz 1 kg » = 3 kg, « 2 × farine 5 kg » = 10 kg, « 2 × thé 200 g » = 0,4 kg…", () => {
    const essentiel = PRESETS.find((p) => p.slug === "essentiel")!;
    const f = (famille: string) => essentiel.lignes.find((l) => "famille" in l && l.famille === famille);
    expect(f("riz")).toEqual({ famille: "riz", quantiteBase: 3, unite: "kg" });
    expect(f("farine")).toEqual({ famille: "farine", quantiteBase: 10, unite: "kg" });
    expect(f("the")).toEqual({ famille: "the", quantiteBase: 0.4, unite: "kg" });
    expect(f("pates")).toEqual({ famille: "pates", quantiteBase: 2, unite: "kg" });
    expect(f("concentre-de-tomate")).toEqual({ famille: "concentre-de-tomate", quantiteBase: 1.2, unite: "kg" });
    expect(f("lait")).toEqual({ famille: "lait", quantiteBase: 16, unite: "l" });
    expect(f("oeufs")).toEqual({ famille: "oeufs", quantiteBase: 30, unite: "piece" });
    expect(f("dentifrice")).toEqual({ famille: "dentifrice", quantiteBase: 0.15, unite: "l" });
    expect(f("papier-toilette")).toEqual({ famille: "papier-toilette", quantiteBase: 12, unite: "piece" });
    // un produit SANS famille reste une ligne précise
    expect(essentiel.lignes).toContainEqual({ slug: "savon-toilette-x4", quantite: 1 });
  });
  it("deux produits d'une même famille sont additionnés ; un produit inconnu reste tel quel", () => {
    expect(lignesAvecFamilles([{ slug: "eau-minerale-1-5l", quantite: 2 }, { slug: "eau-minerale-5l", quantite: 1 }])).toEqual([{ famille: "eau", quantiteBase: 8, unite: "l" }]);
    expect(lignesAvecFamilles([{ slug: "produit-inconnu", quantite: 2 }])).toEqual([{ slug: "produit-inconnu", quantite: 2 }]);
    expect(lignesAvecFamilles([])).toEqual([]);
  });
  it("les paniers grossissent avec le niveau : essentiel < budget serré < classe moyenne ≤ confort (articles)", () => {
    const n = (slug: string) => PRESETS.find((p) => p.slug === slug)!.lignes.length;
    expect(n("essentiel")).toBeLessThan(n("mensuel-budget-serre"));
    expect(n("mensuel-budget-serre")).toBeLessThan(n("mensuel-classe-moyenne"));
    expect(n("mensuel-classe-moyenne")).toBeLessThanOrEqual(n("mensuel-confort"));
  });
  it("l'import est idempotent et ne duplique pas les produits des fixtures ; seedPresets met à jour un panier déjà présent", async () => {
    expect(await seedCatalogue(h.db)).toBe(0);
    await seedPresets(h.db);
    await seedPresets(h.db);
    expect((await app.inject({ url: "/paniers-prets" })).json().paniers).toHaveLength(4);
    const huile = (await app.inject({ url: "/produits?q=huile" })).json().resultats.filter((r: any) => /huile de table/i.test(r.nom));
    expect(huile).toHaveLength(1);
  });
});

describe("API paniers prédéfinis", () => {
  it("liste les quatre paniers, marqués indicatifs, noms dans les trois langues", async () => {
    const r = (await app.inject({ url: "/paniers-prets" })).json();
    expect(r.indicatif).toBe(true);
    expect(r.paniers.map((p: any) => p.slug)).toEqual(["essentiel", "mensuel-budget-serre", "mensuel-classe-moyenne", "mensuel-confort"]);
    for (const p of r.paniers) expect(Object.keys(p.nom).sort()).toEqual(["ar", "en", "fr"]);
  });
  it("détail : toutes les lignes résolues (précises et famille), aucune manquante, avertissement présent", async () => {
    for (const p of PRESETS) {
      const r = (await app.inject({ url: `/paniers-prets/${p.slug}` })).json();
      expect(r.manquants, p.slug).toEqual([]);
      expect(r.articles.length + r.lignesFamille.length).toBe(p.lignes.length);
      for (const l of r.lignesFamille) expect(Object.keys(l.nom).sort()).toEqual(["ar", "en", "fr"]);
      expect(r.avertissement).toMatch(/indicatives/);
    }
    expect((await app.inject({ url: "/paniers-prets/inconnu" })).statusCode).toBe(404);
  });
  it("le panier Essentiel se calcule : lignes sans prix signalées, jamais comptées dans le total", async () => {
    const r = (await app.inject({ url: "/paniers-prets/essentiel" })).json();
    const articles = [
      ...r.articles.map((a: any) => ({ produitId: a.produitId, quantite: a.quantite })),
      ...r.lignesFamille.map((l: any) => ({ famille: l.famille, quantiteBase: l.quantiteBase, unite: l.unite })),
    ];
    const out = (await app.inject({ method: "POST", url: "/paniers/optimiser", payload: { ville: "Casablanca", articles } })).json();
    const priced = out.plan.reduce((n: number, p: any) => n + p.articles.length, 0);
    expect(priced).toBeGreaterThan(0);
    expect(priced + out.exclus.length).toBe(articles.length);
    const sum = out.plan.reduce((s: number, p: any) => s + p.articles.reduce((x: number, a: any) => x + a.quantite * a.prixUnitaireMad, 0), 0);
    expect(Math.round(sum * 100) / 100).toBe(out.totalMad);
    expect(out.donneesDeTest).toBe(true);
  });
});

describe("Administration : slug des produits", () => {
  it("slug déduit du nom, doublon refusé (409), slug invalide refusé (400)", async () => {
    const mk = (payload: object) => app.inject({ method: "POST", url: "/admin/produits", headers: ADMIN, payload });
    const base = { nomAffiche: "Épices Ras el hanout 100 g", formatValeur: 100, formatUnite: "g" };
    expect((await mk(base)).statusCode).toBe(201);
    expect((await mk(base)).statusCode).toBe(409);
    expect((await mk({ ...base, slug: "Slug Invalide!" })).statusCode).toBe(400);
  });
});
