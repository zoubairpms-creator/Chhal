import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { toBase } from "@chhal/matching";
import {
  CATALOGUE, FAMILLES, FAMILLE_DE_PRODUIT, createTestDb, seedBasketFixture, seedButterFixture, seedCatalogue, seedHmizateProducts, type DbHandle,
} from "@chhal/db";

let h: DbHandle;
const rows = (r: unknown) => (r as { rows: any[] }).rows;

beforeAll(async () => {
  h = await createTestDb();
  await seedButterFixture(h.db);
  await seedBasketFixture(h.db);
  await seedCatalogue(h.db);
  await seedHmizateProducts(h.db);
});
afterAll(async () => {
  await h.close();
});

describe("familles : définition", () => {
  it("slugs uniques et valides, classe valide, noms dans les trois langues, alias fr/ar/en", () => {
    expect(new Set(FAMILLES.map((f) => f.slug)).size).toBe(FAMILLES.length);
    expect(FAMILLES.length).toBeGreaterThanOrEqual(60);
    for (const f of FAMILLES) {
      expect(f.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(["masse", "volume", "piece"], f.slug).toContain(f.classe);
      expect(f.nom.fr && f.nom.ar && f.nom.en, f.slug).toBeTruthy();
      expect(new Set(f.alias.map((a) => a.langue)), f.slug).toEqual(expect.objectContaining(new Set(["fr", "ar", "en"])));
    }
  });

  it("le rattrapage ne cite que des familles existantes", () => {
    const slugs = new Set(FAMILLES.map((f) => f.slug));
    for (const [produit, famille] of Object.entries(FAMILLE_DE_PRODUIT)) expect(slugs.has(famille), `${produit} → ${famille}`).toBe(true);
  });

  it("chaque produit du catalogue rattaché à une famille a un format de la MÊME classe", () => {
    const classe = new Map(FAMILLES.map((f) => [f.slug, f.classe]));
    for (const item of CATALOGUE) {
      const fam = FAMILLE_DE_PRODUIT[item.slug];
      if (fam) expect(toBase(item.valeur, item.unite).famille, `${item.slug} (${fam})`).toBe(classe.get(fam));
    }
  });
});

describe("migration 0005 : cohérence avec la source de vérité", () => {
  const sqlText = readFileSync(new URL("../../../packages/db/drizzle/0005_familles.sql", import.meta.url), "utf8");

  it("la migration insère exactement les familles de familles.ts", async () => {
    for (const f of FAMILLES) expect(sqlText, f.slug).toContain(`('${f.slug}',`);
    const inBase = rows(await h.db.execute(sql`SELECT slug, classe FROM families ORDER BY slug`));
    expect(inBase.map((r) => r.slug)).toEqual(FAMILLES.map((f) => f.slug).sort());
    for (const r of inBase) expect(r.classe).toBe(FAMILLES.find((f) => f.slug === r.slug)!.classe);
  });

  it("le rattrapage SQL range les produits existants (sans famille) dans la bonne famille et épargne les autres", async () => {
    await h.db.execute(sql`INSERT INTO products (slug, nom_normalise, nom_affiche, format_valeur, format_unite) VALUES ('riz-long-grain-1kg-bis', 'x', 'Riz test', '1', 'kg'), ('produit-inconnu-xyz', 'y', 'Produit inconnu', '1', 'kg')`);
    await h.db.execute(sql`UPDATE products SET famille = NULL WHERE slug = 'riz-long-grain-1kg'`);
    for (const stmt of sqlText.split("--> statement-breakpoint").map((s) => s.trim()).filter((s) => s.startsWith("UPDATE") && s.includes("IN ("))) await h.db.execute(sql.raw(stmt));
    const get = async (slug: string) => rows(await h.db.execute(sql`SELECT famille FROM products WHERE slug = ${slug}`))[0].famille;
    expect(await get("riz-long-grain-1kg")).toBe("riz");
    expect(await get("produit-inconnu-xyz")).toBeNull();
    expect(await get("riz-long-grain-1kg-bis")).toBeNull(); // slug différent : jamais rattaché par approximation
  });

  it("la contrainte refuse une famille inconnue", async () => {
    await expect(h.db.execute(sql`UPDATE products SET famille = 'famille-fantome' WHERE slug = 'sucre-1kg'`)).rejects.toThrow();
  });

  it("la classe d'une famille est contrainte (masse, volume, piece)", async () => {
    await expect(h.db.execute(sql`INSERT INTO families (slug, nom, categorie, classe) VALUES ('test-mauvais', '{"fr":"a","ar":"b","en":"c"}'::jsonb, 'x', 'poids')`)).rejects.toThrow();
  });
});

describe("données : cohérence de format dans chaque famille", () => {
  it("aucun produit rattaché à une famille n'a un format d'une autre classe (catalogue, relevé, BIM, fixtures)", async () => {
    const all = rows(await h.db.execute(sql`SELECT p.slug, p.famille, p.format_valeur, p.format_unite, f.classe FROM products p JOIN families f ON f.slug = p.famille`));
    expect(all.length).toBeGreaterThan(50);
    for (const p of all) expect(toBase(Number(p.format_valeur), p.format_unite).famille, `${p.slug} → ${p.famille}`).toBe(p.classe);
  });

  it("les produits ambigus ou de classe différente restent SANS famille", async () => {
    const sans = rows(await h.db.execute(sql`SELECT slug FROM products WHERE famille IS NULL`)).map((r) => r.slug);
    for (const slug of ["fromage-portions-x8", "savon-toilette-x4", "levure-boulangere", "cumin-100g", "pack-sauce-tomate-olla", "boisson-nita", "yaourt-brasse-movenpick"]) {
      expect(sans, slug).toContain(slug);
    }
  });
});
