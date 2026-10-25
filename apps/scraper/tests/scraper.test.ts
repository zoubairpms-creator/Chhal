import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseModele, parsePrice, parseSize } from "../src/adapters/modele.js";
import { BlockedError, RateLimiter, USER_AGENT, cachedGet, isAllowed, type Fetcher } from "../src/politeness.js";
import { run } from "../src/run.js";

const html = await readFile(new URL("../fixtures/modele.html", import.meta.url), "utf8");

describe("analyse du HTML figé", () => {
  it("extrait les relevés lisibles, ignore le prix illisible (jamais null)", () => {
    const r = parseModele(html);
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ libelle: "Beurre Centrale 100% frais 1 kg", prixMad: 79.95, valeur: 1, unite: "kg", ean: "6111000000011", marque: "Centrale" });
    expect(r[1]).toMatchObject({ prixMad: 21.5, valeur: 1, unite: "l" });
    expect(r[2]).toMatchObject({ prixMad: 12, valeur: 75, unite: "cl" });
    expect(r.some((x) => x.libelle.includes("illisible"))).toBe(false);
  });
  it("formats de taille et de prix", () => {
    expect(parseSize("500g")).toEqual({ valeur: 500, unite: "g" });
    expect(parseSize("1,5 L")).toEqual({ valeur: 1.5, unite: "l" });
    expect(parseSize("rien")).toBeNull();
    expect(parsePrice("1 079,00 DH")).toBe(1079);
    expect(parsePrice("—")).toBeNull();
    expect(parsePrice("79,95 DH")).toBe(79.95);
  });
});

describe("politesse", () => {
  it("impose au moins 2 secondes entre requêtes", async () => {
    let t = 1_000_000;
    const waits: number[] = [];
    const limiter = new RateLimiter(2000, () => t, async (ms) => { waits.push(ms); t += ms; });
    await limiter.wait();
    t += 500;
    await limiter.wait();
    expect(waits).toEqual([1500]);
  });
  it("robots.txt : interdit → refus ; inaccessible → refus ; autorisé → ok", async () => {
    const mk = (status: number, body: string): Fetcher => async () => ({ status, text: async () => body });
    expect(await isAllowed("https://exemple.test/produits", mk(200, "User-agent: *\nDisallow: /produits"))).toBe(false);
    expect(await isAllowed("https://exemple.test/produits", mk(404, ""))).toBe(false);
    expect(await isAllowed("https://exemple.test/produits", mk(200, "User-agent: *\nAllow: /"))).toBe(true);
  });
  it("cache : la 2e lecture ne fait aucune requête ; User-Agent identifiable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "chhal-cache-"));
    const fetcher = vi.fn<Fetcher>(async () => ({ status: 200, text: async () => "<html/>" }));
    const limiter = new RateLimiter(0);
    const a = await cachedGet("https://exemple.test/a", { dir, ttlHours: 1, fetcher, limiter });
    const b = await cachedGet("https://exemple.test/a", { dir, ttlHours: 1, fetcher, limiter });
    expect([a.fromCache, b.fromCache]).toEqual([false, true]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].headers["user-agent"]).toBe(USER_AGENT);
  });
  it("403 → BlockedError, sans contournement", async () => {
    const dir = await mkdtemp(join(tmpdir(), "chhal-cache-"));
    const fetcher: Fetcher = async () => ({ status: 403, text: async () => "" });
    await expect(cachedGet("https://exemple.test/b", { dir, ttlHours: 1, fetcher, limiter: new RateLimiter(0) })).rejects.toBeInstanceOf(BlockedError);
  });
});

describe("tâche quotidienne", () => {
  it("sans SCRAPE_CONFIRM=1 : aucun scraping réel", async () => {
    expect(await run({} as NodeJS.ProcessEnv)).toEqual({ skipped: true });
  });
});
