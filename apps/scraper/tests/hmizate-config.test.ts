import { describe, expect, it } from "vitest";
import { hmizateBim } from "../src/adapters/hmizate.js";
import { modele } from "../src/adapters/modele.js";
import { ADAPTERS, toReleves } from "../src/run.js";

describe("adaptateur hmizate : désactivé et daté par le catalogue", () => {
  it("est désactivé : la tâche quotidienne ne le lit jamais", () => {
    expect(hmizateBim.enabled).toBe(false);
    expect(ADAPTERS.filter((a) => a.enabled)).toEqual([]);
  });

  it("déclare la source « catalogue » et la date de validité du catalogue", () => {
    expect(hmizateBim.source).toBe("catalogue");
    expect(hmizateBim.pages[0].dateReleve).toBe("2026-09-01");
  });
});

describe("toReleves : date et source des relevés", () => {
  const html = '<div class="product" data-size="1 kg"><span class="name">Sucre</span><span class="price">8,90 DH</span></div>';

  it("page datée : on garde la date du catalogue, jamais celle du jour, et la source catalogue", () => {
    const r = toReleves({ ...modele, source: "catalogue", pages: [{ ville: "Casablanca", url: "x", dateReleve: "2026-09-01" }] }, { ville: "Casablanca", url: "x", dateReleve: "2026-09-01" }, html, "2026-10-17");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ dateReleve: "2026-09-01", source: "catalogue", enseigne: "modele", ville: "Casablanca", prixMad: 8.9 });
  });

  it("page sans date : date du jour et source scraping par défaut", () => {
    const r = toReleves(modele, { ville: "Casablanca", url: "x" }, html, "2026-10-17");
    expect(r[0]).toMatchObject({ dateReleve: "2026-10-17", source: "scraping" });
  });
});
