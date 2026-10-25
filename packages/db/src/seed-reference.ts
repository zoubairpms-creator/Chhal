import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { PRESETS, seedCatalogue } from "./catalogue.js";
import { chains, presetBaskets, sources, stores } from "./schema.js";

/** Reference data only. Existing observations, reviews and custom baskets are preserved. */
export async function seedReference(db: Db) {
  return db.transaction(async (tx) => {
    await tx.insert(chains).values({ slug: "bim", nom: "BIM", nomAr: "بيم" }).onConflictDoNothing();
    const [bim] = await tx.select().from(chains).where(eq(chains.slug, "bim"));
    const [store] = await tx.select().from(stores).where(and(eq(stores.chainId, bim.id), eq(stores.ville, "Casablanca")));
    if (!store) await tx.insert(stores).values({ chainId: bim.id, ville: "Casablanca" });
    // Carry forward the recorded 2026-10-18 decision; never activate collection here.
    await tx.insert(sources).values({ slug: "hmizate", nom: "hmizate.ma", url: "https://hmizate.ma", type: "catalogue", activee: false, decisionJuridique: "acceptee_par_le_porteur", decideeLe: "2026-10-18" }).onConflictDoNothing();
    const added = await seedCatalogue(tx);
    for (const p of PRESETS) {
      await tx.insert(presetBaskets).values({
        slug: p.slug, profil: p.profil, nom: p.nom, description: p.description, menage: p.menage, lignes: p.lignes,
      }).onConflictDoNothing();
    }
    return { produitsAjoutes: added, prixAjoutes: 0 };
  });
}
