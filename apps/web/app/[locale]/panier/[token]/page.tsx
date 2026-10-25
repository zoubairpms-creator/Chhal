import { notFound } from "next/navigation";
import { isLocale } from "@chhal/i18n";
import { SharedBasket } from "@/components/SharedBasket";

export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  return <SharedBasket locale={locale} token={token} />;
}
