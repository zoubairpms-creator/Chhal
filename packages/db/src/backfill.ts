import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "./client.js";
import { chains, observationReviews, priceObservations, rawData, sources, stores } from "./schema.js";

export type RattrapageOptions = {
  /** Enseigne dont les prix de catalogue doivent être enrichis (ex. « bim »). */
  chainSlug: string;
  source: { slug: string; nom: string; url: string; type: string; decisionJuridique: string; decideeLe: string };
  articleUrl: string;
  /** HTML conservé tel quel (donnée brute). */
  html: string;
  /** Instant où ce HTML a été récupéré (preuve : horodatage de la copie locale). */
  fetchedAt: Date;
  parserVersion: string;
  dateReleve: string;
  validFrom: string;
  validUntil: string | null;
  validityStatus: "connue" | "estimee" | "inconnue";
  motif: string;
  reviewer?: string;
};

/**
 * Enrichit (sans jamais modifier) les prix de catalogue déjà publiés d'une enseigne : avis « rejeté » sur l'ancienne ligne,
 * nouvelle ligne identique + traçabilité (URL, validité, donnée brute), publiée. Idempotent : les lignes déjà enrichies (valid_from renseigné) sont ignorées.
 */
export async function rattraperCatalogue(db: Db, o: RattrapageOptions) {
  const reviewer = o.reviewer ?? "rattrapage-0006";
  return db.transaction(async (tx) => {
    const todo = await tx
      .select({ o: priceObservations })
      .from(priceObservations)
      .innerJoin(stores, eq(stores.id, priceObservations.storeId))
      .innerJoin(chains, eq(chains.id, stores.chainId))
      .where(and(eq(chains.slug, o.chainSlug), eq(priceObservations.source, "catalogue"), eq(priceObservations.dateReleve, o.dateReleve), isNull(priceObservations.validFrom)));
    const publiees: typeof todo = [];
    for (const r of todo) {
      const avis = await tx.select().from(observationReviews).where(eq(observationReviews.observationId, r.o.id));
      const dernier = avis.sort((a, b) => b.id - a.id)[0];
      if (dernier?.decision === "publie") publiees.push(r);
    }
    if (publiees.length === 0) return { remplaces: [] as { ancien: number; nouveau: number }[], rawDataId: null as number | null };

    await tx.insert(sources).values({ ...o.source, activee: false }).onConflictDoNothing({ target: sources.slug });
    const [src] = await tx.select().from(sources).where(eq(sources.slug, o.source.slug));
    const hash = createHash("sha256").update(o.html).digest("hex");
    await tx
      .insert(rawData)
      .values({
        sourceId: src.id, url: o.articleUrl, hashSha256: hash, contentType: "text/html", httpStatus: null, fetchedAt: o.fetchedAt,
        parserVersion: o.parserVersion, contenuGzipB64: gzipSync(Buffer.from(o.html, "utf8")).toString("base64"),
        note: "Copie locale existante au moment du rattrapage (migration 0006) ; date de récupération = horodatage du fichier.",
      })
      .onConflictDoNothing();
    const [raw] = await tx.select().from(rawData).where(and(eq(rawData.sourceId, src.id), eq(rawData.hashSha256, hash)));

    const remplaces: { ancien: number; nouveau: number }[] = [];
    for (const { o: old } of publiees) {
      await tx.insert(observationReviews).values({ observationId: old.id, decision: "rejete", reviewer, motif: `Remplacée par une ligne enrichie (traçabilité, validité, donnée brute) : ${o.motif}` });
      const [n] = await tx
        .insert(priceObservations)
        .values({
          productId: old.productId, storeId: old.storeId, prixMad: old.prixMad, prixUnitaireMad: old.prixUnitaireMad, dateReleve: old.dateReleve,
          source: old.source, confiance: old.confiance, photoId: old.photoId, testOnly: old.testOnly,
          observedAt: o.fetchedAt, validFrom: o.validFrom, validUntil: o.validUntil, validityStatus: o.validityStatus,
          sourceUrl: o.articleUrl, rawDataId: raw.id, collectionMethod: "scraping-differe", devise: "MAD",
          confianceMotif: "Prix promotionnel d'un site tiers (hmizate.ma) ; fin de validité non écrite dans l'article.",
        })
        .returning({ id: priceObservations.id });
      await tx.insert(observationReviews).values({ observationId: n.id, decision: "publie", reviewer, motif: `Remplace #${old.id}` });
      remplaces.push({ ancien: old.id, nouveau: n.id });
    }
    return { remplaces, rawDataId: raw.id };
  });
}
