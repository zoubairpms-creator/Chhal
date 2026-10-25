import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const packages = ["packages/matching", "packages/optimizer", "packages/i18n", "apps/web", "apps/scraper", "apps/api"];
let failed = false;
for (const name of packages) {
  const cwd = join(root, name);
  const runner = join(cwd, "node_modules/vitest/vitest.mjs");
  if (!existsSync(runner)) { console.error(name + ": dependances absentes"); failed = true; continue; }
  const result = spawnSync(process.execPath, [runner, "run"], {
    cwd, stdio: "inherit", env: { ...process.env, RUN_NETWORK_TESTS: "0", DATABASE_URL_TEST: "" },
  });
  if (result.status !== 0) failed = true;
}
const native = spawnSync(process.execPath, ["--test", "scripts/preflight.test.mjs"], { cwd: root, stdio: "inherit" });
if (native.status !== 0) failed = true;
process.exitCode = failed ? 1 : 0;
