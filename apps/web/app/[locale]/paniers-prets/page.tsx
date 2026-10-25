import { notFound } from "next/navigation";
import { isLocale } from "@chhal/i18n";
import { PresetsView } from "@/components/PresetsView";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PresetsView locale={locale} />;
}
