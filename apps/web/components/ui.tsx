import { t, type Locale, type MessageKey } from "@chhal/i18n";

export const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SourceBadge({ locale, source }: { locale: Locale; source: string }) {
  return <span className="badge">{t(locale, `source.${source}` as MessageKey)}</span>;
}

export function Notice({ locale, children }: { locale: Locale; children?: React.ReactNode }) {
  return (
    <div className="warn" role="status">
      {children ?? t(locale, "common.testData")}
    </div>
  );
}
