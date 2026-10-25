import { notFound } from "next/navigation";
import { isLocale } from "@chhal/i18n";
import { SearchView } from "@/components/SearchView";

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  const { q } = await searchParams;
  if (!isLocale(locale)) notFound();
  return <SearchView locale={locale} initialQ={q?.slice(0, 100) ?? ""} />;
}
