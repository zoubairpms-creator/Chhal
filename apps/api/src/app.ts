import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { gzipSync } from "node:zlib";
import { and, asc, desc, eq, gte, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import {
  carts, chains, families, historySelect, importJobs, matchCandidates, observationReviews, presetBaskets, priceObservations, priceSelect,
  productAliases, products, rawData, sources, stores, type Db,
} from "@chhal/db";
import { isOffImageUrl, isValidGtin, matchProduct, searchAliases, toBase, unitPrice, type Unite } from "@chhal/matching";
import { ALGORITHM_VERSION, optimize, OptimizerLimitError, type Offer } from "@chhal/optimizer";
import { z } from "zod";
import { currentPrices, cutoff, moroccoToday, priceMeta } from "./prices.js";
import { ingest, decideCandidate } from "./ingestion.js";
import { parseOcrPrice } from "./ocr.js";
import { checkDate, parsePrix, parseReleves, type ImportError } from "./csvImport.js";
import { UNITE_DE_CLASSE, resolveFamilyLine, type Classe, type VariantOffer } from "./familles.js";

export type AppOptions = {
  adminToken?: string;
  /** Inclut les prix test_only (dev/démo). Les réponses sont alors marquées donneesDeTest. */
  allowTestData?: boolean;
  today?: () => string;
  corsOrigin?: string;
  /** Derrière un proxy (Render, Vercel…), pour que le limiteur voie la vraie IP du visiteur. */
  trustProxy?: boolean;
  /** Active HSTS (à n'utiliser que derrière HTTPS). */
  hsts?: boolean;
};

const unites = ["g", "kg", "ml", "cl", "l", "piece"] as const;
const langues = ["fr", "ar", "darija", "en"] as const;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Ligne précise : un produit, une quantité de paquets. */
const precisSchema = z.object({ produitId: z.number().int().positive(), quantite: z.number().int().min(1).max(99) });
/** Ligne famille : « n'importe quelle marque », quantité en kg, litres ou pièces (selon la classe de la famille). */
const familleSchema = z
  .object({ famille: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), quantiteBase: z.number().min(0.1).max(99), unite: z.enum(["kg", "l", "piece"]) })
  .refine((l) => l.unite !== "piece" || Number.isInteger(l.quantiteBase), "Une quantité en pièces doit être un entier.");
type PrecisLine = z.infer<typeof precisSchema>;
type FamilleLine = z.infer<typeof familleSchema>;
const estFamille = (a: PrecisLine | FamilleLine): a is FamilleLine => "famille" in a;

const basketSchema = z.object({
  ville: z.string().min(1),
  articles: z.array(z.union([precisSchema, familleSchema])).min(1).max(50),
  maxMagasins: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().default(null),
  enseignesExclues: z.array(z.string()).default([]),
  ageMaxJours: z.number().int().min(1).max(365).default(30),
});

/** Écart en % face à l'enseigne la plus chère (0 pour la plus chère). Entrée triée du moins cher au plus cher. */
export function withGap<T>(sorted: T[], value: (x: T) => number = (x) => (x as unknown as { prixMad: number }).prixMad): (T & { rang: number; ecartVsPlusCherPct: number })[] {
  const max = sorted.length ? value(sorted[sorted.length - 1]) : 0;
  return sorted.map((x, i) => ({ ...x, rang: i + 1, ecartVsPlusCherPct: max > 0 ? Math.round(((max - value(x)) / max) * 1000) / 10 : 0 }));
}

type ResolvedFamily = {
  pseudoId: number;
  slug: string;
  nom: { fr: string; ar: string; en: string };
  classe: Classe;
  quantiteBase: number;
  unite: string;
  choices: Map<number, import("./familles.js").FamilyChoice>;
  hasAnyOffer: boolean;
};

/** Quantité lisible : « 1,5 L », « 5 kg », « 12 pièces ». */
export function libelleQte(q: number, unite: string) {
  const n = String(Math.round(q * 1000) / 1000).replace(".", ",");
  return unite === "l" ? `${n} L` : unite === "piece" ? `${n} ${q > 1 ? "pièces" : "pièce"}` : `${n} ${unite}`;
}

/** Photo d'un produit avec sa mention de licence ; la fiche d'origine est extraite de la mention. */
function imageOf(p: { imageUrl: string | null; imageCredit: string | null }) {
  if (!p.imageUrl) return null;
  const fiche = p.imageCredit?.match(/https?:\/\/\S+$/)?.[0] ?? null;
  return { url: p.imageUrl, credit: p.imageCredit?.replace(/\s*—\s*https?:\/\/\S+$/, "") ?? null, ficheUrl: fiche };
}

const erreur = (reply: FastifyReply, code: number, message: string) => reply.code(code).send({ erreur: message });

