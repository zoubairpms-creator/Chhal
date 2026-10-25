import type { AppOptions } from "./app.js";

/** Validate before opening a database. Never include environment values in errors. */
export function loadConfig(env: Record<string, string | undefined>): AppOptions & { port: number } {
  const production = env.NODE_ENV === "production";
  if (production && !env.CORS_ORIGIN) throw new Error("CORS_ORIGIN est obligatoire en production.");
  if (production && env.ALLOW_TEST_DATA === "1") throw new Error("ALLOW_TEST_DATA=1 est interdit en production : les données de test ne doivent jamais être publiques.");
  if (production) {
    try {
      const origin = new URL(env.CORS_ORIGIN!);
      if (origin.protocol !== "https:" || origin.origin !== env.CORS_ORIGIN || origin.username || origin.password) throw new Error();
    } catch { throw new Error("CORS_ORIGIN doit être une origine HTTPS sans chemin en production."); }
    try {
      const db = new URL(env.DATABASE_URL ?? "");
      if (!["postgres:", "postgresql:"].includes(db.protocol) || !db.hostname || db.pathname.length < 2) throw new Error();
    } catch { throw new Error("DATABASE_URL PostgreSQL est obligatoire en production (pas de base embarquée)."); }
    if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32 || /\s/.test(env.ADMIN_TOKEN) || /^(change[-_]?me|replace[-_]?me)/i.test(env.ADMIN_TOKEN)) {
      throw new Error("ADMIN_TOKEN doit contenir au moins 32 caractères, sans espaces, en production.");
    }
  }
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT doit être un entier entre 1 et 65535.");
  return {
    port, adminToken: env.ADMIN_TOKEN, allowTestData: env.ALLOW_TEST_DATA === "1",
    corsOrigin: env.CORS_ORIGIN, trustProxy: env.TRUST_PROXY === "1", hsts: production,
  };
}
