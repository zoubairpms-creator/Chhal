import { readFileSync } from "node:fs";
import { parseManualCsv, parseValidatedCsv } from "./off-import.js";

/**
 * Importe dans le catalogue les lignes « valider = oui » du CSV validé, via l'API d'administration.
 * Par défaut : ESSAI À BLANC (rien n'est écrit). Ajouter --confirm pour importer pour de bon.
 * Usage : pnpm --filter @chhal/scraper off:import [fichier.csv] [--manuel] [--confirm]
 * --manuel : CSV de la proposition manuelle (marques vérifiées en magasin : « verifie_le » obligatoire).
 * Le jeton est lu dans .env (ADMIN_TOKEN) ou l'environnement ; il n'est jamais affiché.
 */
const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const manuel = args.includes("--manuel");
const file = args.find((a) => !a.startsWith("--")) ?? (manuel ? "../../docs/catalogue-proposition-manuelle.csv" : "../../docs/catalogue-proposition-off.csv");

function envFromFile(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync("../../.env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
  } catch {
    return {};
  }
}
const env = { ...envFromFile(), ...process.env };
const token = env.ADMIN_TOKEN;
if (!token) throw new Error("ADMIN_TOKEN introuvable (.env ou environnement).");
const base = env.API_URL ?? `http://localhost:${env.PORT ?? 3001}`;

const { variantes, ignores, erreurs } = (manuel ? parseManualCsv : parseValidatedCsv)(readFileSync(file, "utf8"));
console.log(`${variantes.length} ligne(s) « oui », ${ignores} ignorée(s) (non « oui »), ${erreurs.length} erreur(s) de lecture.`);
if (erreurs.length) {
  for (const e of erreurs.slice(0, 20)) console.error(`  ligne ${e.ligne} : ${e.message}`);
  process.exit(2);
}
if (variantes.length === 0) { console.log("Rien à importer."); process.exit(0); }

const res = await fetch(`${base}/admin/catalogue/import`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({ origine: manuel ? "manuel" : "openfoodfacts", essaiABlanc: !confirm, variantes }),
});
const body = (await res.json()) as { erreurs?: { ligne: number; message: string }[]; [k: string]: unknown };
if (!res.ok) {
  console.error(`Refusé (${res.status}) : ${body.erreur ?? ""}`);
  for (const e of (body.erreurs ?? []).slice(0, 30)) console.error(`  ligne ${e.ligne} : ${e.message}`);
  process.exit(3);
}
console.log(confirm ? "IMPORT TERMINÉ :" : "ESSAI À BLANC (rien n'a été écrit) :", JSON.stringify(body));
if (!confirm) console.log("Relancez avec --confirm pour importer.");
