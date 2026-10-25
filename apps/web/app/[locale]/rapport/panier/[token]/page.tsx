import { notFound } from "next/navigation";
import { isLocale } from "@chhal/i18n";
import { ReportBasket } from "@/components/ReportBasket";

export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  return <ReportBasket locale={locale} token={token} />;
}
