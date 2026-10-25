import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dirOf, isLocale, t } from "@chhal/i18n";
import { BasketBar } from "@/components/BasketBar";
import { LangSwitcher } from "@/components/LangSwitcher";
import { PwaRegister } from "@/components/PwaRegister";
import "../globals.css";

export const metadata: Metadata = {
  title: "Chhal — شحال",
  description: "Comparateur de prix des supermarchés au Maroc",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Chhal", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#0b6b4d", width: "device-width", initialScale: 1 };

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale === "ar" ? "ar-MA" : locale} dir={dirOf(locale)}>
      <body>
        <PwaRegister locale={locale} />
        <div className="wrap">
          <header className="top">
            <Link className="logo" href={`/${locale}`}>
              {t(locale, "app.name")}
            </Link>
            <nav className="main">
              <Link href={`/${locale}`}>{t(locale, "nav.search")}</Link>
              <Link href={`/${locale}/paniers-prets`}>{t(locale, "nav.presets")}</Link>
              <Link href={`/${locale}/panier`}>{t(locale, "nav.basket")}</Link>
              <Link href={`/${locale}/contribuer`}>{t(locale, "nav.contribute")}</Link>
            </nav>
            <LangSwitcher locale={locale} />
          </header>
          <p className="tagline">{t(locale, "app.tagline")}</p>
          {children}
          <footer className="foot">{t(locale, "footer.disclaimer")}</footer>
          <BasketBar locale={locale} />
        </div>
      </body>
    </html>
  );
}
