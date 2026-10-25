"use client";
import Link from "next/link";
import { t, type Locale } from "@chhal/i18n";
import { useBasket } from "@/lib/basket";

/** Barre fixe en bas de l'écran : visible dès qu'il y a un article dans le panier. */
export function BasketBar({ locale }: { locale: Locale }) {
  const { items, count } = useBasket();
  if (items.length === 0) return null;
  return (
    <div className="basketbar" role="region" aria-label={t(locale, "nav.basket")}>
      <span>{t(locale, "bar.items", { n: count })}</span>
      <Link href={`/${locale}/panier`}>{t(locale, "bar.view")} →</Link>
    </div>
  );
}
