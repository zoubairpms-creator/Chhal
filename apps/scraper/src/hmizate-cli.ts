import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { collecter, envoyer, type Poster } from "./hmizate-collect.js";

/**
 * Collecte hmizate.ma (BIM). ESSAI À BLANC par défaut : lecture + rapport, aucune écriture en base.
 * Écriture réelle : --confirm ET SCRAPE_CONFIRM=1, et source activée côté API (PATCH /admin/sources/hmizate).
 * Plafond : 3 requêtes (robots.txt, liste, 1 article) sauf --max-requetes=N (jamais plus de 6). Contact : SCRAPER_CONTACT (.env).
 * Usage : pnpm --filter @chhal/scraper hmizate [--confirm] [--max-requetes=N]
 */
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
const confirm = process.argv.includes("--confirm");
if (confirm && env.SCRAPE_CONFIRM !== "1") throw new Error("--confirm exige aussi SCRAPE_CONFIRM=1 (double confirmation).");
const maxArg = process.argv.find((a) => a.startsWith("--max-requetes="));
const maxRequests = Math.min(6, Math.max(3, Number(maxArg?.split("=")[1] ?? 3) || 3));

const c = await collecter({
  fetcher: (url, init) => fetch(url, {...init,redirect:"manual",signal:AbortSignal.timeout(20_000)}),
  contact: env.SCRAPER_CONTACT ?? "",
  listUrl: env.HMIZATE_LIST_URL ?? "https://hmizate.ma/deal",
  maxRequests,
  maxArticles: 2,
});

// Copie locale de ce qui a été lu (jamais commitée : .cache est ignoré), utile pour les tests figés.
mkdirSync(".cache/hmizate", { recursive: true });
for (const a of c.articles) writeFileSync(`.cache/hmizate/${a.hash}.html`, a.html);

console.log(`Requêtes : ${c.requetes}/${maxRequests} · robots.txt ${c.robots ? (c.robots.autorise ? "autorise" : "interdit") : "non lu"} · candidats : ${c.candidats.length} · arrêt : ${c.arret ?? "aucun"}`);
for (const a of c.articles) {
  const r = a.resultat;
  console.log(r.ok
    ? `- ${a.url}\n  ${r.enseigne} · début ${r.validite.validFrom} · fin ${r.validite.validUntil ?? "inconnue"} (${r.validite.status}) · ${r.lignes.length} lignes (${r.lignes.filter((l) => l.conditionnelle).length} conditionnelles) · ${r.rejets.length} rejets`
    : `- ${a.url}\n  REJETÉ : ${r.raison}`);
}

const api = env.API_URL ?? `http://localhost:${env.PORT ?? 3001}`;
if (env.ADMIN_TOKEN && (c.articles.length || (confirm && c.arret))) {
  const post: Poster = async (path, body) => {
    const res = await fetch(`${api}${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${env.ADMIN_TOKEN}` }, body: JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(60_000) });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };
  if(confirm && c.arret)await post("/admin/collectes/journal",{sourceSlug:"hmizate",statut:c.arret.startsWith("BLOQUÉ")?"bloque":"erreur",erreur:c.arret.slice(0,500),pagesLues:c.requetes});
  const results=await envoyer(c, post, { confirm, ville: "Casablanca" });
  console.log(JSON.stringify(results,null,2));
  if(results.some(r=>/refus|rejet/i.test(r.statut)))process.exitCode=1;
} else {
  console.log("Envoi à l'API ignoré (ADMIN_TOKEN absent ou aucun article lu).");
}
if(c.arret)process.exitCode=1;
console.log(confirm ? "MODE RÉEL." : "ESSAI À BLANC : rien n'a été écrit en base.");
