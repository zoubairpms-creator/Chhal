import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb, seedButterFixture, rattraperCatalogue, chains, observationReviews, priceObservations, rawData, stores, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";

let h: DbHandle;
let app: ReturnType<typeof buildApp>;
let butterId: number;
let bimStoreId: number;

const OPTS = {
  chainSlug: "bim",
  source: { slug: "hmizate", nom: "hmizate.ma", url: "https://hmizate.ma", type: "catalogue-tiers", decisionJuridique: "acceptee_par_le_porteur", decideeLe: "2026-10-18" },
  articleUrl: "https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1085",
  html: "<html><article>fictif</article></html>",
  fetchedAt: new Date("2026-10-17T19:20:00Z"),
  parserVersion: "test",
  dateReleve: "2026-09-01",
  validFrom: "2026-09-01",
  validUntil: null,
  validityStatus: "inconnue" as const,
  motif: "test",
};

beforeAll(async () => {
  h = await createTestDb();
  butterId = (await seedButterFixture(h.db)).productId;
  const [s] = await h.db.select({ id: stores.id }).from(stores).innerJoin(chains, eq(chains.id, stores.chainId)).where(eq(chains.slug, "bim"));
  bimStoreId = s.id;
  const [o] = await h.db.insert(priceObservations).values({ productId: butterId, storeId: bimStoreId, prixMad: "81.00", dateReleve: "2026-09-01", source: "catalogue", confiance: "moyenne" }).returning();
  await h.db.insert(observationReviews).values({ observationId: o.id, decision: "publie", reviewer: "test" });
  app = buildApp(h.db, { adminToken: "jeton-trace", today: () => "2026-10-20" });
});
afterAll(async () => {
  await app.close();
  await h.close();
});

const prixBim = async () => (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=bim` })).json().resultats;

describe("migration 0006 + rattrapage des prix de catalogue", () => {
  it("avant : la ligne n'a aucune traçabilité", async () => {
    const [o] = await h.db.select().from(priceObservations).where(eq(priceObservations.storeId, bimStoreId));
    expect(o.validFrom).toBeNull();
    expect(o.rawDataId).toBeNull();
  });

  it("enrichit sans modifier : ancienne ligne rejetée, nouvelle publiée avec URL, validité et donnée brute", async () => {
    const r = await rattraperCatalogue(h.db, OPTS);
    expect(r.remplaces).toHaveLength(1);
    const [nv] = await h.db.select().from(priceObservations).where(eq(priceObservations.id, r.remplaces[0].nouveau));
    expect(nv).toMatchObject({ prixMad: "81.00", validFrom: "2026-09-01", validUntil: null, validityStatus: "inconnue", sourceUrl: OPTS.articleUrl, devise: "MAD" });
    expect(nv.observedAt?.toISOString()).toBe("2026-10-17T19:20:00.000Z");
    expect(nv.rawDataId).not.toBeNull();
    const raw = await h.db.select().from(rawData);
    expect(raw).toHaveLength(1);
    expect(raw[0].hashSha256).toMatch(/^[0-9a-f]{64}$/);
    // l'API ne montre qu'un seul prix BIM (pas de doublon)
    // Validité inconnue : conservée en historique, exclue du classement actuel.
    expect(await prixBim()).toHaveLength(0);
  });

  it("idempotent : un second passage ne crée rien", async () => {
    const r = await rattraperCatalogue(h.db, OPTS);
    expect(r.remplaces).toHaveLength(0);
    expect(await h.db.select().from(rawData)).toHaveLength(1);
  });

  it("l'historique est conservé (rien n'est supprimé ni modifié) et le trigger d'immutabilité reste actif", async () => {
    const toutes = await h.db.select().from(priceObservations).where(eq(priceObservations.storeId, bimStoreId));
    expect(toutes).toHaveLength(2);
    await expect(h.db.execute(sql`UPDATE price_observations SET prix_mad = 1 WHERE store_id = ${bimStoreId}`)).rejects.toThrow();
  });

  it("un prix dont la validité est dépassée n'apparaît plus (ni « le moins cher »)", async () => {
    const [s] = await h.db.select({ id: stores.id }).from(stores).innerJoin(chains, eq(chains.id, stores.chainId)).where(eq(chains.slug, "atacadao"));
    const avant = (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=atacadao` })).json().resultats;
    expect(avant).toHaveLength(1);
    const [o] = await h.db.insert(priceObservations).values({ productId: butterId, storeId: s.id, prixMad: "1.00", dateReleve: "2026-10-18", source: "catalogue", confiance: "moyenne", validFrom: "2026-08-26", validUntil: "2026-09-02", validityStatus: "connue" }).returning();
    await h.db.insert(observationReviews).values({ observationId: o.id, decision: "publie", reviewer: "test" });
    const apres = (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=atacadao` })).json().resultats;
    expect(apres).toMatchObject([{prixMad:90}]);
    const tous = (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca` })).json().resultats;
    expect(tous.every((p: { prixMad: number }) => p.prixMad !== 1)).toBe(true);
  });

  it("refuse une validité incohérente (fin avant début) et un statut inconnu", async () => {
    const base = { productId: butterId, storeId: bimStoreId, prixMad: "5.00", dateReleve: "2026-09-02", source: "catalogue" as const, confiance: "moyenne" as const };
    await expect(h.db.insert(priceObservations).values({ ...base, validFrom: "2026-09-10", validUntil: "2026-09-01" })).rejects.toThrow();
    await expect(h.db.insert(priceObservations).values({ ...base, validityStatus: "bientot" })).rejects.toThrow();
  });
});

