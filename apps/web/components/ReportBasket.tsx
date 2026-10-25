"use client";
import { useEffect, useState } from "react";
import { t, type Locale, type MessageKey } from "@chhal/i18n";
import { api, type BasketReport } from "@/lib/api";
import { toArticles, useBasket } from "@/lib/basket";
import { BasketResultView } from "./BasketResultView";
import { Meta, ReportShell } from "./ReportShell";
import { Notice, fmt } from "./ui";

type Props = { locale: Locale; token?: string; ville?: string; age?: number; excl?: string[] };

export function ReportBasket({ locale, token, ville, age, excl }: Props) {
  const basket = useBasket();
  const [report, setReport] = useState<BasketReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = JSON.stringify(toArticles(basket.items));
  useEffect(() => {
    if (token) {
      api<BasketReport>(`/paniers/${encodeURIComponent(token)}/rapport`).then(setReport).catch((e) => setError(e.message));
      return;
    }
    if (basket.items.length === 0 || !ville) return;
    api<BasketReport>("/rapports/panier", {
      method: "POST",
      body: JSON.stringify({
        ville,
        articles: toArticles(basket.items),
        maxMagasins: null,
        enseignesExclues: excl ?? [],
        ageMaxJours: age ?? 30,
      }),
    })
      .then(setReport)
      .catch((e) => setError(e.message || t(locale, "common.error")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ville, age, (excl ?? []).join(","), items]);

  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!report) return <div className="skeleton" aria-busy="true" />;

  const name = (cle: string) => t(locale, `basket.opt.${cle}` as MessageKey);
  const rec = report.options.find((o) => o.cle === report.recommande);
  const recOk = rec && rec.disponible ? rec : null;
  const optimal = report.options.find((o) => o.cle === "optimal");
  const mono = optimal && optimal.disponible ? optimal.resultat.meilleurMonoMagasin : null;
  const savings = optimal && optimal.disponible ? optimal.resultat.economieMad : null;

  return (
    <ReportShell locale={locale} title={t(locale, "report.basketTitle")} generatedAt={report.genereLe} landscape>
      {report.donneesDeTest && <Notice locale={locale} />}

      <section className="report-section">
        <h2>{t(locale, "report.meta")}</h2>
        <Meta
          rows={[
            [t(locale, "report.city"), report.ville],
            [t(locale, "report.reference"), report.dateReference],
            [t(locale, "report.algorithm"), `v${report.algorithme}`],
            [t(locale, "report.maxAge"), t(locale, "report.days", { n: report.parametres.ageMaxJours })],
            [t(locale, "report.excludedChains"), report.parametres.enseignesExclues.length ? report.parametres.enseignesExclues.join(", ") : t(locale, "report.none")],
            [
              t(locale, "report.sources"),
              report.sources.types.length
                ? `${report.sources.types.map((s) => t(locale, `source.${s}` as MessageKey)).join(", ")} — ${t(locale, "report.readings", { from: report.sources.dateMin ?? "", to: report.sources.dateMax ?? "" })}`
                : t(locale, "report.none"),
            ],
            ...(report.panierEnregistre ? ([[t(locale, "report.savedBasket"), `${report.panierEnregistre.token} (${report.panierEnregistre.creeLe.slice(0, 10)})`]] as [string, string][]) : []),
          ]}
        />
      </section>

      <section className="report-section">
        <h2>{t(locale, "report.summary")}</h2>
        {recOk ? (
          <p>
            <strong>{t(locale, "report.recommended")} : {name(recOk.cle)}</strong> — <span className="price best big">{fmt(recOk.totalMad)} {t(locale, "common.mad")}</span>
            <br />
            {t(locale, "basket.stores", { n: recOk.nbMagasins })} · {t(locale, "basket.covered", { n: recOk.articlesCouverts, m: recOk.articlesDemandes })}
            {mono && (
              <>
                <br />
                {t(locale, "basket.bestSingle")} : {t(locale, "basket.bestSingleDetail", { store: mono.enseigne, total: fmt(mono.totalMad), n: mono.articlesCouverts, opt: fmt(mono.totalOptimiseMemesArticlesMad) })}
              </>
            )}
            {savings !== null && (
              <>
                <br />
                <strong>{t(locale, "basket.savings")} : {fmt(savings)} {t(locale, "common.mad")}</strong>
              </>
            )}
          </p>
        ) : (
          <p>{t(locale, "basket.notCovered")}</p>
        )}
      </section>

      <section className="report-section">
        <h2>{t(locale, "report.scenarios")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t(locale, "report.scenario")}</th>
              <th>{t(locale, "report.stores")}</th>
              <th>{t(locale, "report.coverage")}</th>
              <th>{t(locale, "report.total")}</th>
            </tr>
          </thead>
          <tbody>
            {report.options.map((o) => (
              <tr key={o.cle}>
                <td>
                  {name(o.cle)}
                  {o.cle === report.recommande && " ★"}
                </td>
                {o.disponible ? (
                  <>
                    <td>{o.nbMagasins}</td>
                    <td>{t(locale, "basket.covered", { n: o.articlesCouverts, m: o.articlesDemandes })}</td>
                    <td className="price">{fmt(o.totalMad)} {t(locale, "common.mad")}</td>
                  </>
                ) : (
                  <td colSpan={3}>{t(locale, "report.unavailable", { reason: o.raison })}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-section page-break">
        <h2>{t(locale, "report.matrix")}</h2>
        <p className="muted">{t(locale, "report.matrixHelp")}</p>
        {report.matrice.some((m) => m.famille) && <p className="muted">{t(locale, "report.familyLine")}</p>}
        <div className="scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th>{t(locale, "report.article")}</th>
                <th>{t(locale, "report.qty")}</th>
                {report.enseignes.map((e) => (
                  <th key={e}>{e}</th>
                ))}
                <th>{t(locale, "report.best")}</th>
              </tr>
            </thead>
            <tbody>
              {report.matrice.map((m) => (
                <tr key={m.produitId ?? m.famille}>
                  <td>
                    {m.nom}
                    <div className="muted">{m.format}</div>
                  </td>
                  <td>{m.quantite}</td>
                  {m.prix.map((c) => {
                    const isBest = m.meilleur && c.enseigne === m.meilleur.enseigne;
                    return (
                      <td key={c.enseigne} className={`${isBest ? "best price" : ""} ${c.exclue || c.perime ? "dim" : ""}`}>
                        {c.prixMad === null ? "—" : fmt(c.prixMad)}
                        {c.prixMad !== null && (
                          <div className="muted small">
                            {c.detail && <div>{c.detail}</div>}
                            {c.dateReleve}
                            {c.perime && ` · ${t(locale, "report.stale")}`}
                            {c.exclue && ` · ${t(locale, "report.excludedTag")}`}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    {m.meilleur ? (
                      <>
                        <strong>{m.meilleur.enseigne}</strong>
                        <div className="muted small">
                          {fmt(m.meilleur.prixMad)} · {fmt(m.meilleur.prixUnitaire.prix)}/{m.meilleur.prixUnitaire.par}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {report.options.map(
        (o) =>
          o.disponible && (
            <section key={o.cle} className="report-section page-break">
              <h2>{t(locale, "report.detail", { name: name(o.cle) })}</h2>
              <BasketResultView locale={locale} r={o.resultat} />
            </section>
          ),
      )}

      <section className="report-section">
        <h2>{t(locale, "report.methodology")}</h2>
        <ol className="method">
          {(["report.method1", "report.method2", "report.method3", "report.method4"] as const).map((k) => (
            <li key={k}>{t(locale, k)}</li>
          ))}
        </ol>
      </section>
    </ReportShell>
  );
}
