import { readFileSync, statSync } from "node:fs";
import { createDb, rattraperCatalogue, runMigrations } from "@chhal/db";
import { parseArticle } from "./hmizate-article.js";

/**
 * Rattrapage des prix BIM déjà publiés (migration 0006) à partir de la copie LOCALE de l'article : aucune requête réseau.
 * Par défaut : essai à blanc (lecture seule). --confirm pour écrire (sauvegarde de .data/dev requise au préalable).
 */
const confirm = process.argv.includes("--confirm");
const SNAPSHOT = "../../.cache/bim/6e5e52605fb56747b323b7b411e276b1fe1f42bd.html";
const URL_ARTICLE = "https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1085";

const html = readFileSync(SNAPSHOT, "utf8");
const parsed = parseArticle(html, URL_ARTICLE, { estimerFin: true });
if (!parsed.ok) throw new Error(`Article rejeté : ${parsed.raison}`);
console.log("Validité lue :", JSON.stringify(parsed.validite));

const h = await createDb(undefined, { dataDir: "../../.data/dev" });
try {
  if (!confirm) {
    console.log("ESSAI À BLANC : migration non appliquée, rien écrit. Relancer avec --confirm.");
  } else {
    await runMigrations(h, false);
    const r = await rattraperCatalogue(h.db, {
      chainSlug: "bim",
      source: { slug: "hmizate", nom: "hmizate.ma", url: "https://hmizate.ma", type: "catalogue-tiers", decisionJuridique: "acceptee_par_le_porteur", decideeLe: "2026-10-18" },
      articleUrl: URL_ARTICLE, html, fetchedAt: statSync(SNAPSHOT).mtime, parserVersion: parsed.parseur,
      dateReleve: "2026-09-01", validFrom: parsed.validite.validFrom, validUntil: parsed.validite.validUntil, validityStatus: parsed.validite.status,
      motif: parsed.validite.motif,
    });
    console.log(`Rattrapage terminé : ${r.remplaces.length} observation(s) remplacée(s), raw_data #${r.rawDataId}.`);
  }
} finally {
  await h.close();
}
