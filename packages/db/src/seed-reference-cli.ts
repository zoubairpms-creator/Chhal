import { createDb } from "./client.js";
import { seedReference } from "./seed-reference.js";

// Run only after reviewing the target and applying migrations separately.
if (!process.argv.includes("--confirm")) throw new Error("Initialisation non executee : ajouter --confirm apres validation de la base cible.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est obligatoire pour l'initialisation distante.");
const handle = await createDb(process.env.DATABASE_URL);
try {
  console.log(JSON.stringify(await seedReference(handle.db)));
} finally { await handle.close(); }