export function buildApp(db: Db, opts: AppOptions = {}) {
  const root = Fastify({ logger: false, trustProxy: opts.trustProxy ?? false });
  const today = opts.today ?? moroccoToday;
  const includeTest = !!opts.allowTestData;
  const priceSelect = currentPrices(db, opts.today ? today() : sql`(now() AT TIME ZONE 'Africa/Casablanca')::date`, includeTest);
  const testFilter = (age = 30) => gte(priceSelect.dateReleve, cutoff(today(), age));

  root.register(cors, { origin: opts.corsOrigin ?? true });
  root.register(rateLimit, { global: false });

  root.addHook("onSend", async (_req, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cross-origin-resource-policy", "cross-origin");
    if (opts.hsts) reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    return payload;
  });

  root.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof z.ZodError) return erreur(reply, 400, "Requête invalide : " + err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; "));
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return erreur(reply, status, status === 429 ? "Trop de requêtes, réessayez plus tard." : err.message);
    console.error(err);
    return erreur(reply, 500, "Erreur interne du serveur.");
  });

  // Les routes sont déclarées dans un plugin enregistré APRÈS le limiteur : sinon la config rateLimit des routes est ignorée.
  root.register(async (app) => {
  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async (_req, reply) => {
    try {
      await db.execute(sql`SELECT valid_until, ingestion_key FROM price_observations LIMIT 0`);
      await db.execute(sql`SELECT payload FROM match_candidates LIMIT 0`);
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false, erreur: "Base indisponible ou migrations non appliquees." });
    }
  });

  app.get("/accueil", async(req)=>{
    const {ville}=z.object({ville:z.string().optional()}).parse(req.query);
    const offers=await db.select({produitId:priceSelect.productId,produit:products.nomAffiche,formatValeur:products.formatValeur,formatUnite:products.formatUnite,
      prixMad:priceSelect.prixMad,dateReleve:priceSelect.dateReleve,source:priceSelect.source,enseigne:chains.nom,ville:stores.ville,
      validFrom:priceSelect.validFrom,validUntil:priceSelect.validUntil,validityStatus:priceSelect.validityStatus,sourceUrl:priceSelect.sourceUrl,observedAt:priceSelect.observedAt})
      .from(priceSelect).innerJoin(products,eq(products.id,priceSelect.productId)).innerJoin(stores,eq(stores.id,priceSelect.storeId)).innerJoin(chains,eq(chains.id,stores.chainId))
      .where(and(testFilter(),eq(chains.actif,true),ville?sql`lower(${stores.ville}) = lower(${ville})`:undefined)).orderBy(desc(priceSelect.dateReleve),products.id);
    const enseignes=[...new Set(offers.map(o=>o.enseigne))];
    const upcoming=await db.select({id:priceObservations.id,validFrom:priceObservations.validFrom,validUntil:priceObservations.validUntil,produit:products.nomAffiche,enseigne:chains.nom})
      .from(priceObservations).innerJoin(products,eq(products.id,priceObservations.productId)).innerJoin(stores,eq(stores.id,priceObservations.storeId)).innerJoin(chains,eq(chains.id,stores.chainId))
      .where(and(sql`${priceObservations.validFrom} > ${today()}`,eq(chains.actif,true),includeTest?undefined:eq(priceObservations.testOnly,false),
      sql`(SELECT r.decision FROM observation_reviews r WHERE r.observation_id = ${priceObservations.id} ORDER BY r.id DESC LIMIT 1) = 'publie'`,
      ville?sql`lower(${stores.ville}) = lower(${ville})`:undefined)).limit(10);
    return {dateReference:today(),nbPrix:offers.length,nbProduits:new Set(offers.map(o=>o.produitId)).size,enseignes,comparaisonPossible:enseignes.length>=2,
      derniereObservation:offers.reduce<string|null>((v,o)=>o.observedAt&&(!v||o.observedAt.toISOString()>v)?o.observedAt.toISOString():v,null),
      offres:offers.slice(0,12).map(o=>({...o,prixMad:Number(o.prixMad),...priceMeta(o)})),aVenir:upcoming};
  });

  // ---------- Référentiels ----------
  app.get("/villes", async () => {
    const rows = await db.selectDistinct({ ville: stores.ville }).from(stores).orderBy(asc(stores.ville));
    return { villes: rows.map((r) => r.ville) };
  });
  app.get("/enseignes", async () => {
    const rows = await db.select().from(chains).where(eq(chains.actif, true)).orderBy(asc(chains.id));
    return { enseignes: rows.map((c) => ({ slug: c.slug, nom: c.nom, nomAr: c.nomAr })) };
  });

  // ---------- Recherche : cartes produit (resultats) + regroupement par famille (groupes, isoles) ----------
  app.get("/produits", async (req) => {
    const q = z.object({ q: z.string().max(10000).optional(), ville: z.string().optional(), enseigne: z.string().optional(), categorie: z.string().optional(), avecPrix:z.enum(["1","0"]).optional(), promotions:z.enum(["1","0"]).optional(),inclureSansPrix:z.enum(["1","0"]).optional() }).parse(req.query);
    const cats = q.categorie ? q.categorie.split(",") : null;
    const prods = (await db.select().from(products)).filter((p) => !cats || cats.includes(p.categorie ?? ""));
    const allowed = new Set(prods.map((p) => p.id));
    const byId = new Map(prods.map((p) => [p.id, p]));
    const aliasRows = (await db.select().from(productAliases)).filter((a) => allowed.has(a.productId));
    const aliases = [
      ...aliasRows.map((a) => ({ productId: a.productId, texte: a.texte, langue: a.langue })),
      ...prods.map((p) => ({ productId: p.id, texte: p.nomAffiche, langue: "fr" })),
      ...prods.filter(p=>p.ean).map(p=>({productId:p.id,texte:p.ean!,langue:"ean"})),
    ];
    const hits = q.q?.trim() ? searchAliases(q.q, aliases, 30) : prods.slice(0, 50).map((p) => ({ productId: p.id, score: 0, via: p.nomAffiche }));
    const hitById = new Map(hits.map((h) => [h.productId, h]));

    // Familles concernées : celles des produits trouvés, et celles dont un nom ou un alias correspond à la recherche (« zit » → Huile de table).
    const famRows = await db.select().from(families);
    const famBySlug = new Map(famRows.map((f) => [f.slug, f]));
    const famScore = new Map<string, number>();
    for (const h of hits) {
      const f = byId.get(h.productId)?.famille;
      if (f) famScore.set(f, Math.max(famScore.get(f) ?? 0, h.score));
    }
    if (q.q?.trim()) {
      const famAliases = famRows.flatMap((f, i) => [
        ...f.alias.map((a) => ({ productId: i, texte: a.texte, langue: a.langue as string })),
        ...Object.values(f.nom).map((texte) => ({ productId: i, texte, langue: "fr" })),
      ]);
      for (const h of searchAliases(q.q, famAliases, 10)) {
        const slug = famRows[h.productId].slug;
        famScore.set(slug, Math.max(famScore.get(slug) ?? 0, h.score));
      }
    }
    const variantsOf = (slug: string) => prods.filter((p) => p.famille === slug);
    const ids = [...new Set([...hits.map((h) => h.productId), ...[...famScore.keys()].flatMap((slug) => variantsOf(slug).map((p) => p.id))])];

    const prices = ids.length
      ? await db
          .select({ productId: priceSelect.productId, prixMad: priceSelect.prixMad, dateReleve: priceSelect.dateReleve, source: priceSelect.source, ...{validFrom:priceSelect.validFrom,validUntil:priceSelect.validUntil,validityStatus:priceSelect.validityStatus,sourceUrl:priceSelect.sourceUrl,observedAt:priceSelect.observedAt,confianceMotif:priceSelect.confianceMotif}, enseigne: chains.nom, slug: chains.slug, ville: stores.ville })
          .from(priceSelect)
          .innerJoin(stores, eq(stores.id, priceSelect.storeId))
          .innerJoin(chains, eq(chains.id, stores.chainId))
          .where(and(inArray(priceSelect.productId, ids), testFilter(), eq(chains.actif, true)))
      : [];
    const filtered = q.avecPrix === "1" || q.promotions === "1" || (q.inclureSansPrix !== "1" && !!(q.ville || q.enseigne));
    const pricesOf = (productId: number) =>
      prices.filter((x) => x.productId === productId && (!q.ville || x.ville.toLowerCase() === q.ville.toLowerCase()) && (!q.enseigne || x.slug === q.enseigne) && (q.promotions !== "1" || x.source === "catalogue"));

    const hitFor = (p: (typeof prods)[number], score: number, via: string) => {
      const sorted = [...pricesOf(p.id)].sort((a, b) => Number(a.prixMad) - Number(b.prixMad));
      const best = sorted[0];
      const top3 = withGap(sorted.map((c) => ({ enseigne: c.enseigne, prixMad: Number(c.prixMad), dateReleve: String(c.dateReleve), source: c.source, ...priceMeta(c) }))).slice(0, 3);
      return {
        id: p.id,
        nom: p.nomAffiche,
        marque: p.marque,
        categorie: p.categorie,
        famille: p.famille,
        image: imageOf(p),
        format: `${Number(p.formatValeur)} ${p.formatUnite}`,
        score,
        trouvePar: via,
        top3,
        nbEnseignes: sorted.length,
        meilleurPrix: best ? { enseigne: best.enseigne, prixMad: Number(best.prixMad), dateReleve: String(best.dateReleve), source: best.source } : null,
      };
    };

    const resultats = hits.map((h) => hitFor(byId.get(h.productId)!, h.score, h.via)).filter((r) => !filtered || r.meilleurPrix);

    const groupes = [...famScore.entries()]
      .map(([slug, score]) => {
        const fam = famBySlug.get(slug);
        if (!fam) return null;
        const items = variantsOf(slug).map((p) => {
          const h = hitById.get(p.id);
          return { p, hit: hitFor(p, h?.score ?? 0, h?.via ?? p.nomAffiche) };
        });
        const visibles = filtered ? items.filter((x) => x.hit.meilleurPrix) : items;
        if (filtered && visibles.length === 0) return null;
        // Comparaison au prix par kg, par litre ou par pièce : la famille garantit une même classe de format.
        const cands = visibles.flatMap(({ p }) =>
          pricesOf(p.id).map((c) => {
            const u = unitPrice(Number(c.prixMad), Number(p.formatValeur), p.formatUnite as Unite);
            return {
              produitId: p.id, produit: p.nomAffiche, marque: p.marque, format: `${Number(p.formatValeur)} ${p.formatUnite}`, enseigne: c.enseigne,
              prixMad: Number(c.prixMad), prixUnitaire: u.prix, par: u.par, dateReleve: String(c.dateReleve), source: c.source, ...priceMeta(c),
            };
          }),
        );
        cands.sort((a, b) => a.prixUnitaire - b.prixUnitaire || a.prixMad - b.prixMad || a.produitId - b.produitId);
        const top3 = withGap(cands, (x) => x.prixUnitaire).slice(0, 3);
        const bestUnit = new Map<number, number>();
        for (const c of cands) if (!bestUnit.has(c.produitId)) bestUnit.set(c.produitId, c.prixUnitaire);
        const variantes = [...visibles]
          .sort((a, b) => (bestUnit.get(a.p.id) ?? Infinity) - (bestUnit.get(b.p.id) ?? Infinity) || a.p.nomAffiche.localeCompare(b.p.nomAffiche))
          .map(({ p, hit }) => ({ ...hit, meilleurPrixUnitaire: bestUnit.has(p.id) ? { prix: bestUnit.get(p.id)!, par: top3[0]?.par ?? null } : null }));
        return {
          famille: slug, nom: fam.nom, classe: fam.classe, categorie: fam.categorie, score,
          nbVariantes: items.length, nbVariantesAvecPrix: items.filter((x) => x.hit.meilleurPrix).length,
          meilleurPrixUnitaire: top3[0] ?? null, top3, variantes,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => b.score - a.score || b.nbVariantesAvecPrix - a.nbVariantesAvecPrix || a.nom.fr.localeCompare(b.nom.fr));

    return { dateReference:today(), resultats, groupes, isoles: resultats.filter((r) => !r.famille) };
  });

  app.get("/familles", async (req) => {
    const q = z.object({ ville: z.string().optional() }).parse(req.query);
    const famRows = await db.select().from(families).orderBy(asc(families.slug));
    const prods = await db.select({ id: products.id, famille: products.famille }).from(products);
    const priced = await db
      .selectDistinct({ productId: priceSelect.productId })
      .from(priceSelect)
      .innerJoin(stores, eq(stores.id, priceSelect.storeId))
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(and(testFilter(), eq(chains.actif, true), q.ville ? sql`lower(${stores.ville}) = lower(${q.ville})` : undefined));
    const pricedSet = new Set(priced.map((r) => r.productId));
    return {
      familles: famRows.map((f) => {
        const v = prods.filter((p) => p.famille === f.slug);
        return { slug: f.slug, nom: f.nom, classe: f.classe, categorie: f.categorie, nbVariantes: v.length, nbVariantesAvecPrix: v.filter((p) => pricedSet.has(p.id)).length };
      }),
    };
  });

  app.get("/produits/:id/prix", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const q = z.object({ ville: z.string().min(1), enseigne: z.string().optional() }).safeParse(req.query);
    if (!Number.isInteger(id) || !q.success) return erreur(reply, 400, "Requête invalide : produit et ville obligatoires.");
    const [produit] = await db.select().from(products).where(eq(products.id, id));
    if (!produit) return erreur(reply, 404, "Produit introuvable.");
    const rows = await db
      .select({
        enseigne: chains.nom, enseigneAr: chains.nomAr, ville: stores.ville, prixMad: priceSelect.prixMad,
        dateReleve: priceSelect.dateReleve, source: priceSelect.source, confiance: priceSelect.confiance, testOnly: priceSelect.testOnly, validFrom:priceSelect.validFrom,validUntil:priceSelect.validUntil,validityStatus:priceSelect.validityStatus,sourceUrl:priceSelect.sourceUrl,observedAt:priceSelect.observedAt,confianceMotif:priceSelect.confianceMotif,
      })
      .from(priceSelect)
      .innerJoin(stores, eq(stores.id, priceSelect.storeId))
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(
        and(
          eq(priceSelect.productId, id), testFilter(), eq(chains.actif, true),
          sql`lower(${stores.ville}) = lower(${q.data.ville})`,
          q.data.enseigne ? eq(chains.slug, q.data.enseigne) : undefined,
        ),
      )
      .orderBy(asc(priceSelect.prixMad), asc(chains.id));
    const u = (prix: number) => unitPrice(prix, Number(produit.formatValeur), produit.formatUnite as Unite);
    return {
      produit: { id: produit.id, nom: produit.nomAffiche, format: `${Number(produit.formatValeur)} ${produit.formatUnite}`, famille: produit.famille, image: imageOf(produit) },
      ville: q.data.ville,dateReference:today(),
      resultats: withGap(
        rows.map((r) => ({
          enseigne: r.enseigne, enseigneAr: r.enseigneAr, ville: r.ville, prixMad: Number(r.prixMad),
          prixUnitaire: u(Number(r.prixMad)), dateReleve: String(r.dateReleve), source: r.source, confiance: r.confiance,
          donneesDeTest: r.testOnly, ...priceMeta(r),
        })),
      ),
    };
  });

  app.get("/produits/:id/historique", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const q = z.object({ ville: z.string().min(1), enseigne: z.string().optional() }).safeParse(req.query);
    if (!Number.isInteger(id) || !q.success) return erreur(reply, 400, "Requête invalide : produit et ville obligatoires.");
    const [produit] = await db.select().from(products).where(eq(products.id, id));
    if (!produit) return erreur(reply, 404, "Produit introuvable.");
    const rows = await db
      .select({ enseigne: chains.nom, prixMad: historySelect.prixMad, dateReleve: historySelect.dateReleve, source: historySelect.source, chainId: chains.id })
      .from(historySelect)
      .innerJoin(stores, eq(stores.id, historySelect.storeId))
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(
        and(
          eq(historySelect.productId, id), includeTest ? undefined : eq(historySelect.testOnly, false), sql`${historySelect.dateReleve} <= ${today()}`,
          sql`lower(${stores.ville}) = lower(${q.data.ville})`,
          q.data.enseigne ? eq(chains.slug, q.data.enseigne) : undefined,
        ),
      )
      .orderBy(asc(historySelect.dateReleve), asc(chains.id));
    return {
      produit: { id: produit.id, nom: produit.nomAffiche },
      ville: q.data.ville,
      points: rows.map((r) => ({ enseigne: r.enseigne, prixMad: Number(r.prixMad), dateReleve: String(r.dateReleve), source: r.source })),
    };
  });

  // ---------- Panier ----------
  const libelleVariante = (p: { nomAffiche: string; marque: string | null }) =>
    p.marque && !p.nomAffiche.toLowerCase().includes(p.marque.toLowerCase()) ? `${p.nomAffiche} — ${p.marque}` : p.nomAffiche;

  /**
   * Lignes « n'importe quelle marque » : pour chaque magasin, la variante la moins chère pour la quantité demandée (paquets entiers).
   * Chaque ligne devient un article VIRTUEL (identifiant négatif) dont le prix par magasin est ce coût : l'optimiseur reste inchangé.
   */
  async function resolveFamilles(body: z.infer<typeof basketSchema>, storeIds: number[]) {
    const lignes = new Map<string, { quantiteBase: number; unite: string }>();
    for (const a of body.articles) {
      if (!estFamille(a)) continue;
      const cur = lignes.get(a.famille);
      lignes.set(a.famille, { quantiteBase: Math.round(((cur?.quantiteBase ?? 0) + a.quantiteBase) * 1000) / 1000, unite: a.unite });
    }
    const testKeys = new Set<string>();
    if (!lignes.size) return { resolved: [] as ResolvedFamily[], testKeys };
    const slugs = [...lignes.keys()].sort();
    const famRows = await db.select().from(families).where(inArray(families.slug, slugs));
    const fam = new Map(famRows.map((f) => [f.slug, f]));
    for (const slug of slugs) {
      const f = fam.get(slug);
      if (!f) throw Object.assign(new Error(`Famille inconnue : « ${slug} ».`), { statusCode: 404 });
      const attendu = UNITE_DE_CLASSE[f.classe as Classe];
      if (lignes.get(slug)!.unite !== attendu) throw Object.assign(new Error(`Unité incompatible : la famille « ${f.nom.fr} » se compte en ${attendu} (classe ${f.classe}).`), { statusCode: 400 });
    }
    const variants = await db.select().from(products).where(inArray(products.famille, slugs));
    const priceRows = variants.length && storeIds.length
      ? await db.select().from(priceSelect).where(and(inArray(priceSelect.productId, variants.map((p) => p.id)), inArray(priceSelect.storeId, storeIds), testFilter(36500)))
      : [];
    const byId = new Map(variants.map((p) => [p.id, p]));
    for (const r of priceRows) if (r.testOnly) testKeys.add(`${r.productId}:${r.storeId}`);
    const resolved = slugs.map((slug, i): ResolvedFamily => {
      const f = fam.get(slug)!;
      const ln = lignes.get(slug)!;
      const offers: VariantOffer[] = priceRows.flatMap((r) => {
        const p = byId.get(r.productId);
        if (!p || p.famille !== slug) return [];
        return [{ produitId: p.id, nom: libelleVariante(p), marque: p.marque, valeur: Number(p.formatValeur), unite: p.formatUnite as Unite, storeId: r.storeId, prixMad: Number(r.prixMad), dateReleve: String(r.dateReleve), source: r.source }];
      });
      const { choices, hasAnyOffer } = resolveFamilyLine({ classe: f.classe as Classe, quantiteBase: ln.quantiteBase, offers, referenceDate: today(), maxAgeDays: body.ageMaxJours });
      return { pseudoId: -(i + 1), slug, nom: f.nom, classe: f.classe as Classe, quantiteBase: ln.quantiteBase, unite: ln.unite, choices, hasAnyOffer };
    });
    return { resolved, testKeys };
  }

  async function computeBasket(body: z.infer<typeof basketSchema>) {
    const storeRows = await db
      .select({ id: stores.id, ville: stores.ville, chainId: chains.id, enseigne: chains.nom, slug: chains.slug })
      .from(stores)
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(and(sql`lower(${stores.ville}) = lower(${body.ville})`, eq(chains.actif, true)));
    if (!storeRows.length) throw Object.assign(new Error("Aucun magasin connu dans cette ville."), { statusCode: 404 });
    const excludedIds = storeRows.filter((s) => body.enseignesExclues.includes(s.slug)).map((s) => s.id);
    const precis = body.articles.filter((a): a is PrecisLine => !estFamille(a));
    const productIds = [...new Set(precis.map((a) => a.produitId))];
    const prods = productIds.length ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
    if (prods.length !== productIds.length) throw Object.assign(new Error("Produit inconnu dans le panier."), { statusCode: 404 });
    const priceRows = productIds.length
      ? await db.select().from(priceSelect).where(and(inArray(priceSelect.productId, productIds), inArray(priceSelect.storeId, storeRows.map((s) => s.id)), testFilter(36500)))
      : [];
    const { resolved, testKeys: famTestKeys } = await resolveFamilles(body, storeRows.map((s) => s.id));
    const testKeys = new Set([...priceRows.filter((r) => r.testOnly).map((r) => `${r.productId}:${r.storeId}`), ...famTestKeys]);
    const offers: Offer[] = priceRows.map((r) => ({
      productId: r.productId, storeId: r.storeId, prixMad: Number(r.prixMad), dateReleve: String(r.dateReleve), source: r.source,
    }));
    for (const fr of resolved) for (const c of fr.choices.values()) offers.push({ productId: fr.pseudoId, storeId: c.storeId, prixMad: c.totalMad, dateReleve: c.dateReleve, source: c.source });
    const result = optimize({
      items: [...precis.map((a) => ({ productId: a.produitId, quantity: a.quantite })), ...resolved.map((fr) => ({ productId: fr.pseudoId, quantity: 1 }))],
      offers, maxStores: body.maxMagasins, excludedStoreIds: excludedIds, maxAgeDays: body.ageMaxJours, referenceDate: today(),
    });
    const storeName = new Map(storeRows.map((s) => [s.id, s.enseigne]));
    const prodName = new Map(prods.map((p) => [p.id, p.nomAffiche]));
    const famByPseudo = new Map(resolved.map((fr) => [fr.pseudoId, fr]));
    let donneesDeTest = false;
    const actualIds=[...new Set([...prods.map(p=>p.id),...resolved.flatMap(fr=>[...fr.choices.values()].map(c=>c.produitId))])];
    const evidenceRows=actualIds.length?await db.select().from(priceSelect).where(inArray(priceSelect.productId,actualIds)):[];
    const evidence=new Map(evidenceRows.map(r=>[r.productId+":"+r.storeId,priceMeta(r)]));
    const plan = result.plan.map((p) => ({
      enseigne: storeName.get(p.storeId)!, sousTotalMad: p.subtotalMad,
      articles: p.lines.map((l) => {
        if (l.productId < 0) {
          const fr = famByPseudo.get(l.productId)!;
          const c = fr.choices.get(p.storeId)!;
          if (testKeys.has(`${c.produitId}:${p.storeId}`)) donneesDeTest = true;
          return {
            ...evidence.get(c.produitId+":"+p.storeId), produitId: c.produitId, nom: c.nom, quantite: c.nbPaquets, prixUnitaireMad: c.prixPaquetMad, totalMad: c.totalMad, dateReleve: c.dateReleve, source: c.source,
            famille: fr.slug as string | null,
            ligneFamille: { nom: fr.nom, quantiteDemandee: fr.quantiteBase, unite: fr.unite, quantiteAchetee: c.quantiteAchetee, surplus: c.surplus, marque: c.marque, format: c.format } as {
              nom: { fr: string; ar: string; en: string }; quantiteDemandee: number; unite: string; quantiteAchetee: number; surplus: number; marque: string | null; format: string;
            } | null,
          };
        }
        if (testKeys.has(`${l.productId}:${p.storeId}`)) donneesDeTest = true;
        return {
          ...evidence.get(l.productId+":"+p.storeId), produitId: l.productId, nom: prodName.get(l.productId)!, quantite: l.quantity, prixUnitaireMad: l.prixUnitaireMad,
          totalMad: l.totalMad, dateReleve: l.dateReleve, source: l.source, famille: null as string | null, ligneFamille: null as null | { nom: { fr: string; ar: string; en: string }; quantiteDemandee: number; unite: string; quantiteAchetee: number; surplus: number; marque: string | null; format: string },
        };
      }),
    }));
    return {
      ville: body.ville,
      parametres: { maxMagasins: body.maxMagasins, enseignesExclues: body.enseignesExclues, ageMaxJours: body.ageMaxJours, mode: "prix_le_plus_bas" },
      algorithme: result.algorithmVersion,
      resolutionFamilles: resolved.length ? "familles-1.0.0" : null,
      dateReference: result.referenceDate,
      plan,
      totalMad: result.totalMad,
      meilleurMonoMagasin: result.bestSingleStore && {
        enseigne: storeName.get(result.bestSingleStore.storeId)!, totalMad: result.bestSingleStore.totalMad, articlesCouverts: result.bestSingleStore.coveredProducts,
        totalOptimiseMemesArticlesMad: result.bestSingleStore.optimizedTotalSameItemsMad,
      },
      economieMad: result.savingsMad,
      exclus: result.excluded.map((e) => {
        if (e.productId < 0) {
          const fr = famByPseudo.get(e.productId)!;
          return {
            produitId: null as number | null, famille: fr.slug as string | null, nom: `${fr.nom.fr} (n'importe quelle marque)`,
            raison: fr.hasAnyOffer ? `Aucun prix de moins de ${body.ageMaxJours} jours.` : "Aucun prix connu dans cette ville.",
          };
        }
        return {
          produitId: e.productId as number | null, famille: null as string | null, nom: prodName.get(e.productId)!,
          raison: e.reason === "perime" ? `Aucun prix de moins de ${body.ageMaxJours} jours.` : "Aucun prix connu dans cette ville.",
        };
      }),
      combinaisonsEvaluees: result.subsetsEvaluated,
      donneesDeTest,
    };
  }

  const basketHandler = async (req: FastifyRequest, reply: FastifyReply, save: boolean) => {
    const body = basketSchema.parse(req.body);
    try {
      const out = await computeBasket(body);
      if (!save) return out;
      const token = randomBytes(9).toString("base64url");
      await db.insert(carts).values({ token, ville: body.ville, params: out.parametres, items: body.articles, result: out, algorithmVersion: out.algorithme });
      return reply.code(201).send({ token, chemin: `/panier/${token}`, ...out });
    } catch (e) {
      if (e instanceof OptimizerLimitError) return erreur(reply, 422, e.message);
      throw e;
    }
  };
  app.post("/paniers/optimiser", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, (req, reply) => basketHandler(req, reply, false));
  app.post("/paniers", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, (req, reply) => basketHandler(req, reply, true));
  // Trois options côte à côte : un seul magasin, deux magasins, optimal (sans limite).
  async function compareOptions(body: z.infer<typeof basketSchema>) {
    const defs = [
      { cle: "un_magasin", maxMagasins: 1 as const },
      { cle: "deux_magasins", maxMagasins: 2 as const },
      { cle: "optimal", maxMagasins: null },
    ];
    const demandes = new Set(body.articles.map((a) => (estFamille(a) ? `f:${a.famille}` : `p:${a.produitId}`))).size;
    const options = [];
    for (const d of defs) {
      try {
        const r = await computeBasket({ ...body, maxMagasins: d.maxMagasins });
        const couverts = r.plan.reduce((n, p) => n + p.articles.length, 0);
        options.push({ cle: d.cle, maxMagasins: d.maxMagasins, disponible: true, nbMagasins: r.plan.length, totalMad: r.totalMad, articlesCouverts: couverts, articlesDemandes: demandes, resultat: r });
      } catch (e) {
        if (!(e instanceof OptimizerLimitError)) throw e;
        options.push({ cle: d.cle, maxMagasins: d.maxMagasins, disponible: false, raison: e.message });
      }
    }
    const ok = options.filter((o): o is typeof o & { disponible: true; articlesCouverts: number; totalMad: number; nbMagasins: number } => o.disponible);
    const best = [...ok].sort((a, b) => b.articlesCouverts - a.articlesCouverts || a.totalMad - b.totalMad || a.nbMagasins - b.nbMagasins)[0];
    return { ville: body.ville, options, recommande: best?.cle ?? null };
  }
  app.post("/paniers/comparer", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => compareOptions(basketSchema.parse(req.body)));

  // ---------- Rapports détaillés (alimentent les pages imprimables « PDF ») ----------
  const daysBetween = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);

  async function buildBasketReport(body: z.infer<typeof basketSchema>) {
    const cmp = await compareOptions(body);
    const now = today();
    const storeRows = await db
      .select({ id: stores.id, enseigne: chains.nom, slug: chains.slug })
      .from(stores)
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(and(sql`lower(${stores.ville}) = lower(${body.ville})`, eq(chains.actif, true)))
      .orderBy(asc(chains.id));
    const qty = new Map<number, number>();
    for (const a of body.articles) if (!estFamille(a)) qty.set(a.produitId, (qty.get(a.produitId) ?? 0) + a.quantite);
    const ids = [...qty.keys()];
    const prods = ids.length ? await db.select().from(products).where(inArray(products.id, ids)) : [];
    const priceRows = storeRows.length && ids.length
      ? await db.select().from(priceSelect).where(and(inArray(priceSelect.productId, ids), inArray(priceSelect.storeId, storeRows.map((r) => r.id)), testFilter()))
      : [];
    const excluded = new Set(body.enseignesExclues);
    const matricePrecis = prods.map((p) => {
      const prix = storeRows.map((st) => {
        const r = priceRows.find((x) => x.productId === p.id && x.storeId === st.id);
        return {
          enseigne: st.enseigne,
          exclue: excluded.has(st.slug),
          prixMad: r ? Number(r.prixMad) : null,
          dateReleve: r ? String(r.dateReleve) : null,
          source: r?.source ?? null,
          perime: r ? daysBetween(String(r.dateReleve), now) > body.ageMaxJours : false,
          donneesDeTest: r?.testOnly ?? false,
          detail: null as string | null,
        };
      });
      const valides = prix.filter((x) => x.prixMad !== null && !x.perime && !x.exclue) as (typeof prix[number] & { prixMad: number })[];
      const best = [...valides].sort((a, b) => a.prixMad - b.prixMad)[0];
      return {
        produitId: p.id as number | null, famille: null as string | null, nom: p.nomAffiche, format: `${Number(p.formatValeur)} ${p.formatUnite}`, quantite: qty.get(p.id)!,
        meilleur: best ? { enseigne: best.enseigne, prixMad: best.prixMad, prixUnitaire: unitPrice(best.prixMad, Number(p.formatValeur), p.formatUnite as Unite) } : null,
        prix,
      };
    });
    // Lignes « n'importe quelle marque » : une ligne par famille, chaque case = coût de la variante retenue dans ce magasin.
    const { resolved: famRes, testKeys: famTest } = await resolveFamilles(body, storeRows.map((r) => r.id));
    const matriceFamilles = famRes.map((fr) => {
      const prix = storeRows.map((st) => {
        const c = fr.choices.get(st.id);
        return {
          enseigne: st.enseigne,
          exclue: excluded.has(st.slug),
          prixMad: c ? c.totalMad : null,
          dateReleve: c?.dateReleve ?? null,
          source: c?.source ?? null,
          perime: false,
          donneesDeTest: c ? famTest.has(`${c.produitId}:${st.id}`) : false,
          detail: c ? `${c.marque ?? c.nom} ${c.format} × ${c.nbPaquets}` : null,
        };
      });
      const valides = prix.filter((x) => x.prixMad !== null && !x.exclue) as (typeof prix[number] & { prixMad: number })[];
      const best = [...valides].sort((a, b) => a.prixMad - b.prixMad)[0];
      return {
        produitId: null as number | null, famille: fr.slug as string | null, nom: `${fr.nom.fr} — ${libelleQte(fr.quantiteBase, fr.unite)} (n'importe quelle marque)`, format: "", quantite: 1,
        meilleur: best ? { enseigne: best.enseigne, prixMad: best.prixMad, prixUnitaire: { prix: Math.round((best.prixMad / fr.quantiteBase) * 100) / 100, par: fr.unite } } : null,
        prix,
      };
    });
    const matrice = [...matricePrecis, ...matriceFamilles];
    const recommended = cmp.options.find((o) => o.cle === cmp.recommande);
    const lines = recommended && "resultat" in recommended && recommended.resultat ? recommended.resultat.plan.flatMap((pl) => pl.articles) : [];
    const dates = lines.map((l) => l.dateReleve).sort();
    return {
      version: "1",
      genereLe: new Date().toISOString(),
      dateReference: now,
      ville: body.ville,
      parametres: { enseignesExclues: body.enseignesExclues, ageMaxJours: body.ageMaxJours },
      algorithme: ALGORITHM_VERSION,
      enseignes: storeRows.map((r) => r.enseigne),
      options: cmp.options,
      recommande: cmp.recommande,
      matrice,
      sources: { types: [...new Set(lines.map((l) => l.source))].sort(), dateMin: dates[0] ?? null, dateMax: dates[dates.length - 1] ?? null },
      donneesDeTest: matrice.some((m) => m.prix.some((x) => x.donneesDeTest)),
    };
  }

  app.post("/rapports/panier", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    try {
      return await buildBasketReport(basketSchema.parse(req.body));
    } catch (e) {
      if (e instanceof OptimizerLimitError) return erreur(reply, 422, e.message);
      throw e;
    }
  });

  app.get("/paniers/:token/rapport", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { token } = req.params as { token: string };
    const [c] = await db.select().from(carts).where(eq(carts.token, token));
    if (!c) return erreur(reply, 404, "Panier introuvable.");
    const params = c.params as { enseignesExclues?: string[]; ageMaxJours?: number };
    const body = basketSchema.parse({ ville: c.ville, articles: c.items, maxMagasins: null, enseignesExclues: params.enseignesExclues ?? [], ageMaxJours: params.ageMaxJours ?? 30 });
    return { ...(await buildBasketReport(body)), panierEnregistre: { token: c.token, creeLe: c.createdAt, algorithme: c.algorithmVersion, resultat: c.result } };
  });

  app.get("/produits/:id/rapport", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const q = z.object({ ville: z.string().min(1) }).safeParse(req.query);
    if (!Number.isInteger(id) || !q.success) return erreur(reply, 400, "Requête invalide : produit et ville obligatoires.");
    const [p] = await db.select().from(products).where(eq(products.id, id));
    if (!p) return erreur(reply, 404, "Produit introuvable.");
    const now = today();
    const rows = await db
      .select({ enseigne: chains.nom, prixMad: priceSelect.prixMad, dateReleve: priceSelect.dateReleve, source: priceSelect.source, confiance: priceSelect.confiance, testOnly: priceSelect.testOnly,validFrom:priceSelect.validFrom,validUntil:priceSelect.validUntil,validityStatus:priceSelect.validityStatus,sourceUrl:priceSelect.sourceUrl,observedAt:priceSelect.observedAt,confianceMotif:priceSelect.confianceMotif })
      .from(priceSelect)
      .innerJoin(stores, eq(stores.id, priceSelect.storeId))
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(and(eq(priceSelect.productId, id), testFilter(), eq(chains.actif, true), sql`lower(${stores.ville}) = lower(${q.data.ville})`))
      .orderBy(asc(priceSelect.prixMad), asc(chains.id));
    const prix = withGap(
      rows.map((r) => ({
        enseigne: r.enseigne, prixMad: Number(r.prixMad), prixUnitaire: unitPrice(Number(r.prixMad), Number(p.formatValeur), p.formatUnite as Unite),
        dateReleve: String(r.dateReleve), ageJours: daysBetween(String(r.dateReleve), now), source: r.source, confiance: r.confiance, donneesDeTest: r.testOnly,...priceMeta(r),
      })),
    );
    const sorted = prix.map((x) => x.prixMad);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null;
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const hist = await db
      .select({ enseigne: chains.nom, prixMad: historySelect.prixMad, dateReleve: historySelect.dateReleve, source: historySelect.source, chainId: chains.id })
      .from(historySelect)
      .innerJoin(stores, eq(stores.id, historySelect.storeId))
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(and(eq(historySelect.productId, id), includeTest ? undefined : eq(historySelect.testOnly, false), sql`${historySelect.dateReleve} <= ${today()}`, sql`lower(${stores.ville}) = lower(${q.data.ville})`))
      .orderBy(asc(chains.id), asc(historySelect.dateReleve));
    const byChain = new Map<string, { date: string; prixMad: number; source: string }[]>();
    for (const h of hist) byChain.set(h.enseigne, [...(byChain.get(h.enseigne) ?? []), { date: String(h.dateReleve), prixMad: Number(h.prixMad), source: h.source }]);
    return {
      version: "1",
      genereLe: new Date().toISOString(),
      dateReference: now,
      ville: q.data.ville,
      produit: { id: p.id, slug: p.slug, nom: p.nomAffiche, marque: p.marque, categorie: p.categorie, famille: p.famille, image: imageOf(p), format: `${Number(p.formatValeur)} ${p.formatUnite}` },
      prix,
      top3: prix.slice(0, 3),
      stats: prix.length
        ? {
            nbEnseignes: prix.length, min: sorted[0], max: sorted[sorted.length - 1], mediane: median, moyenne: r2(sorted.reduce((a, b) => a + b, 0) / sorted.length),
            ecartMad: r2(sorted[sorted.length - 1] - sorted[0]), ecartPct: r2(((sorted[sorted.length - 1] - sorted[0]) / sorted[sorted.length - 1]) * 100),
          }
        : null,
      historique: [...byChain.entries()].map(([enseigne, points]) => ({
        enseigne, points,
        variationPct: points.length > 1 ? Math.round(((points[points.length - 1].prixMad - points[0].prixMad) / points[0].prixMad) * 1000) / 10 : null,
      })),
      donneesDeTest: prix.some((x) => x.donneesDeTest),
    };
  });

  // ---------- Paniers prédéfinis ----------
  app.get("/paniers-prets", async () => {
    const rows = await db.select().from(presetBaskets).orderBy(asc(presetBaskets.id));
    return {
      indicatif: true,
      paniers: rows.map((r) => ({ slug: r.slug, profil: r.profil, nom: r.nom, description: r.description, menage: r.menage, nbArticles: r.lignes.length })),
    };
  });
  app.get("/paniers-prets/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const [row] = await db.select().from(presetBaskets).where(eq(presetBaskets.slug, slug));
    if (!row) return erreur(reply, 404, "Panier prédéfini introuvable.");
    const precises = row.lignes.filter((l): l is { slug: string; quantite: number } => "slug" in l);
    const famLignes = row.lignes.filter((l): l is { famille: string; quantiteBase: number; unite: "kg" | "l" | "piece" } => "famille" in l);
    const prods = precises.length ? await db.select().from(products).where(inArray(products.slug, precises.map((l) => l.slug))) : [];
    const bySlug = new Map(prods.map((p) => [p.slug, p]));
    const fams = famLignes.length ? await db.select().from(families).where(inArray(families.slug, famLignes.map((l) => l.famille))) : [];
    const famBySlug = new Map(fams.map((f) => [f.slug, f]));
    const articles = precises.flatMap((l) => {
      const p = bySlug.get(l.slug);
      return p ? [{ produitId: p.id, slug: p.slug, nom: p.nomAffiche, quantite: l.quantite }] : [];
    });
    const lignesFamille = famLignes.flatMap((l) => {
      const f = famBySlug.get(l.famille);
      return f ? [{ famille: f.slug, nom: f.nom, quantiteBase: l.quantiteBase, unite: l.unite }] : [];
    });
    return {
      slug: row.slug, profil: row.profil, nom: row.nom, description: row.description, menage: row.menage,
      avertissement: "Composition et quantités indicatives (hypothèses de départ), à ajuster selon votre foyer.",
      articles,
      lignesFamille,
      manquants: [...precises.filter((l) => !bySlug.has(l.slug)).map((l) => l.slug), ...famLignes.filter((l) => !famBySlug.has(l.famille)).map((l) => l.famille)],
    };
  });

  app.post("/paniers/:token/recalculer", {config:{rateLimit:{max:20,timeWindow:"1 minute"}}}, async (req,reply)=>{
    const [c]=await db.select().from(carts).where(eq(carts.token,(req.params as {token:string}).token));
    if(!c)return erreur(reply,404,"Panier introuvable.");
    const params=c.params as Record<string,unknown>;
    return computeBasket(basketSchema.parse({...params,ville:c.ville,articles:c.items}));
  });
  app.get("/paniers/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const [c] = await db.select().from(carts).where(eq(carts.token, token));
    if (!c) return erreur(reply, 404, "Panier introuvable.");
    return { token: c.token, creeLe: c.createdAt, articles: c.items, ...(c.result as object), instantane:true };
  });

  // ---------- Contributions (crowdsourcing) ----------
  async function findStore(slug: string, ville: string) {
    const [row] = await db
      .select({ id: stores.id })
      .from(stores)
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(and(eq(chains.slug, slug), sql`lower(${stores.ville}) = lower(${ville})`));
    return row?.id;
  }
  const contributionSchema = z.object({
    produitId: z.number().int().positive(),
    enseigne: z.string().min(1),
    ville: z.string().min(1),
    prixMad: z.number().positive().max(100000).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "2 décimales maximum"),
    dateReleve: dateStr.optional(),
  });
  app.post("/contributions", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const b = contributionSchema.parse(req.body);
    const date = b.dateReleve ?? today();
    if (date > today()) return erreur(reply, 400, "La date du relevé ne peut pas être dans le futur.");
    const [prod] = await db.select({ id: products.id }).from(products).where(eq(products.id, b.produitId));
    if (!prod) return erreur(reply, 404, "Produit introuvable.");
    const storeId = await findStore(b.enseigne, b.ville);
    if (!storeId) return erreur(reply, 422, "Magasin inconnu pour cette enseigne et cette ville.");
    await db.insert(priceObservations).values({
      productId: b.produitId, storeId, prixMad: b.prixMad.toFixed(2), dateReleve: date, source: "crowd", confiance: "basse",
    });
    return reply.code(202).send({ message: "Merci ! Votre prix sera visible après validation." });
  });

  // ---------- Administration (jeton unique) ----------
  app.register(async (admin) => {
    admin.addHook("onRequest", admin.rateLimit({ max: 60, timeWindow: "1 minute" }));
    admin.addHook("onRequest", async (req, reply) => {
      if (!opts.adminToken) return erreur(reply, 503, "Administration désactivée : ADMIN_TOKEN non configuré.");
      const header = req.headers.authorization ?? "";
      const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
      const expected = Buffer.from(opts.adminToken);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return erreur(reply, 401, "Jeton administrateur invalide.");
    });

    admin.get("/suivi",async()=>{
      const allSources=await db.select().from(sources).orderBy(sources.slug);
      const jobs=await db.select().from(importJobs).orderBy(desc(importJobs.id)).limit(30);
      const visible=await db.select({produitId:priceSelect.productId,storeId:priceSelect.storeId}).from(priceSelect).where(testFilter());
      const coverage=await db.select({ville:stores.ville,enseigne:chains.nom}).from(priceSelect).innerJoin(stores,eq(stores.id,priceSelect.storeId)).innerJoin(chains,eq(chains.id,stores.chainId)).where(and(testFilter(),eq(chains.actif,true)));
      const counts=new Map<string,{ville:string;enseigne:string;nbPrix:number}>();
      for(const c of coverage){const key=c.ville+":"+c.enseigne;const v=counts.get(key)??{...c,nbPrix:0};v.nbPrix++;counts.set(key,v);}
      const latest=await db.select().from(priceObservations);
      const expired=latest.filter(o=>o.validUntil?o.validUntil<today():o.dateReleve<cutoff(today())).length;
      const waiting=await db.select({id:matchCandidates.id}).from(matchCandidates).where(eq(matchCandidates.statut,"en_attente"));
      return {dateReference:today(),nbPrixActuels:visible.length,observationsExpirees:expired,appariementsEnAttente:waiting.length,sources:allSources.map(s=>({...s,dernierJob:jobs.find(j=>j.sourceId===s.id)??null})),jobs,couverture:[...counts.values()]};
    });
    admin.post("/collectes/journal",async(req)=>{
      const b=z.object({sourceSlug:z.string(),statut:z.enum(["erreur","bloque"]),erreur:z.string().max(500),pagesLues:z.number().int().min(0).max(10)}).parse(req.body);
      const [s]=await db.select().from(sources).where(eq(sources.slug,b.sourceSlug));if(!s)throw Object.assign(new Error("Source inconnue."),{statusCode:404});
      await db.insert(importJobs).values({sourceId:s.id,fin:new Date(),statut:b.statut,erreur:b.erreur,pagesLues:b.pagesLues,dryRun:false});
      return {ok:true};
    });
    admin.get("/en-attente", async () => {
      const pending = await db
        .select({
          id: priceObservations.id, productId: priceObservations.productId, produit: products.nomAffiche, enseigne: chains.nom,
          ville: stores.ville, prixMad: priceObservations.prixMad, dateReleve: priceObservations.dateReleve, source: priceObservations.source,
        })
        .from(priceObservations)
        .innerJoin(products, eq(products.id, priceObservations.productId))
        .innerJoin(stores, eq(stores.id, priceObservations.storeId))
        .innerJoin(chains, eq(chains.id, stores.chainId))
        .where(notExists(db.select({ x: observationReviews.id }).from(observationReviews).where(eq(observationReviews.observationId, priceObservations.id))))
        .orderBy(asc(priceObservations.id));
      const published = await db.select({ productId: priceSelect.productId, prixMad: priceSelect.prixMad }).from(priceSelect);
      const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
      return {
        observations: pending.map((o) => {
          const med = median(published.filter((p) => p.productId === o.productId).map((p) => Number(p.prixMad)));
          const ecart = med ? (Number(o.prixMad) - med) / med : null;
          return { ...o, prixMad: Number(o.prixMad), dateReleve: String(o.dateReleve), medianePubliee: med, ecartMediane: ecart, suspect: ecart !== null && Math.abs(ecart) > 0.4 };
        }),
      };
    });

    admin.post("/observations/:id/decision", async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const b = z.object({ decision: z.enum(["publie", "rejete"]), motif: z.string().max(500).optional() }).parse(req.body);
      const [obs] = await db.select({ id: priceObservations.id }).from(priceObservations).where(eq(priceObservations.id, id));
      if (!obs) return erreur(reply, 404, "Observation introuvable.");
      const [already] = await db.select({ id: observationReviews.id }).from(observationReviews).where(eq(observationReviews.observationId, id));
      if (already) return erreur(reply, 409, "Observation déjà traitée.");
      await db.insert(observationReviews).values({ observationId: id, decision: b.decision, reviewer: "admin", motif: b.motif });
      return { ok: true };
    });

    // Audit : prix publiés (filtrables par source, enseigne, date) pour retrouver ceux dont la provenance est à corriger.
    admin.get("/observations/publiees", async (req) => {
      const q = z.object({
        source: z.enum(["scraping", "manuel", "crowd", "photo", "catalogue", "fixture"]).optional(),
        enseigne: z.string().optional(),
        date: dateStr.optional(),
        limite: z.coerce.number().int().min(1).max(500).default(200),
      }).parse(req.query);
      const rows = await db
        .select({
          id: historySelect.observationId, produit: products.nomAffiche, enseigne: chains.nom, ville: stores.ville, prixMad: historySelect.prixMad,
          dateReleve: historySelect.dateReleve, source: historySelect.source, confiance: historySelect.confiance, testOnly: historySelect.testOnly,
        })
        .from(historySelect)
        .innerJoin(products, eq(products.id, historySelect.productId))
        .innerJoin(stores, eq(stores.id, historySelect.storeId))
        .innerJoin(chains, eq(chains.id, stores.chainId))
        .where(and(q.source ? eq(historySelect.source, q.source) : undefined, q.enseigne ? eq(chains.slug, q.enseigne) : undefined, q.date ? eq(historySelect.dateReleve, q.date) : undefined))
        .orderBy(asc(historySelect.observationId))
        .limit(q.limite);
      return { observations: rows.map((r) => ({ ...r, prixMad: Number(r.prixMad), dateReleve: String(r.dateReleve) })) };
    });

    // Corrige la provenance de prix publiés SANS rien modifier : l'ancienne observation est rejetée (avis ajouté),
    // une nouvelle observation identique (même prix, même date) est créée avec la bonne source et publiée. Tout ou rien.
    admin.post("/observations/recategoriser", async (req, reply) => {
      const b = z.object({
        ids: z.array(z.number().int().positive()).min(1).max(200),
        source: z.enum(["scraping", "manuel", "crowd", "photo", "catalogue"]),
        confiance: z.enum(["haute", "moyenne", "basse"]),
        motif: z.string().min(3).max(300),
      }).parse(req.body);
      const ids = [...new Set(b.ids)];
      const published = await db.select({ id: historySelect.observationId }).from(historySelect).where(inArray(historySelect.observationId, ids));
      const ok = new Set(published.map((r) => r.id));
      const missing = ids.filter((id) => !ok.has(id));
      if (missing.length) return erreur(reply, 409, `Observations introuvables ou non publiées : ${missing.join(", ")}. Rien n'a été modifié.`);
      const olds = await db.select().from(priceObservations).where(inArray(priceObservations.id, ids));
      const remplaces: { ancien: number; nouveau: number }[] = [];
      await db.transaction(async (tx) => {
        for (const o of olds) {
          await tx.insert(observationReviews).values({ observationId: o.id, decision: "rejete", reviewer: "admin", motif: `Provenance corrigée : ${b.motif}` });
          const [n] = await tx
            .insert(priceObservations)
            .values({ productId: o.productId, storeId: o.storeId, prixMad: o.prixMad, prixUnitaireMad: o.prixUnitaireMad, dateReleve: o.dateReleve, source: b.source, confiance: b.confiance, photoId: o.photoId, testOnly: o.testOnly })
            .returning({ id: priceObservations.id });
          await tx.insert(observationReviews).values({ observationId: n.id, decision: "publie", reviewer: "admin", motif: `Remplace #${o.id} : ${b.motif}` });
          remplaces.push({ ancien: o.id, nouveau: n.id });
        }
      });
      return { remplaces };
    });

    admin.post("/observations", async (req, reply) => {
      const b = contributionSchema.extend({ dateReleve: dateStr }).parse(req.body);
      const storeId = await findStore(b.enseigne, b.ville);
      if (!storeId) return erreur(reply, 422, "Magasin inconnu pour cette enseigne et cette ville.");
      const [obs] = await db
        .insert(priceObservations)
        .values({ productId: b.produitId, storeId, prixMad: b.prixMad.toFixed(2), dateReleve: b.dateReleve, source: "manuel", confiance: "haute" })
        .returning();
      await db.insert(observationReviews).values({ observationId: obs.id, decision: "publie", reviewer: "admin" });
      return reply.code(201).send({ id: obs.id });
    });

    // Import par lot d'un CSV de relevés : tout ou rien. Une seule erreur → rien n'est enregistré.
    admin.post("/releves/import", async (req, reply) => {
      const b = z.object({ csv: z.string().min(1).max(500_000), essaiABlanc: z.boolean().default(false) }).parse(req.body);
      const parsed = parseReleves(b.csv);
      const errs: ImportError[] = [...parsed.erreurs];
      if (errs.length) return reply.code(422).send({ erreur: "Fichier invalide.", erreurs: errs });

      const chainRows = await db.select().from(chains);
      const chainByName = new Map(chainRows.map((c) => [c.nom.trim().toLowerCase(), c]));
      for (const col of parsed.colonnes) if (!chainByName.has(col.toLowerCase())) errs.push({ ligne: 1, colonne: col, message: `Enseigne inconnue : « ${col} ».` });

      const slugs = [...new Set(parsed.rows.map((r) => r.slug).filter(Boolean))];
      const prods = slugs.length ? await db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.slug, slugs)) : [];
      const prodBySlug = new Map(prods.map((p) => [p.slug, p.id]));
      const storeRows = await db.select({ id: stores.id, chainId: stores.chainId, ville: stores.ville }).from(stores);
      const storeKey = (chainId: number, ville: string) => `${chainId}|${ville.trim().toLowerCase()}`;
      const storeBy = new Map(storeRows.map((s2) => [storeKey(s2.chainId, s2.ville), s2.id]));

      type Cand = { ligne: number; colonne: string; productId: number; storeId: number; prix: number; date: string };
      const cands: Cand[] = [];
      const seen = new Set<string>();
      const now = today();
      for (const r of parsed.rows) {
        const productId = prodBySlug.get(r.slug);
        if (!productId) { errs.push({ ligne: r.ligne, colonne: "slug", message: `Produit inconnu : « ${r.slug} ».` }); continue; }
        const dateErr = checkDate(r.date, now);
        if (dateErr) { errs.push({ ligne: r.ligne, colonne: "date_releve", message: dateErr }); continue; }
        if (!r.ville) { errs.push({ ligne: r.ligne, colonne: "ville", message: "Ville manquante." }); continue; }
        for (const c of r.cellules) {
          let prix: number | null;
          try { prix = parsePrix(c.brut); } catch (e) { errs.push({ ligne: r.ligne, colonne: c.colonne, message: (e as Error).message }); continue; }
          if (prix === null) continue;
          const chain = chainByName.get(c.colonne.toLowerCase());
          if (!chain) continue;
          const storeId = storeBy.get(storeKey(chain.id, r.ville));
          if (!storeId) { errs.push({ ligne: r.ligne, colonne: c.colonne, message: `Aucun magasin « ${c.colonne} » dans la ville « ${r.ville} ».` }); continue; }
          const key = `${productId}|${storeId}|${r.date}`;
          if (seen.has(key)) { errs.push({ ligne: r.ligne, colonne: c.colonne, message: "Relevé en double dans le fichier (même produit, enseigne, ville et date)." }); continue; }
          seen.add(key);
          cands.push({ ligne: r.ligne, colonne: c.colonne, productId, storeId, prix, date: r.date });
        }
      }
      if (cands.length && !errs.length) {
        const existing = await db
          .select({ productId: priceObservations.productId, storeId: priceObservations.storeId, date: priceObservations.dateReleve })
          .from(priceObservations)
          .where(and(inArray(priceObservations.productId, [...new Set(cands.map((c) => c.productId))]), inArray(priceObservations.dateReleve, [...new Set(cands.map((c) => c.date))])));
        const exist = new Set(existing.map((e) => `${e.productId}|${e.storeId}|${String(e.date)}`));
        for (const c of cands) if (exist.has(`${c.productId}|${c.storeId}|${c.date}`)) errs.push({ ligne: c.ligne, colonne: c.colonne, message: "Un relevé existe déjà pour ce produit, ce magasin et cette date (l'historique n'est jamais écrasé)." });
      }
      if (!errs.length && cands.length === 0) errs.push({ ligne: 1, message: "Aucun prix renseigné : toutes les cellules sont vides." });
      if (errs.length) return reply.code(422).send({ erreur: `${errs.length} erreur(s) : aucun relevé n'a été enregistré.`, erreurs: errs });

      if (b.essaiABlanc) return { essaiABlanc: true, observations: cands.length, lignes: parsed.rows.length };
      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(priceObservations)
          .values(cands.map((c) => ({ productId: c.productId, storeId: c.storeId, prixMad: c.prix.toFixed(2), dateReleve: c.date, source: "manuel" as const, confiance: "haute" as const })))
          .returning({ id: priceObservations.id });
        await tx.insert(observationReviews).values(inserted.map((o) => ({ observationId: o.id, decision: "publie" as const, reviewer: "admin", motif: "import CSV" })));
      });
      return reply.code(201).send({ essaiABlanc: false, observations: cands.length, lignes: parsed.rows.length });
    });

    // Import d'un catalogue VALIDÉ (lignes « oui » du fichier de proposition). Tout ou rien.
    // « openfoodfacts » : code-barres obligatoire, photo OFF autorisée ; un code-barres déjà connu est ignoré.
    // « manuel » : fiches vérifiées en magasin, sans photo ; ignorées si même marque, même nom et même format existent déjà.
    admin.post("/catalogue/import", async (req, reply) => {
      const b = z.object({
        origine: z.enum(["openfoodfacts", "manuel"]),
        essaiABlanc: z.boolean().default(false),
        variantes: z.array(z.object({
          famille: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), ean: z.string().optional(), nom: z.string().min(4).max(200), marque: z.string().min(1).max(100),
          valeur: z.number().positive(), unite: z.enum(unites), categorie: z.enum(["epicerie", "frais", "cremerie", "boissons", "charcuterie", "menage", "hygiene"]),
          imageUrl: z.string().nullable().optional(), ficheUrl: z.string().url().optional(),
        })).min(1).max(500),
      }).parse(req.body);

      const errs: { ligne: number; message: string }[] = [];
      const famClasse = new Map((await db.select({ slug: families.slug, classe: families.classe }).from(families)).map((f) => [f.slug, f.classe]));
      const seen = new Set<string>();
      const cle = (v: { marque: string; nom: string; valeur: number; unite: string }) => `${v.marque}|${v.nom}|${v.valeur}|${v.unite}`.toLowerCase().replace(/\s+/g, " ");
      b.variantes.forEach((v, i) => {
        const classeFam = famClasse.get(v.famille);
        const classeFmt = toBase(v.valeur, v.unite as Unite).famille;
        if (!classeFam) errs.push({ ligne: i + 1, message: `Famille inconnue : « ${v.famille} ».` });
        else if (classeFmt !== classeFam) errs.push({ ligne: i + 1, message: `Format incompatible : la famille « ${v.famille} » est de classe ${classeFam}, pas ${classeFmt} (${v.valeur} ${v.unite}).` });
        if (b.origine === "openfoodfacts" && !v.ean) errs.push({ ligne: i + 1, message: "Code-barres obligatoire pour une fiche Open Food Facts." });
        else if (v.ean && (!isValidGtin(v.ean) || v.ean.length !== 13)) errs.push({ ligne: i + 1, message: `Code-barres invalide : « ${v.ean} » (EAN-13 avec clé correcte attendu).` });
        if (b.origine === "manuel" && v.imageUrl) errs.push({ ligne: i + 1, message: "Une fiche manuelle ne porte pas de photo : elle serait rattachée à une source qui n'existe pas." });
        if (/^\(|à préciser/i.test(v.marque)) errs.push({ ligne: i + 1, message: `Marque non renseignée : « ${v.marque} ». Indiquez la marque lue en magasin.` });
        if (v.imageUrl && !isOffImageUrl(v.imageUrl)) errs.push({ ligne: i + 1, message: "Photo refusée : seules les images HTTPS de images.openfoodfacts.org sont acceptées." });
        if (v.ficheUrl && !/^https:\/\/world\.openfoodfacts\.org\//.test(v.ficheUrl)) errs.push({ ligne: i + 1, message: "Fiche refusée : l'adresse doit être sur world.openfoodfacts.org." });
        const k = v.ean ?? cle(v);
        if (seen.has(k)) errs.push({ ligne: i + 1, message: v.ean ? `Code-barres en double dans le fichier : ${v.ean}.` : `Fiche en double dans le fichier : ${v.marque}, ${v.nom}, ${v.valeur} ${v.unite}.` });
        seen.add(k);
      });
      if (errs.length) return reply.code(422).send({ erreur: `${errs.length} erreur(s) : rien n'a été importé.`, erreurs: errs });

      const known = await db.select({ ean: products.ean, slug: products.slug, nom: products.nomAffiche, marque: products.marque, valeur: products.formatValeur, unite: products.formatUnite }).from(products);
      const knownEan = new Set(known.map((k) => k.ean).filter(Boolean) as string[]);
      const knownKeys = new Set(known.filter((k) => k.marque).map((k) => cle({ marque: k.marque!, nom: k.nom, valeur: Number(k.valeur), unite: k.unite })));
      const usedSlugs = new Set(known.map((k) => k.slug));
      const fresh = b.variantes.filter((v) => !(v.ean ? knownEan.has(v.ean) : false) && !knownKeys.has(cle(v)));
      const ignores = b.variantes.length - fresh.length;
      if (b.essaiABlanc) return { essaiABlanc: true, crees: fresh.length, ignores };

      const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      await db.transaction(async (tx) => {
        for (const v of fresh) {
          let slug = slugify(`${v.famille}-${v.marque}-${v.nom}-${v.valeur}${v.unite}`).slice(0, 90);
          if (usedSlugs.has(slug)) slug = `${slug}-${(v.ean ?? String(usedSlugs.size)).slice(-4)}`;
          usedSlugs.add(slug);
          const [p] = await tx.insert(products).values({
            slug, nomNormalise: v.nom.toLowerCase(), nomAffiche: v.nom, marque: v.marque, formatValeur: String(v.valeur), formatUnite: v.unite, ean: v.ean ?? null,
            categorie: v.categorie, famille: v.famille, imageUrl: v.imageUrl ?? null,
            imageCredit: v.imageUrl ? `Photo : Open Food Facts, CC BY-SA${v.ficheUrl ? ` — ${v.ficheUrl}` : ""}` : null, origine: b.origine,
          }).returning();
          await tx.insert(productAliases).values([
            { productId: p.id, texte: v.nom, formeNormalisee: v.nom.toLowerCase(), langue: "fr" as const },
            { productId: p.id, texte: v.marque, formeNormalisee: v.marque.toLowerCase(), langue: "fr" as const },
          ]);
        }
      });
      return reply.code(201).send({ essaiABlanc: false, crees: fresh.length, ignores });
    });

    admin.post("/produits", async (req, reply) => {
      const b = z.object({
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug en minuscules, chiffres et tirets").optional(),
        nomAffiche: z.string().min(1), marque: z.string().optional(), formatValeur: z.number().positive(), formatUnite: z.enum(unites),
        ean: z.string().optional(), categorie: z.string().optional(),
        alias: z.array(z.object({ texte: z.string().min(1), langue: z.enum(langues) })).default([]),
      }).parse(req.body);
      const slug = b.slug ?? b.nomAffiche.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) return erreur(reply, 400, "Impossible de déduire un slug : fournissez-le.");
      const [dup] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
      if (dup) return erreur(reply, 409, "Un produit avec ce slug existe déjà.");
      const [p] = await db.insert(products).values({
        slug, nomNormalise: b.nomAffiche.toLowerCase(), nomAffiche: b.nomAffiche, marque: b.marque, formatValeur: String(b.formatValeur),
        formatUnite: b.formatUnite, ean: b.ean, categorie: b.categorie,
      }).returning();
      if (b.alias.length) await db.insert(productAliases).values(b.alias.map((a) => ({ productId: p.id, texte: a.texte, formeNormalisee: a.texte.toLowerCase(), langue: a.langue })));
      return reply.code(201).send({ id: p.id });
    });

    admin.post("/magasins", async (req, reply) => {
      const b = z.object({ enseigne: z.string(), ville: z.string().min(1), adresse: z.string().optional() }).parse(req.body);
      const [c] = await db.select().from(chains).where(eq(chains.slug, b.enseigne));
      if (!c) return erreur(reply, 404, "Enseigne inconnue.");
      const [s] = await db.insert(stores).values({ chainId: c.id, ville: b.ville, adresse: b.adresse }).returning();
      return reply.code(201).send({ id: s.id });
    });

    admin.get("/appariements", async () => ({
      candidats: (await db.select({candidat:matchCandidates,produitPropose:{id:products.id,nom:products.nomAffiche,formatValeur:products.formatValeur,formatUnite:products.formatUnite}}).from(matchCandidates).leftJoin(products,eq(products.id,matchCandidates.productIdPropose)).where(eq(matchCandidates.statut,"en_attente")).orderBy(desc(matchCandidates.score))).map(r=>({...r.candidat,produitPropose:r.produitPropose})),
    }));
    admin.post("/appariements/:id/decision", async (req,reply) => {
      const id=z.coerce.number().int().positive().parse((req.params as {id:string}).id);
      const b=z.object({decision:z.enum(["accepte","rejete"]),produitId:z.number().int().positive().optional()}).parse(req.body);
      return decideCandidate(db,id,b);
    });

    // Ingestion du scraping : appariement certain → publié ; sinon file de validation, jamais publié automatiquement.
    admin.post("/scraping/releves", async (req) => ingest(db,req.body,today()));

    // Donnée brute : HTML conservé tel quel (gzip + base64) avant toute lecture. Même contenu → même enregistrement.
    admin.post("/sources/brut", async (req, reply) => {
      const b = z.object({
        sourceSlug: z.string().min(1), url: z.string().url(), html: z.string().min(1).max(5_000_000), httpStatus: z.number().int().optional(),
        fetchedAt: z.string().datetime(), parserVersion: z.string().max(60).optional(),
      }).parse(req.body);
      const [src] = await db.select().from(sources).where(eq(sources.slug, b.sourceSlug));
      if (!src) return erreur(reply, 404, `Source inconnue : ${b.sourceSlug}.`);
      const hash = createHash("sha256").update(b.html).digest("hex");
      await db.insert(rawData).values({
        sourceId: src.id, url: b.url, hashSha256: hash, contentType: "text/html", httpStatus: b.httpStatus, fetchedAt: new Date(b.fetchedAt),
        parserVersion: b.parserVersion, contenuGzipB64: gzipSync(Buffer.from(b.html, "utf8")).toString("base64"),
      }).onConflictDoNothing();
      const [row] = await db.select({ id: rawData.id }).from(rawData).where(and(eq(rawData.sourceId, src.id), eq(rawData.hashSha256, hash)));
      return reply.code(201).send({ rawDataId: row.id, hash });
    });

    // Activation explicite et datée d'une source (jamais automatique).
    admin.patch("/sources/:slug", async (req, reply) => {
      const { slug } = z.object({ slug: z.string() }).parse(req.params);
      const b = z.object({ activee: z.boolean() }).parse(req.body);
      const [src] = await db.select().from(sources).where(eq(sources.slug, slug));
      if (!src) return erreur(reply, 404, "Source inconnue.");
      if (b.activee && src.decisionJuridique === "non_evaluee") return erreur(reply, 409, "Décision du porteur du projet non consignée pour cette source.");
      await db.update(sources).set({ activee: b.activee }).where(eq(sources.id, src.id));
      return { slug, activee: b.activee };
    });

    // Photo → prix : suggestion uniquement. Rien n'est publié sans validation humaine.
    admin.post("/ocr/suggestion", async (req) => {
      const b = z.object({ texte: z.string().min(1).max(5000) }).parse(req.body);
      return { suggestion: parseOcrPrice(b.texte), avertissement: "Suggestion à valider : saisir ensuite le prix via /contributions ou /admin/observations." };
    });
  }, { prefix: "/admin" });
  });

  return root;
}
