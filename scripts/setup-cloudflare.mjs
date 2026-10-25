import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { toolsInstalled } from "./preflight.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
if (!toolsInstalled(root)) {
  console.error("Outils absents. Executer depuis la racine : corepack pnpm --filter @chhal/web add -D @opennextjs/cloudflare wrangler");
  process.exitCode = 1;
} else {
  const web = join(root, "apps/web");
  const target = join(web, "open-next.config.ts");
  if (!existsSync(target)) copyFileSync(join(web, "open-next.config.ts.example"), target);
  const path = join(web, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  pkg.scripts["build:worker"] = "opennextjs-cloudflare build";
  pkg.scripts["preview:worker"] = "opennextjs-cloudflare preview";
  // Deployment stays a manual, separately approved operation.
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Configuration Cloudflare preparee. Aucun login, deploiement ni provisionnement execute.");
}
