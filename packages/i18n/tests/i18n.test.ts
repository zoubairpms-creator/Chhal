import { describe, expect, it } from "vitest";
import { LOCALES, dirOf, isLocale, t } from "../src/index";
import { fr } from "../src/fr";
import { ar } from "../src/ar";
import { en } from "../src/en";

describe("i18n", () => {
  it("toutes les clés ar et en existent en français", () => {
    for (const k of [...Object.keys(ar), ...Object.keys(en)]) expect(k in fr, k).toBe(true);
  });
  it("l'arabe et l'anglais couvrent toutes les clés de l'interface (hors nom d'app)", () => {
    for (const k of Object.keys(fr)) {
      if (k === "app.name" || k === "common.mad") continue;
      expect(k in ar, `ar:${k}`).toBe(true);
      if (k !== "common.mad") expect(k in en, `en:${k}`).toBe(true);
    }
  });
  it("repli sur le français et variables", () => {
    expect(t("en", "app.name")).toBe("Chhal");
    expect(t("fr", "basket.algo", { version: "1.0.0", date: "2026-10-17" })).toContain("1.0.0");
    expect(t("ar", "product.unitPrice", { unit: "kg" })).toContain("kg");
  });
  it("direction et locales", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("fr")).toBe("ltr");
    expect(LOCALES.every(isLocale)).toBe(true);
    expect(isLocale("de")).toBe(false);
  });
});
