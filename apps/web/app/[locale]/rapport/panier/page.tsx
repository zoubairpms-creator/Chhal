import { notFound } from "next/navigation";
import { isLocale } from "@chhal/i18n";
import { ReportBasket } from "@/components/ReportBasket";

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ville?: string; age?: string; excl?: string }> }) {
  const { locale } = await params;
  const { ville, age, excl } = await searchParams;
  if (!isLocale(locale)) notFound();
  const ageN = Number(age);
  return <ReportBasket locale={locale} ville={ville ?? "Casablanca"} age={Number.isInteger(ageN) && ageN > 0 ? ageN : 30} excl={excl ? excl.split(",").filter(Boolean) : []} />;
}
