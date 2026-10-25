import { mkdir, writeFile } from "node:fs/promises";
import { BlockedError, RateLimiter, cachedGet, type Fetcher } from "./politeness.js";
import { FAMILLES_OFF } from "./off-families.js";
import { buildProposal, toCsv, type OffHit } from "./off-proposal.js";

/**
 * Construit le FICHIER DE PROPOSITION de catalogue à partir d'Open Food Facts (rien n'est importé en base).
 * Politesse : 1 requête toutes les 7 s (limite du service : 10 recherches/minute), cache local de 7 jours,
 * User-Agent identifiable (contact via SCRAPER_CONTACT), arrêt immédiat si le service refuse (403/429) ou reste indisponible (503).
 */
const SEARCH = "https://search.openfoodfacts.org/search";
const FIELDS = "code,product_name,brands,quantity,categories_tags,image_front_url,countries_tags";
const OUT = process.env.OFF_OUT_DIR ?? "../../docs";

const limiter = new RateLimiter(7000);
const fetcher: Fetcher = (url, init) => fetch(url, init);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function search(term: string): Promise<OffHit[]> {
  const q = `${term} countries_tags:"en:morocco"`;
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&page_size=40&fields=${FIELDS}`;
  const get = () => cachedGet(url, { dir: ".cache/off", ttlHours: 168, fetcher, limiter });
  try {
    return (JSON.parse((await get()).html).hits ?? []) as OffHit[];
  } catch (e) {
    if (e instanceof BlockedError) throw e;
    if (/HTTP 50[23]/.test((e as Error).message)) {
      console.log(`  service indisponible, nouvel essai dans 30 s…`);
      await sleep(30_000);
      return (JSON.parse((await get()).html).hits ?? []) as OffHit[]; // un seul nouvel essai, sinon l'erreur remonte et l'exécution s'arrête
    }
    throw e;
  }
}

const results: { famille: (typeof FAMILLES_OFF)[number]; hits: OffHit[] }[] = [];
let stopped: string | null = null;
for (const [i, famille] of FAMILLES_OFF.entries()) {
  const byCode = new Map<string, OffHit>();
  try {
    for (const term of famille.termes) for (const h of await search(term)) if (h.code && !byCode.has(h.code)) byCode.set(h.code, h);
    console.log(`[${i + 1}/${FAMILLES_OFF.length}] ${famille.slug} : ${byCode.size} résultats bruts`);
  } catch (e) {
    stopped = `${famille.slug} : ${(e as Error).message}`;
    console.error(`ARRÊT à la famille ${stopped}`);
    break;
  }
  results.push({ famille, hits: [...byCode.values()] });
}

const proposal = buildProposal(results);
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/catalogue-proposition-off.json`, JSON.stringify({ ...proposal, arretAnticipe: stopped }, null, 2), "utf8");
await writeFile(`${OUT}/catalogue-proposition-off.csv`, toCsv(proposal), "utf8");
console.log(JSON.stringify(proposal.stats, null, 2));
if (stopped) process.exitCode = 3;
