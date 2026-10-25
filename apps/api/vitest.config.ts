import { defineConfig } from "vitest/config";

// Chaque fichier de test démarre sa propre base PGlite et rejoue les migrations : sous charge (plusieurs fichiers en parallèle,
// autres processus), le délai par défaut de 10 s peut être dépassé. On l'élargit pour éviter des échecs aléatoires.
export default defineConfig({
  test: { maxWorkers: 4, hookTimeout: 60_000, testTimeout: 30_000 },
});
