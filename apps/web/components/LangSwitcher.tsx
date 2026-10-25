"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LOCALES, LOCALE_LABELS, type Locale } from "@chhal/i18n";

export function LangSwitcher({ locale }: { locale: Locale }) {
  const path = usePathname() ?? `/${locale}`;
  const rest = path.replace(/^\/[^/]+/, "");
  return (
    <nav aria-label="Langue" style={{ display: "flex", gap: 8 }}>
      {LOCALES.map((l) => (
        <Link key={l} href={`/${l}${rest}`} lang={l} aria-current={l === locale ? "true" : undefined} style={{ fontWeight: l === locale ? 800 : 400 }}>
          {LOCALE_LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}
