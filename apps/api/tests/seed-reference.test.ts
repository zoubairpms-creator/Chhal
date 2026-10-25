import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, priceObservations, products, presetBaskets, chains, sources, stores, seedButterFixture, type DbHandle } from "@chhal/db";
import { seedReference } from "../../../packages/db/src/seed-reference.js";
let h: DbHandle;
beforeAll(async () => { h = await createTestDb(); });
afterAll(async () => { await h.close(); });
describe("initialisation sans fixtures ni effacement", () => {
  it("cree uniquement le catalogue et BIM Casablanca, sans prix ni Carrefour", async () => {
    await seedReference(h.db);
    expect(await h.db.select().from(priceObservations)).toEqual([]);
    expect((await h.db.select().from(products)).length).toBeGreaterThan(40);
    expect((await h.db.select().from(chains)).map(c => c.slug)).toEqual(["bim"]);
    expect(await h.db.select().from(stores)).toHaveLength(1);
    expect(await h.db.select().from(sources)).toMatchObject([{ slug: "hmizate", activee: false, decideeLe: "2026-10-18" }]);
    expect(await h.db.select().from(presetBaskets)).toHaveLength(4);
  });
  it("est idempotente et preserve une composition de panier personnalisee", async () => {
    const before = await h.db.select().from(products);
    await h.db.update(presetBaskets).set({ menage: 9 });
    await seedReference(h.db);
    expect(await h.db.select().from(products)).toEqual(before);
    expect((await h.db.select().from(presetBaskets)).every(p => p.menage === 9)).toBe(true);
    expect(await h.db.select().from(stores)).toHaveLength(1);
  });
  it("preserve integralement les observations existantes", async () => {
    // A separate memory database holds fixtures only for this regression.
    const other = await createTestDb();
    try {
      await seedButterFixture(other.db);
      const before = await other.db.select().from(priceObservations);
      await seedReference(other.db);
      expect(await other.db.select().from(priceObservations)).toEqual(before);
    } finally { await other.close(); }
  });
});
