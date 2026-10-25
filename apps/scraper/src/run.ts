import { join } from "node:path";
import { BlockedError, RateLimiter, cachedGet, isAllowed, type Fetcher } from "./politeness.js";
import { modele } from "./adapters/modele.js";
import { hmizateBim } from "./adapters/hmizate.js";
import type { Adapter } from "./adapters/types.js";

export const ADAPTERS: Adapter[] = [modele, hmizateBim];

const fetcher: Fetcher = (url, init) => fetch(url, init);

/** Transforme une page lue en relevés prêts à l'envoi : date de la page (sinon du jour) et nature de la source. */
export function toReleves(adapter: Adapter, page: Adapter["pages"][number], html: string, today: string) {
  return adapter.parse(html).map((r) => ({
    ...r,
    enseigne: adapter.slug,
    ville: page.ville,
    dateReleve: page.dateReleve ?? today,
    source: adapter.source ?? ("scraping" as const),
  }));
}

/**
 * Tâche quotidienne. Garde-fous : SCRAPE_CONFIRM=1 obligatoire (aucun scraping réel par accident),
 * adaptateur enabled, robots.txt autorisant, 2 s minimum entre requêtes, cache, arrêt immédiat si blocage.
 */
export async function run(env = process.env) {
  if (env.SCRAPE_CONFIRM !== "1") {
    console.log("SCRAPE_CONFIRM!=1 : aucun scraping réel lancé (mode sûr).");
    return { skipped: true };
  }
  const api = env.API_URL;
  const token = env.ADMIN_TOKEN;
  if (!api || !token) throw new Error("API_URL et ADMIN_TOKEN requis");
  const limiter = new RateLimiter();
  const today = new Date().toISOString().slice(0, 10);
  const report: Record<string, string> = {};

  for (const adapter of ADAPTERS.filter((a) => a.enabled)) {
    try {
      const releves = [];
      for (const page of adapter.pages) {
        if (!(await isAllowed(page.url, fetcher))) {
          report[adapter.slug] = "robots.txt interdit ou inaccessible : ignoré";
          break;
        }
        const { html } = await cachedGet(page.url, { dir: join(".cache", adapter.slug), ttlHours: 20, fetcher, limiter });
        releves.push(...toReleves(adapter, page, html, today));
      }
      if (releves.length) {
        const res = await fetch(`${api}/admin/scraping/releves`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ releves }),
        });
        report[adapter.slug] = `${res.status} ${await res.text()}`;
      }
    } catch (e) {
      report[adapter.slug] = e instanceof BlockedError ? `BLOQUÉ : ${e.message}` : `Erreur : ${(e as Error).message}`;
    }
  }
  console.log(report);
  return report;
}

if (process.argv[1]?.endsWith("run.ts")) await run();
