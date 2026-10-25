import robotsModule from "robots-parser";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

type RobotsFn = (url: string, txt: string) => { isAllowed(url: string, ua?: string): boolean | undefined };
const robotsParser = robotsModule as unknown as RobotsFn;

// Le contact est configurable (SCRAPER_CONTACT) : aucune adresse personnelle n'est inscrite en dur dans le code.
export const USER_AGENT = `ChhalBot/1.0 (comparateur de prix; contact: ${process.env.SCRAPER_CONTACT ?? "non configuré"})`;
export const MIN_DELAY_MS = 2000;

export class RateLimiter {
  private last = 0;
  constructor(
    private readonly minDelayMs = MIN_DELAY_MS,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}
  async wait() {
    const elapsed = this.now() - this.last;
    if (this.last && elapsed < this.minDelayMs) await this.sleep(this.minDelayMs - elapsed);
    this.last = this.now();
  }
}

export type Fetcher = (url: string, init: { headers: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>;

/** Vérifie robots.txt avant toute requête. Si robots.txt est inaccessible, on s'abstient (principe de prudence). */
export async function isAllowed(url: string, fetcher: Fetcher): Promise<boolean> {
  const origin = new URL(url).origin;
  const res = await fetcher(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } });
  if (res.status !== 200) return false;
  const robots = robotsParser(`${origin}/robots.txt`, await res.text());
  return robots.isAllowed(url, USER_AGENT) === true;
}

/** Cache disque : jamais de boucle sans cache. TTL en heures. */
export async function cachedGet(
  url: string,
  opts: { dir: string; ttlHours: number; fetcher: Fetcher; limiter: RateLimiter; now?: () => number },
): Promise<{ html: string; fromCache: boolean }> {
  const now = opts.now ?? Date.now;
  const file = join(opts.dir, createHash("sha1").update(url).digest("hex") + ".html");
  try {
    const s = await stat(file);
    if (now() - s.mtimeMs < opts.ttlHours * 3_600_000) return { html: await readFile(file, "utf8"), fromCache: true };
  } catch {
    /* pas de cache */
  }
  await opts.limiter.wait();
  const res = await opts.fetcher(url, { headers: { "user-agent": USER_AGENT } });
  if (res.status === 403 || res.status === 429) throw new BlockedError(url, res.status);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} pour ${url}`);
  const html = await res.text();
  await mkdir(opts.dir, { recursive: true });
  await writeFile(file, html);
  return { html, fromCache: false };
}

/** Le site bloque : on désactive l'adaptateur et on le signale, sans contourner la protection. */
export class BlockedError extends Error {
  constructor(public readonly url: string, public readonly status: number) {
    super(`Accès refusé (${status}) sur ${url} : adaptateur à désactiver, aucun contournement.`);
  }
}
