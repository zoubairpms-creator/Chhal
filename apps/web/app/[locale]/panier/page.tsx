import { notFound } from "next/navigation";
import { isLocale } from "@chhal/i18n";
import { BasketView } from "@/components/BasketView";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BasketView locale={locale} />;
}
