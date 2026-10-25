import { notFound } from "next/navigation";
import { isLocale } from "@chhal/i18n";
import { ProductView } from "@/components/ProductView";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ ville?: string }>;
}) {
  const { locale, id } = await params;
  const { ville } = await searchParams;
  if (!isLocale(locale) || !Number.isInteger(Number(id))) notFound();
  return <ProductView locale={locale} id={Number(id)} ville={ville ?? "Casablanca"} />;
}
