import {makeTrace} from "./fixtures-source.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, seedButterFixture, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";

const ADMIN = { authorization: "Bearer jeton-provenance" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;
let butterId: number;

beforeAll(async () => {
  h = await createTestDb();
  butterId = (await seedButterFixture(h.db)).productId;
  app = buildApp(h.db, { adminToken: "jeton-provenance", today: () => "2026-10-20" });
});
afterAll(async () => {
  await app.close();
  await h.close();
});

const post = (url: string, payload: object, headers: Record<string, string> = ADMIN) => app.inject({ method: "POST", url, payload, headers });
const get = (url: string) => app.inject({ url, headers: ADMIN });
const prix = async (enseigne: string) => (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=${enseigne}` })).json().resultats;

describe("ingestion : la source « catalogue » est conservée", () => {
  it("un relevé certain avec source catalogue est publié en source catalogue, confiance moyenne, à la date du catalogue", async () => {
    const r = await post("/admin/scraping/releves", {
      tracabilite:await makeTrace(h.db,"2026-09-01"), releves: [{ libelle: "Beurre Centrale 100% frais 1 kg", marque: "Centrale", valeur: 1000, unite: "g", enseigne: "kazyon", ville: "Casablanca", prixMad: 83, dateReleve: "2026-09-01", source: "catalogue" }],
    });
    expect(r.json()).toEqual({ publies: 1, enAttente: 0, ignores: 0,doublons:0 });
    expect(await prix("kazyon")).toHaveLength(0);
    const historical=(await app.inject({url:`/produits/${butterId}/historique?ville=Casablanca&enseigne=kazyon`})).json().points;
    expect(historical[0]).toMatchObject({prixMad:83,source:"catalogue",dateReleve:"2026-09-01"});
  });
  it("sans source : scraping par défaut ; source inconnue refusée (400)", async () => {
    const base = { libelle: "Beurre Centrale 100% frais 1 kg", marque: "Centrale", valeur: 1, unite: "kg", enseigne: "supeco", ville: "Casablanca", prixMad: 85, dateReleve: "2026-09-02" };
    await post("/admin/scraping/releves", { releves: [base],tracabilite:await makeTrace(h.db,"2026-09-02") });
    expect(await prix("supeco")).toHaveLength(0);
    expect((await app.inject({url:`/produits/${butterId}/historique?ville=Casablanca&enseigne=supeco`})).json().points[0].source).toBe("scraping");
    expect((await post("/admin/scraping/releves", { releves: [{ ...base, source: "manuel" }] })).statusCode).toBe(400);
  });
});

describe("re-catégorisation de provenance (append-only)", () => {
  let oldId: number;

  it("prépare un prix publié à tort en « manuel, haute » et le retrouve par l'audit", async () => {
    const created = await post("/admin/observations", { produitId: butterId, enseigne: "carrefour", ville: "Casablanca", prixMad: 99.9, dateReleve: "2026-09-01" });
    expect(created.statusCode).toBe(201);
    oldId = created.json().id;
    const list = (await get("/admin/observations/publiees?source=manuel&enseigne=carrefour&date=2026-09-01")).json().observations;
    expect(list.map((o: any) => o.id)).toContain(oldId);
    expect(list.find((o: any) => o.id === oldId)).toMatchObject({ enseigne: "Carrefour", prixMad: 99.9, source: "manuel", confiance: "haute" });
  });

  it("remplace : même prix et même date, source catalogue, confiance moyenne ; l'ancienne disparaît des prix", async () => {
    const r = await post("/admin/observations/recategoriser", { ids: [oldId], source: "catalogue", confiance: "moyenne", motif: "prix issus d'un article tiers" });
    expect(r.statusCode).toBe(200);
    const [{ ancien, nouveau }] = r.json().remplaces;
    expect(ancien).toBe(oldId);
    expect(nouveau).not.toBe(oldId);
    // Le prix courant reste celui du relevé le plus RÉCENT (octobre) : le catalogue de septembre ne le supplante pas.
    expect((await prix("carrefour"))[0]).toMatchObject({ prixMad: 107.95, source: "fixture", dateReleve: "2026-10-17" });
    const hist = (await app.inject({ url: `/produits/${butterId}/historique?ville=Casablanca&enseigne=carrefour` })).json().points;
    expect(hist.filter((p: any) => p.dateReleve === "2026-09-01")).toEqual([{ enseigne: "Carrefour", prixMad: 99.9, dateReleve: "2026-09-01", source: "catalogue" }]);
    expect((await get("/admin/observations/publiees?source=manuel&enseigne=carrefour&date=2026-09-01")).json().observations).toEqual([]);
  });

  it("l'historique est conservé : l'ancienne observation existe toujours avec ses deux avis (publié puis rejeté)", async () => {
    const obs = await h.db.execute(sql`SELECT source, confiance FROM price_observations WHERE id = ${oldId}`);
    expect((obs as unknown as { rows: any[] }).rows[0]).toMatchObject({ source: "manuel", confiance: "haute" });
    const reviews = await h.db.execute(sql`SELECT decision, motif FROM observation_reviews WHERE observation_id = ${oldId} ORDER BY id`);
    const rows = (reviews as unknown as { rows: any[] }).rows;
    expect(rows.map((x) => x.decision)).toEqual(["publie", "rejete"]);
    expect(rows[1].motif).toMatch(/Provenance corrigée/);
  });

  it("refus : observation déjà remplacée ou inconnue → 409, et tout ou rien (rien n'est modifié)", async () => {
    expect((await post("/admin/observations/recategoriser", { ids: [oldId], source: "catalogue", confiance: "moyenne", motif: "deuxième essai" })).statusCode).toBe(409);
    const fresh = (await post("/admin/observations", { produitId: butterId, enseigne: "marjane", ville: "Casablanca", prixMad: 81, dateReleve: "2026-09-03" })).json().id;
    const r = await post("/admin/observations/recategoriser", { ids: [fresh, 999999], source: "catalogue", confiance: "moyenne", motif: "essai mixte" });
    expect(r.statusCode).toBe(409);
    expect(r.json().erreur).toMatch(/999999/);
    const still = (await get("/admin/observations/publiees?source=manuel&enseigne=marjane&date=2026-09-03")).json().observations;
    expect(still.map((o: any) => o.id)).toContain(fresh);
  });

  it("validation et sécurité : corps invalide → 400, sans jeton → 401", async () => {
    expect((await post("/admin/observations/recategoriser", { ids: [], source: "catalogue", confiance: "moyenne", motif: "x" })).statusCode).toBe(400);
    expect((await post("/admin/observations/recategoriser", { ids: [1], source: "inconnue", confiance: "moyenne", motif: "motif valide" })).statusCode).toBe(400);
    expect((await post("/admin/observations/recategoriser", { ids: [1], source: "catalogue", confiance: "moyenne", motif: "motif valide" }, {})).statusCode).toBe(401);
    expect((await app.inject({ url: "/admin/observations/publiees" })).statusCode).toBe(401);
  });
});
