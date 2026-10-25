import { mkdir, writeFile } from "node:fs/promises";
import { LIGNES_MANUELLES, toCsvManuel } from "./manuel-proposition.js";

/** Écrit le CSV de vérification en magasin (aucun réseau, aucune base). */
const OUT = process.env.OFF_OUT_DIR ?? "../../docs";
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/catalogue-proposition-manuelle.csv`, toCsvManuel(), "utf8");
const parFamille = new Map<string, number>();
for (const l of LIGNES_MANUELLES) parFamille.set(l.famille, (parFamille.get(l.famille) ?? 0) + 1);
console.log(`${LIGNES_MANUELLES.length} lignes NON VÉRIFIÉES écrites dans ${OUT}/catalogue-proposition-manuelle.csv`);
console.log([...parFamille].map(([f, n]) => `${f} ${n}`).join(" | "));
