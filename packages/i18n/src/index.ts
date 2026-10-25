import { fr, type MessageKey } from "./fr";
import { ar } from "./ar";
import { en } from "./en";

export type { MessageKey };
export const LOCALES = ["fr", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_LABELS: Record<Locale, string> = { fr: "Français", ar: "الدارجة", en: "English" };

const catalogs: Record<Locale, Partial<Record<MessageKey, string>>> = { fr, ar, en };

export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}
export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Traduit une clé ; repli sur le français ; remplace {variables}. */
export function t(locale: Locale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const raw = catalogs[locale][key] ?? fr[key];
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
