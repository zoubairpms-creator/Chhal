import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
const productionEnv = {
  NODE_ENV: "production", CORS_ORIGIN: "https://chhal.example",
  DATABASE_URL: "postgresql://user:password@db.example/chhal?sslmode=require",
  ADMIN_TOKEN: "a".repeat(40), TRUST_PROXY: "1",
};
describe("demarrage de l'API en production", () => {
  it("accepte PostgreSQL, une origine HTTPS et un jeton externe", () => {
    expect(loadConfig(productionEnv)).toMatchObject({ allowTestData: false, trustProxy: true, hsts: true, port: 3001 });
  });
  it("refuse la base embarquee implicite en production", () => {
    expect(() => loadConfig({ ...productionEnv, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ ...productionEnv, DATABASE_URL: "file:dev" })).toThrow(/DATABASE_URL/);
  });
  it.each([undefined, "change-me", "trop-court"])("refuse un jeton absent ou faible (%s)", (ADMIN_TOKEN) => {
    expect(() => loadConfig({ ...productionEnv, ADMIN_TOKEN })).toThrow(/ADMIN_TOKEN/);
  });
  it.each(["*", "http://chhal.example", "https://chhal.example/path", "https://user:secret@chhal.example"])("refuse une origine CORS invalide (%s)", (CORS_ORIGIN) => {
    expect(() => loadConfig({ ...productionEnv, CORS_ORIGIN })).toThrow(/CORS_ORIGIN/);
  });
  it.each(["0", "65536", "nan", "1.5"])("refuse un port invalide (%s)", (PORT) => {
    expect(() => loadConfig({ PORT })).toThrow(/PORT/);
  });
});
