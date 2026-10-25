"use client";
import Link from "next/link";
import { t, type Locale } from "@chhal/i18n";
import type { ProduitHit } from "@/lib/api";
import { useBasket } from "@/lib/basket";
import { PhotoCredit, ProductPhoto } from "./ProductPhoto";
import { PriceEvidence } from "./PriceEvidence";
import { SourceBadge, fmt } from "./ui";

const MEDALS = ["🥇", "🥈", "🥉"];

export function ProductCard({ locale, hit, ville }: { locale: Locale; hit: ProduitHit; ville: string }) {
  const basket = useBasket();
  const qty = basket.qtyOf(hit.id);
  return (
    <article className="card product">
      <div className="product-head">
        <ProductPhoto image={hit.image} categorie={hit.categorie} nom={hit.nom} />
        <div style={{ flex: 1 }}>
          <Link href={`/${locale}/produit/${hit.id}?ville=${encodeURIComponent(ville)}`} className="product-name">
            {hit.nom}
          </Link>
          <div className="muted">
            {hit.marque ? `${hit.marque} · ` : ""}
            {hit.format}
          </div>
        </div>
        {qty === 0 ? (
          <button className="add" onClick={() => basket.add({ produitId: hit.id, nom: hit.nom })} aria-label={`${t(locale, "product.addToBasket")} : ${hit.nom}`}>
            + {t(locale, "product.addToBasket")}
          </button>
        ) : (
          <div className="stepper" role="group" aria-label={t(locale, "basket.quantity")}>
            <button onClick={() => basket.decrement(hit.id)} aria-label="−">
              −
            </button>
            <output aria-live="polite">{qty}</output>
            <button onClick={() => basket.add({ produitId: hit.id, nom: hit.nom })} aria-label="+">
              +
            </button>
          </div>
        )}
      </div>

      {hit.top3.length === 0 ? (
        <p className="muted">{t(locale, "product.noPrice")}</p>
      ) : (
        <ol className="podium">
          {hit.top3.map((p, i) => (
            <li key={p.enseigne} className={i === 0 ? "first" : ""}>
              <span className="medal" aria-label={t(locale, "card.rank", { n: p.rang })}>
                {MEDALS[i]}
              </span>
              <span className="chain">{p.enseigne}</span>
              <span className="price">
                {fmt(p.prixMad)} <small>{t(locale, "common.mad")}</small>
              </span>
              {p.ecartVsPlusCherPct > 0 && hit.nbEnseignes > 1 && <span className="gap">{t(locale, "card.gap", { pct: p.ecartVsPlusCherPct })}</span>}
              <span className="meta">
                {p.dateReleve} <SourceBadge locale={locale} source={p.source} /><PriceEvidence locale={locale} price={p}/>
              </span>
            </li>
          ))}
        </ol>
      )}
      <PhotoCredit image={hit.image} />
      {hit.nbEnseignes > 3 && (
        <Link className="more" href={`/${locale}/produit/${hit.id}?ville=${encodeURIComponent(ville)}`}>
          {t(locale, "card.viewAll", { n: hit.nbEnseignes })}
        </Link>
      )}
    </article>
  );
}
