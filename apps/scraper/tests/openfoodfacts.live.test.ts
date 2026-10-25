import { describe, expect, it } from "vitest";
import { lookupByEan, searchByName } from "../src/adapters/openfoodfacts.js";
// Explicit opt-in only; these checks contact a third party and may fail on service/network availability.
describe.skipIf(process.env.RUN_NETWORK_TESTS !== "1")("Open Food Facts en direct", () => {
  it("trouve Nutella par EAN", async () => {
    expect(await lookupByEan("3017620422003")).toMatchObject({ ean: "3017620422003" });
  });
  it("EAN absent", async () => { expect(await lookupByEan("0000000000000")).toBeNull(); });
  it("recherche par nom", async () => { expect((await searchByName("huile d olive", 3)).length).toBeGreaterThan(0); });
});
