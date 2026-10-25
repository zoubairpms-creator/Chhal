import { t, type Locale } from "@chhal/i18n";
import type { BasketResult } from "@/lib/api";
import { fmtQty } from "./FamilyCard";
import {PriceEvidence} from "./PriceEvidence";
import { Notice, SourceBadge, fmt } from "./ui";

const unitLabel = (u: string) => (u === "l" ? "L" : u === "piece" ? "pièce" : u);

export function BasketResultView({ locale, r }: { locale: Locale; r: BasketResult }) {
  const mono = r.meilleurMonoMagasin;
  return (
    <section>
      {r.donneesDeTest && <Notice locale={locale} />}
      <h2>{t(locale, "basket.plan")}</h2>
      {r.plan.map((p) => (
        <div className="card" key={p.enseigne}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{p.enseigne}</strong>
            <span className="price">
              {t(locale, "basket.subtotal")} : {fmt(p.sousTotalMad)} {t(locale, "common.mad")}
            </span>
          </div>
          <div className="scroll">
            <table>
              <tbody>
                {p.articles.map((a, i) => (
                  <tr key={`${a.produitId}-${i}`}>
                    <td>
                      {a.nom}
                      {a.ligneFamille && (
                        <div className="muted small">
                          <span className="badge">{t(locale, "card.anyBrand")}</span>{" "}
                          {t(locale, a.ligneFamille.surplus > 0 ? "basket.familyDetailSurplus" : "basket.familyDetail", {
                            demande: fmtQty(a.ligneFamille.quantiteDemandee),
                            achete: fmtQty(a.ligneFamille.quantiteAchetee),
                            surplus: fmtQty(a.ligneFamille.surplus),
                            unit: unitLabel(a.ligneFamille.unite),
                            format: a.ligneFamille.format,
                            n: a.quantite,
                          })}
                        </div>
                      )}
                    </td>
                    <td>× {a.quantite}</td>
                    <td>{fmt(a.prixUnitaireMad)}</td>
                    <td className="price">{fmt(a.totalMad)}</td>
                    <td className="muted">
                      {a.dateReleve} <SourceBadge locale={locale} source={a.source} /><PriceEvidence locale={locale} price={a}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="card">
        <div className="muted">{t(locale, "basket.total")}</div>
        <div className="price best big">
          {fmt(r.totalMad)} {t(locale, "common.mad")}
        </div>
        {mono && (
          <p>
            <strong>{t(locale, "basket.bestSingle")}</strong> —{" "}
            {t(locale, "basket.bestSingleDetail", {
              store: mono.enseigne,
              total: fmt(mono.totalMad),
              n: mono.articlesCouverts,
              opt: fmt(mono.totalOptimiseMemesArticlesMad),
            })}
          </p>
        )}
        {r.economieMad !== null && (
          <p className="price best">
            {t(locale, "basket.savings")} : {fmt(r.economieMad)} {t(locale, "common.mad")}
          </p>
        )}
        <p className="muted">{t(locale, "basket.algo", { version: r.algorithme, date: r.dateReference })}</p>
      </div>
      {r.exclus.length > 0 && (
        <div className="warn">
          <strong>{t(locale, "basket.excluded")}</strong>
          <ul>
            {r.exclus.map((e, i) => (
              <li key={`${e.produitId ?? e.famille}-${i}`}>
                {e.nom} — {e.raison}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
