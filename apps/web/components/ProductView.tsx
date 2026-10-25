"use client";
import { useEffect, useState } from "react";
import { t, type Locale } from "@chhal/i18n";
import { api, type Prix } from "@/lib/api";
import { useBasket } from "@/lib/basket";
import { PhotoCredit, ProductPhoto } from "./ProductPhoto";
import { PriceEvidence } from "./PriceEvidence";
import { Notice, SourceBadge, fmt } from "./ui";

type Point = { enseigne: string; prixMad: number; dateReleve: string; source: string };
type PrixRes = { produit: { id: number; nom: string; format: string; famille: string | null; image: { url: string; credit: string | null; ficheUrl: string | null } | null }; resultats: Prix[] };

const COLORS = ["#0b6b4d", "#c2410c", "#1d4ed8", "#a21caf", "#b45309", "#0f766e", "#be123c", "#4d7c0f"];
const MEDALS = ["🥇", "🥈", "🥉"];

export function HistoryChart({ points }: { points: Point[] }) {
  const chains = [...new Set(points.map((p) => p.enseigne))];
  const dates = [...new Set(points.map((p) => p.dateReleve))].sort();
  const prices = points.map((p) => p.prixMad);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const W = 560;
  const H = 180;
  const pad = 28;
  const x = (d: string) => (dates.length === 1 ? W / 2 : pad + ((W - 2 * pad) * dates.indexOf(d)) / (dates.length - 1));
  const y = (v: number) => (max === min ? H / 2 : H - pad - ((H - 2 * pad) * (v - min)) / (max - min));
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Historique des prix">
        <text x={4} y={y(max) + 4} fontSize="11" fill="currentColor">
          {fmt(max)}
        </text>
        <text x={4} y={y(min) + 4} fontSize="11" fill="currentColor">
          {fmt(min)}
        </text>
        {chains.map((c, i) => {
          const pts = points.filter((p) => p.enseigne === c);
          const color = COLORS[i % COLORS.length];
          return (
            <g key={c} stroke={color} fill={color}>
              <polyline fill="none" strokeWidth="2" points={pts.map((p) => `${x(p.dateReleve)},${y(p.prixMad)}`).join(" ")} />
              {pts.map((p, j) => (
                <circle key={j} cx={x(p.dateReleve)} cy={y(p.prixMad)} r="4">
                  <title>{`${c} · ${p.dateReleve} · ${fmt(p.prixMad)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="muted">
        {chains.map((c, i) => (
          <span key={c} style={{ marginInlineEnd: 12 }}>
            <span style={{ color: COLORS[i % COLORS.length] }}>●</span> {c}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function ProductView({ locale, id, ville }: { locale: Locale; id: number; ville: string }) {
  const basket = useBasket();
  const [data, setData] = useState<PrixRes | null>(null);
  const [history, setHistory] = useState<Point[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams({ ville });
    api<PrixRes>(`/produits/${id}/prix?${q}`).then(setData).catch(() => setError(true));
    api<{ points: Point[] }>(`/produits/${id}/historique?${q}`)
      .then((h) => setHistory(h.points))
      .catch(() => {});
  }, [id, ville]);

  if (error)
    return (
      <p className="error" role="alert">
        {t(locale, "common.error")}
      </p>
    );
  if (!data) return <div className="skeleton" aria-busy="true" />;
  const unit = data.resultats[0]?.prixUnitaire.par ?? "";
  const name = (r: Prix) => (locale === "ar" && r.enseigneAr ? r.enseigneAr : r.enseigne);
  const qty = basket.qtyOf(id);
  return (
    <>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <ProductPhoto image={data.produit.image} categorie={null} nom={data.produit.nom} size={96} />
        <h1 style={{ margin: 0 }}>{data.produit.nom}</h1>
      </div>
      <PhotoCredit image={data.produit.image} />
      <p className="muted">
        {data.produit.format} · {ville}
      </p>
      {data.resultats.some((r) => r.donneesDeTest) && <Notice locale={locale} />}
      <p className="no-print">
        <a href={`/${locale}/rapport/produit/${id}?ville=${encodeURIComponent(ville)}`}>{t(locale, "report.open")} →</a>
      </p>

      <section className="card">
        <h2>{t(locale, "product.prices")}</h2>
        {data.resultats.length === 0 ? (
          <p>{t(locale, "product.noPrice")}</p>
        ) : (
          <>
            <ol className="podium big-podium">
              {data.resultats.slice(0, 3).map((r, i) => (
                <li key={r.enseigne} className={i === 0 ? "first" : ""}>
                  <span className="medal">{MEDALS[i]}</span>
                  <span className="chain">{name(r)}</span>
                  <span className="price">
                    {fmt(r.prixMad)} <small>{t(locale, "common.mad")}</small>
                  </span>
                  {r.ecartVsPlusCherPct > 0 && data.resultats.length > 1 && <span className="gap">{t(locale, "card.gap", { pct: r.ecartVsPlusCherPct })}</span>}
                  <span className="meta">
                    {r.dateReleve} <SourceBadge locale={locale} source={r.source} /><PriceEvidence locale={locale} price={r}/> · {t(locale, `confiance.${r.confiance}` as "confiance.haute")}
                  </span>
                </li>
              ))}
            </ol>
            {data.resultats.length > 3 && (
              <details>
                <summary>{t(locale, "card.viewAll", { n: data.resultats.length })}</summary>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t(locale, "product.chain")}</th>
                        <th>{t(locale, "product.price")}</th>
                        <th>{t(locale, "product.unitPrice", { unit })}</th>
                        <th>{t(locale, "product.date")}</th>
                        <th>{t(locale, "product.source")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.resultats.map((r) => (
                        <tr key={r.enseigne}>
                          <td>{name(r)}</td>
                          <td className="price">
                            {fmt(r.prixMad)} {t(locale, "common.mad")}
                          </td>
                          <td>{fmt(r.prixUnitaire.prix)}</td>
                          <td>{r.dateReleve}</td>
                          <td>
                            <SourceBadge locale={locale} source={r.source} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
        {qty === 0 ? (
          <button style={{ marginTop: 12 }} onClick={() => basket.add({ produitId: id, nom: data.produit.nom })}>
            + {t(locale, "product.addToBasket")}
          </button>
        ) : (
          <div className="stepper" style={{ marginTop: 12 }} role="group" aria-label={t(locale, "basket.quantity")}>
            <button onClick={() => basket.decrement(id)} aria-label="−">
              −
            </button>
            <output aria-live="polite">{qty}</output>
            <button onClick={() => basket.add({ produitId: id, nom: data.produit.nom })} aria-label="+">
              +
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>{t(locale, "product.history")}</h2>
        {history.length ? <HistoryChart points={history} /> : <p className="muted">{t(locale, "product.noHistory")}</p>}
      </section>
    </>
  );
}
