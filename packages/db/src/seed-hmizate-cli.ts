import { createDb, runMigrations } from "./index.js";
import { seedHmizateProducts } from "./seed-hmizate.js";

const url = process.env.DATABASE_URL;
const handle = await createDb(url, { dataDir: ".data/dev" });
if (!url) console.log("DATABASE_URL absent : base embarquée PGlite (.data/dev).");
await runMigrations(handle, !!url);

const result = await seedHmizateProducts(handle.db);
console.log(`Seed hmizate : ${result.created} produits créés sur ${result.total}.`);
process.exit(0);
