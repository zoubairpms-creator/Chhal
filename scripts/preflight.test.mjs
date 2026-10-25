import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSetup } from "./preflight.mjs";
test("aucune valeur sensible dans le diagnostic", () => {
  const result = checkSetup({ ADMIN_TOKEN: "SENSITIVE_SENTINEL", SCRAPER_CONTACT: "private@example.test", DATABASE_URL: "postgres://user:secret@host/db" }, true);
  assert.equal(result.prerequisComplets, true);
  const output = JSON.stringify(result);
  for (const secret of ["SENSITIVE_SENTINEL", "private@example.test", "user:secret"]) assert.equal(output.includes(secret), false);
});
test("le contact manquant et les outils absents restent visibles", () => {
  const result = checkSetup({});
  assert.equal(result.prerequisComplets, false);
  assert.equal(result.checks.find(c => c.id === "scraper-contact").ok, false);
  assert.equal(result.checks.find(c => c.id === "cloudflare-tools").ok, false);
  assert.equal(result.ecritures, false);
  assert.equal(result.reseau, false);
});
test("une configuration de dev n'est pas declaree prete pour la production", () => {
  assert.equal(checkSetup({ ADMIN_TOKEN: "local", SCRAPER_CONTACT: "dedicated", ALLOW_TEST_DATA: "1" }, true).prerequisComplets, false);
});
