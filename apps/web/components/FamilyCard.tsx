"use client";
import { t, type Locale } from "@chhal/i18n";
import type { Groupe } from "@/lib/api";
import { pasDeFamille, useBasket, type FamilleItem } from "@/lib/basket";
import { ProductCard } from "./ProductCard";
import { PriceEvidence } from "./PriceEvidence";
import { SourceBadge, fmt } from "./ui";

const MEDALS = ["🥇", "🥈", "🥉"];
const UNITE: Record<string, FamilleItem["unite"]> = { masse: "kg", volume: "l", piece: "piece" };
const unitLabel = (u: string) => (u === "l" ? "L" : u === "piece" ? "pièce" : u);
export const fmtQty = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** Carte d'une famille : meilleur prix au kg / au litre / à la pièce, variantes dépliables, ajout « n'importe quelle marque ». */
export function FamilyCard({ locale, groupe, ville }: { locale: Locale; groupe: Groupe; ville: string }) {
  const basket = useBasket();
  const unite = UNITE[groupe.classe];
  const qty = basket.qtyOfFamille(groupe.famille);
  const nom = groupe.nom[locale];
  return (
    <article className="card product family">
      <div className="product-head">
        <div style={{ flex: 1 }}>
          <strong className="product-name">{nom}</strong>
          <div className="muted">
            {t(locale, "family.variants", { n: groupe.nbVariantes })}
            {groupe.nbVariantesAvecPrix < groupe.nbVariantes && ` · ${t(locale, "family.withPrice", { n: groupe.nbVariantesAvecPrix })}`}
          </div>
        </div>
        {qty === 0 ? (
          <button className="add" onClick={() => basket.addFamille({ famille: groupe.famille, nom, noms: groupe.nom, unite })} aria-label={`${t(locale, "card.addFamily")} : ${nom}`}>
            + {t(locale, "card.addFamily")}
          </button>
        ) : (
          <div className="stepper" role="group" aria-label={`${nom} (${t(locale, "card.anyBrand")})`}>
            <button onClick={() => basket.decrementFamille(groupe.famille)} aria-label="−">
              −
            </button>
            <output aria-live="polite" style={{ minWidth: 64 }}>
              {fmtQty(qty)} {unitLabel(unite)}
            </output>
            <button onClick={() => basket.addFamille({ famille: groupe.famille, nom, noms: groupe.nom, unite })} aria-label="+">
              +
            </button>
          </div>
        )}
      </div>
      {qty > 0 && <p className="muted small">{t(locale, "card.anyBrand")} · {t(locale, "family.step", { n: fmtQty(pasDeFamille(unite)), unit: unitLabel(unite) })}</p>}

      {groupe.top3.length === 0 ? (
        <p className="muted">{t(locale, "product.noPrice")}</p>
      ) : (
        <ol className="podium">
          {groupe.top3.map((p, i) => (
            <li key={`${p.produitId}-${p.enseigne}`} className={i === 0 ? "first" : ""}>
              <span className="medal" aria-label={t(locale, "card.rank", { n: p.rang })}>
                {MEDALS[i]}
              </span>
              <span className="chain">
                {p.enseigne} <span className="muted small">· {p.marque ?? p.produit} {p.format}</span>
              </span>
              <span className="price">
                {fmt(p.prixUnitaire)} <small>{t(locale, "common.mad")}/{unitLabel(p.par)}</small>
              </span>
              {p.ecartVsPlusCherPct > 0 && groupe.top3.length > 1 && <span className="gap">{t(locale, "card.gap", { pct: p.ecartVsPlusCherPct })}</span>}
              <span className="meta">
                {fmt(p.prixMad)} {t(locale, "common.mad")} · {p.dateReleve} <SourceBadge locale={locale} source={p.source} /><PriceEvidence locale={locale} price={p}/>
              </span>
            </li>
          ))}
        </ol>
      )}

      <details style={{ marginTop: 10 }}>
        <summary>{t(locale, "family.showVariants", { n: groupe.variantes.length })}</summary>
        {groupe.variantes.map((v) => (
          <ProductCard key={v.id} locale={locale} hit={v} ville={ville} />
        ))}
      </details>
    </article>
  );
}
