"use client";
import { useEffect, useState } from "react";
import { t, type Locale, type MessageKey } from "@chhal/i18n";
import { api, type ProductReport } from "@/lib/api";
import { HistoryChart } from "./ProductView";
import {PriceEvidence} from "./PriceEvidence";
import { Meta, ReportShell } from "./ReportShell";
import { Notice, SourceBadge, fmt } from "./ui";

const MEDALS = ["🥇", "🥈", "🥉"];

export function ReportProduct({ locale, id, ville }: { locale: Locale; id: number; ville: string }) {
  const [r, setR] = useState<ProductReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<ProductReport>(`/produits/${id}/rapport?${new URLSearchParams({ ville })}`).then(setR).catch((e) => setError(e.message || t(locale, "common.error")));
  }, [id, ville, locale]);

  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!r) return <div className="skeleton" aria-busy="true" />;
  const unit = r.prix[0]?.prixUnitaire.par ?? "";
  const points = r.historique.flatMap((h) => h.points.map((p) => ({ enseigne: h.enseigne, prixMad: p.prixMad, dateReleve: p.date, source: p.source })));

  return (
    <ReportShell locale={locale} title={t(locale, "report.productTitle")} generatedAt={r.genereLe}>
      {r.donneesDeTest && <Notice locale={locale} />}

      <section className="report-section">
        <h2>{t(locale, "report.meta")}</h2>
        <Meta
          rows={[
            [t(locale, "report.product"), <bdi key="n">{r.produit.nom}</bdi>],
            [t(locale, "report.brand"), r.produit.marque ?? "—"],
            [t(locale, "report.category"), r.produit.categorie ?? "—"],
            [t(locale, "report.format"), <bdi key="f">{r.produit.format}</bdi>],
            [t(locale, "report.city"), r.ville],
            [t(locale, "report.reference"), r.dateReference],
          ]}
        />
      </section>

      {r.prix.length === 0 ? (
        <p>{t(locale, "report.noPrices")}</p>
      ) : (
        <>
          <section className="report-section">
            <h2>{t(locale, "report.podium")}</h2>
            <ol className="podium big-podium">
              {r.top3.map((p, i) => (
                <li key={p.enseigne} className={i === 0 ? "first" : ""}>
                  <span className="medal">{MEDALS[i]}</span>
                  <span className="chain">{p.enseigne}</span>
                  <span className="price">
                    {fmt(p.prixMad)} <small>{t(locale, "common.mad")}</small>
                  </span>
                  <span className="meta">
                    {p.dateReleve} <SourceBadge locale={locale} source={p.source} /><PriceEvidence locale={locale} price={p}/>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="report-section">
            <h2>{t(locale, "report.stats")}</h2>
            {r.stats && (
              <Meta
                rows={[
                  [t(locale, "report.nChains"), String(r.stats.nbEnseignes)],
                  [t(locale, "report.min"), `${fmt(r.stats.min)} ${t(locale, "common.mad")}`],
                  [t(locale, "report.max"), `${fmt(r.stats.max)} ${t(locale, "common.mad")}`],
                  [t(locale, "report.median"), `${fmt(r.stats.mediane)} ${t(locale, "common.mad")}`],
                  [t(locale, "report.mean"), `${fmt(r.stats.moyenne)} ${t(locale, "common.mad")}`],
                  [t(locale, "report.spread"), `${fmt(r.stats.ecartMad)} ${t(locale, "common.mad")} (${r.stats.ecartPct.toLocaleString(locale === "ar" ? "ar-MA" : locale, { maximumFractionDigits: 1 })} %)`],
                ]}
              />
            )}
          </section>

          <section className="report-section">
            <h2>{t(locale, "report.allPrices")}</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t(locale, "report.rank")}</th>
                    <th>{t(locale, "product.chain")}</th>
                    <th>{t(locale, "product.price")}</th>
                    <th>{t(locale, "product.unitPrice", { unit })}</th>
                    <th>{t(locale, "report.gap")}</th>
                    <th>{t(locale, "product.date")}</th>
                    <th>{t(locale, "report.age")}</th>
                    <th>{t(locale, "product.source")}</th>
                    <th>{t(locale, "product.confidence")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.prix.map((p) => (
                    <tr key={p.enseigne}>
                      <td>{p.rang}</td>
                      <td>{p.enseigne}</td>
                      <td className="price">
                        {fmt(p.prixMad)} {t(locale, "common.mad")}
                      </td>
                      <td>{fmt(p.prixUnitaire.prix)}</td>
                      <td>{p.ecartVsPlusCherPct} %</td>
                      <td>{p.dateReleve}</td>
                      <td>{t(locale, "report.days", { n: p.ageJours })}</td>
                      <td>{t(locale, `source.${p.source}` as MessageKey)}</td>
                      <td>{t(locale, `confiance.${p.confiance}` as MessageKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-section page-break">
            <h2>{t(locale, "report.history")}</h2>
            {points.length > 0 && <HistoryChart points={points} />}
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t(locale, "product.chain")}</th>
                    <th>{t(locale, "product.date")}</th>
                    <th>{t(locale, "product.price")}</th>
                    <th>{t(locale, "product.source")}</th>
                    <th>{t(locale, "report.variation")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.historique.flatMap((h) =>
                    h.points.map((p, i) => (
                      <tr key={`${h.enseigne}-${p.date}-${i}`}>
                        <td>{h.enseigne}</td>
                        <td>{p.date}</td>
                        <td className="price">{fmt(p.prixMad)}</td>
                        <td>{t(locale, `source.${p.source}` as MessageKey)}</td>
                        <td>{i === h.points.length - 1 ? (h.variationPct === null ? t(locale, "report.noHistory") : `${h.variationPct > 0 ? "+" : ""}${h.variationPct} %`) : ""}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ReportShell>
  );
}
