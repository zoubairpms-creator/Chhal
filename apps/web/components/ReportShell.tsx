"use client";
import { t, type Locale } from "@chhal/i18n";

const BCP47: Record<Locale, string> = { fr: "fr-MA", ar: "ar-MA", en: "en-GB" };

export function formatDateTime(iso: string, locale: Locale) {
  return new Date(iso).toLocaleString(BCP47[locale], { dateStyle: "long", timeStyle: "short" });
}

/** Cadre commun des rapports : titre, date de génération, bouton d'impression (masqué à l'impression), pied de page. */
export function ReportShell({ locale, title, generatedAt, landscape, children }: { locale: Locale; title: string; generatedAt: string; landscape?: boolean; children: React.ReactNode }) {
  return (
    <article className="report">
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }`}</style>
      <header className="report-head">
        <div>
          <div className="report-brand">{t(locale, "app.name")}</div>
          <h1>{title}</h1>
          <p className="muted">{t(locale, "report.generated", { date: formatDateTime(generatedAt, locale) })}</p>
        </div>
        <div className="no-print" style={{ textAlign: "end" }}>
          <button onClick={() => window.print()}>{t(locale, "report.print")}</button>
          <p className="muted" style={{ maxWidth: 280 }}>
            {t(locale, "report.printHint")}
          </p>
        </div>
      </header>
      {children}
      <footer className="report-foot">{t(locale, "footer.disclaimer")}</footer>
    </article>
  );
}

export function Meta({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <table className="meta-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
