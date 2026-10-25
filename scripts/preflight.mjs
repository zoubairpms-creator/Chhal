import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

export function checkSetup(env, cloudflareInstalled = false) {
  // Return fixed messages only. Never echo environment values, addresses or tokens.
  const nonempty = key => !!env[key]?.trim();
  const checks = [
    { id: "scraper-contact", ok: nonempty("SCRAPER_CONTACT"), action: "Renseigner SCRAPER_CONTACT avec un contact dedie dans .env." },
    { id: "api-token-local", ok: nonempty("ADMIN_TOKEN"), action: "Configurer ADMIN_TOKEN localement." },
    { id: "cloudflare-tools", ok: cloudflareInstalled, action: "Installer les dependances Cloudflare deja approuvees puis lancer setup-cloudflare.mjs." },
    { id: "database-production", ok: /^postgres(ql)?:\/\//.test(env.DATABASE_URL ?? ""), action: "Configurer DATABASE_URL PostgreSQL pour le deploiement." },
    { id: "test-data-production", ok: env.ALLOW_TEST_DATA !== "1", action: "Omettre ALLOW_TEST_DATA dans l'environnement de production (le .env local reste intact)." },
  ];
  return { deploiementValide: false, ecritures: false, reseau: false, prerequisComplets: checks.every(c => c.ok), checks };
}

export function toolsInstalled(root) {
  const require = createRequire(join(root, "apps/web/package.json"));
  try { require.resolve("@opennextjs/cloudflare"); require.resolve("wrangler"); return true; }
  catch { return false; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  let fileEnv = {};
  const envPath = join(root, ".env");
  if (existsSync(envPath)) fileEnv = parseEnv(readFileSync(envPath, "utf8"));
  const report = checkSetup({ ...fileEnv, ...process.env }, toolsInstalled(root));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.prerequisComplets ? 0 : 1;
}
