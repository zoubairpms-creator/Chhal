import { describe, expect, it } from "vitest";
import { LIGNES_MANUELLES, toCsvManuel } from "../src/manuel-proposition.js";
import { parseCsvLine, parseManualCsv } from "../src/off-import.js";

describe("proposition manuelle : données", () => {
  it("aucune ligne n'a de code-barres ni de photo, toutes sont étiquetées non vérifiées avec leur confiance et leur indice", () => {
    const csv = toCsvManuel();
    const lines = csv.split("\n").filter(Boolean);
    const head = parseCsvLine(lines[0].replace("﻿", ""));
    expect(head).not.toContain("ean");
    expect(head).not.toContain("image_url");
    expect(lines.length - 1).toBe(LIGNES_MANUELLES.length);
    for (const l of lines.slice(1)) {
      const c = parseCsvLine(l);
      expect(c[head.indexOf("valider")], "valider doit rester vide").toBe("");
      expect(c[head.indexOf("verifie_le")], "verifie_le doit rester vide").toBe("");
      expect(c[head.indexOf("statut")]).toBe("NON_VERIFIE");
      expect(["haute", "moyenne", "basse"]).toContain(c[head.indexOf("confiance_marque")]);
      expect(["haute", "moyenne", "basse"]).toContain(c[head.indexOf("confiance_format")]);
      expect(c[head.indexOf("indice")].length).toBeGreaterThan(5);
    }
  });

  it("pas de doublon (famille, marque, nom, format) et formats valides", () => {
    const keys = LIGNES_MANUELLES.map((l) => `${l.famille}|${l.marque}|${l.nom}|${l.valeur}|${l.unite}`.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of LIGNES_MANUELLES) {
      expect(l.valeur, `${l.nom} ${l.marque}`).toBeGreaterThan(0);
      expect(["g", "kg", "ml", "cl", "l", "piece"]).toContain(l.unite);
      expect(l.famille).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("les familles de base absentes d'Open Food Facts sont couvertes", () => {
    const familles = new Set(LIGNES_MANUELLES.map((l) => l.famille));
    for (const f of ["riz", "sucre", "farine", "huile-de-table", "huile-d-olive", "lentilles", "pois-chiches"]) expect(familles.has(f), f).toBe(true);
  });

  it("honnêteté : les marques incertaines ne sont jamais notées « haute », les emplacements ne sont jamais notés au-dessus de « basse »", () => {
    for (const l of LIGNES_MANUELLES.filter((x) => x.marque.startsWith("("))) expect(l.confianceMarque).toBe("basse");
    const sultan = LIGNES_MANUELLES.find((l) => l.marque === "Sultan")!;
    expect(sultan.confianceMarque).toBe("basse");
    expect(sultan.remarque).toMatch(/DÉMONSTRATION FICTIVES/);
  });
});

describe("import de la proposition manuelle : garde-fous", () => {
  const head = "valider;verifie_le;enseignes_vues;statut;famille;categorie;nom;marque;format_valeur;format_unite";
  const row = (o: Record<string, string> = {}) =>
    [o.valider ?? "oui", o.verifie ?? "2026-10-18", "Marjane", "NON_VERIFIE", o.famille ?? "sucre", "epicerie", o.nom ?? "Sucre cristallisé", o.marque ?? "Cosumar", o.v ?? "1", o.u ?? "kg"].join(";");
  const parse = (...rows: string[]) => parseManualCsv([head, ...rows].join("\n"), "2026-10-20");

  it("le fichier tel que généré (rien de vérifié) n'importe RIEN", () => {
    const r = parseManualCsv(toCsvManuel(), "2026-10-20");
    expect(r.variantes).toEqual([]);
    expect(r.erreurs).toEqual([]);
    expect(r.ignores).toBe(LIGNES_MANUELLES.length);
  });

  it("une ligne « oui » vérifiée est importée, sans code-barres ni photo", () => {
    const r = parse(row());
    expect(r.erreurs).toEqual([]);
    expect(r.variantes).toEqual([{ famille: "sucre", nom: "Sucre cristallisé", marque: "Cosumar", valeur: 1, unite: "kg", categorie: "epicerie", imageUrl: null }]);
  });

  it("« oui » sans date de vérification, avec date invalide ou future : refusée", () => {
    for (const verifie of ["", "hier", "2026-13-40x", "2026-10-21"]) {
      const r = parse(row({ verifie }));
      expect(r.variantes, verifie).toEqual([]);
      expect(r.erreurs[0].message, verifie).toMatch(/vérification datée/);
    }
  });

  it("marque encore à préciser : refusée même si « oui » et vérifiée", () => {
    const r = parse(row({ marque: "(à préciser : marque lue en magasin)" }));
    expect(r.variantes).toEqual([]);
    expect(r.erreurs[0].message).toMatch(/Marque non renseignée/);
  });

  it("une fois la marque renseignée, la ligne passe ; non / vide ignorés ; colonne absente : erreur claire", () => {
    const r = parse(row({ marque: "Marque lue en magasin", famille: "farine", nom: "Farine de blé tendre", v: "5" }), row({ valider: "non" }), row({ valider: "" }));
    expect(r.variantes).toHaveLength(1);
    expect(r.ignores).toBe(2);
    expect(parseManualCsv("valider;famille\noui;x", "2026-10-20").erreurs.map((e) => e.message).join(" ")).toMatch(/Colonne absente : verifie_le/);
  });
});