describe("ingestion hmizate : donnée brute, activation, essai à blanc, doublons", () => {
  const ADMIN = { authorization: "Bearer jeton-trace" };
  const post = (url: string, payload: object) => app.inject({ method: "POST", url, payload, headers: ADMIN });
  const patch = (url: string, payload: object) => app.inject({ method: "PATCH", url, payload, headers: ADMIN });
  const releve = { libelle: "Beurre Centrale 100% frais 1 kg", marque: "Centrale", valeur: 1, unite: "kg", enseigne: "supeco", ville: "Casablanca", prixMad: 83, dateReleve: "2026-09-01", source: "catalogue" };
  const tr = (extra: object = {}) => ({ sourceSlug: "hmizate", sourceUrl: OPTS.articleUrl, observedAt: "2026-09-02T10:00:00Z", validFrom: "2026-09-01", validUntil: "2026-09-08", validityStatus: "estimee", ...extra });
  let rawId: number;

  it("donnée brute : stockée une fois, même contenu → même identifiant", async () => {
    const body = { sourceSlug: "hmizate", url: OPTS.articleUrl, html: "<article>brut</article>", fetchedAt: "2026-09-02T10:00:00Z", parserVersion: "t" };
    const a = await post("/admin/sources/brut", body);
    const b = await post("/admin/sources/brut", body);
    expect(a.statusCode).toBe(201);
    expect(b.json().rawDataId).toBe(a.json().rawDataId);
    rawId = a.json().rawDataId;
    expect((await post("/admin/sources/brut", { ...body, sourceSlug: "inconnue" })).statusCode).toBe(404);
  });

  it("essai à blanc : possible sur source non activée, n'écrit rien", async () => {
    const r = await post("/admin/scraping/releves", { releves: [releve], tracabilite: tr(), essaiABlanc: true });
    expect(r.json()).toMatchObject({ essaiABlanc: true, publies: 1 });
    const n = await h.db.select().from(priceObservations).where(eq(priceObservations.sourceUrl, OPTS.articleUrl));
    expect(n.filter((o) => o.collectionMethod === "scraping")).toHaveLength(0);
  });

  it("écriture réelle refusée tant que la source n'est pas activée explicitement", async () => {
    const r = await post("/admin/scraping/releves", { releves: [releve], tracabilite: tr() });
    expect(r.statusCode).toBe(409);
  });

  it("activation refusée sans décision consignée, acceptée sinon", async () => {
    await h.db.execute(sql`INSERT INTO sources (slug, nom, url, type) VALUES ('sans-decision','x','https://x.example','t')`);
    expect((await patch("/admin/sources/sans-decision", { activee: true })).statusCode).toBe(409);
    expect((await patch("/admin/sources/hmizate", { activee: true })).statusCode).toBe(200);
  });

  it("ingestion réelle : observation tracée et publiée ; second passage = doublon ignoré ; job journalisé", async () => {
    const r = await post("/admin/scraping/releves", { releves: [releve], tracabilite: tr({ rawDataId: rawId }) });
    expect(r.json()).toMatchObject({ publies: 1, doublons: 0 });
    const [o] = await h.db.select().from(priceObservations).where(eq(priceObservations.collectionMethod, "scraping"));
    expect(o).toMatchObject({ validFrom: "2026-09-01", validUntil: "2026-09-08", validityStatus: "estimee", sourceUrl: OPTS.articleUrl, rawDataId: rawId, devise: "MAD" });
    const again = await post("/admin/scraping/releves", { releves: [releve], tracabilite: tr({ rawDataId: rawId }) });
    expect(again.json()).toMatchObject({ publies: 0, doublons: 1 });
    expect(((await h.db.execute(sql`SELECT count(*)::int AS n FROM import_jobs`)) as any).rows[0]).toMatchObject({ n: 2 });
  });

  it("validité incohérente refusée (400)", async () => {
    const r = await post("/admin/scraping/releves", { releves: [releve], tracabilite: tr({ validUntil: "2026-08-01" }) });
    expect(r.statusCode).toBe(400);
  });
});
