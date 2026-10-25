"use client";
import { useEffect, useRef, useState } from "react";
import { t, type Locale, type MessageKey } from "@chhal/i18n";
import { api, type Groupe, type ProduitHit } from "@/lib/api";
import { useRefs } from "./useCity";
import {HomeOffers} from "./HomeOffers";
import { FamilyCard } from "./FamilyCard";
import { ProductCard } from "./ProductCard";

const CATEGORIES: { key: string; value: string }[] = [
  { key: "cat.all", value: "" },
  { key: "cat.epicerie", value: "epicerie" },
  { key: "cat.frais", value: "frais,cremerie" },
  { key: "cat.boissons", value: "boissons" },
  { key: "cat.menage", value: "menage,hygiene" },
];

type Reponse = { resultats: ProduitHit[]; groupes?: Groupe[]; isoles?: ProduitHit[] };

export function SearchView({ locale, initialQ = "" }: { locale: Locale; initialQ?: string }) {
  const { villes, enseignes, ville, setVille, error: refsError } = useRefs();
  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState("");
  const [enseigne, setEnseigne] = useState("");
  const [withPrices,setWithPrices]=useState(false);
  const [promotions,setPromotions]=useState(false);
  const [rep, setRep] = useState<Reponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  // Recherche en direct : dès 2 lettres ou dès qu'une catégorie est choisie.
  useEffect(() => {
    const mine = ++seq.current;
    if (!ville) return;
    if (q.trim().length < 2 && !cat) {
      setRep(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ ville, ...(q.trim().length >= 2 ? { q: q.trim() } : {}), ...(cat ? { categorie: cat } : {}), ...(enseigne ? { enseigne } : {}),...(withPrices?{avecPrix:"1"}:{inclureSansPrix:"1"}),...(promotions?{promotions:"1"}:{}) });
        const res = await api<Reponse>(`/produits?${params}`);
        if (mine === seq.current) {
          setRep(res);
          setError(false);
        }
      } catch {
        if (mine === seq.current) setError(true);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, cat, enseigne, ville,withPrices,promotions]);

  // Anciennes réponses (sans regroupement) : on retombe sur la liste de produits.
  const groupes = rep?.groupes ?? [];
  const isoles = rep ? (rep.isoles ?? rep.resultats) : [];
  const vide = rep !== null && groupes.length === 0 && isoles.length === 0;

  return (
    <>
      <h1 className="sr-only">{t(locale, "app.tagline")}</h1>
      <section className="card searchbox" role="search">
        <input
          type="search"
          className="bigsearch"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(locale, "v1.searchHint")}
          aria-label={t(locale, "nav.search")}
          autoFocus
        />
        <div className="chips" role="group" aria-label="Catégories">
          {CATEGORIES.map((c) => (
            <button key={c.key} className={`chip ${cat === c.value ? "on" : ""}`} aria-pressed={cat === c.value} onClick={() => setCat(c.value)}>
              {t(locale, c.key as MessageKey)}
            </button>
          ))}
        </div>
        <div className="row filters">
          <label>
            {t(locale, "search.city")}
            <select value={ville} onChange={(e) => setVille(e.target.value)}>
              {villes.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "search.chain")}
            <select value={enseigne} onChange={(e) => setEnseigne(e.target.value)}>
              <option value="">{t(locale, "common.all")}</option>
              {enseignes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row"><label><input type="checkbox" checked={withPrices} onChange={e=>setWithPrices(e.target.checked)}/>{t(locale,"v1.withPrices")}</label><label><input type="checkbox" checked={promotions} onChange={e=>setPromotions(e.target.checked)}/>{t(locale,"v1.promotions")}</label></div>
      </section>

      {(error || refsError) && (
        <p className="error" role="alert">
          {t(locale, "common.error")}
        </p>
      )}
      {!rep && !loading && <><p className="muted">{t(locale, "search.hint")}</p><HomeOffers locale={locale} ville={ville}/></>}
      {loading && !rep && (
        <div aria-busy="true">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}
      {vide && !loading && <p>{t(locale, "search.noResult")}</p>}
      <div aria-live="polite" style={{ opacity: loading ? 0.6 : 1 }}>
        {groupes.map((g) => (
          <FamilyCard key={g.famille} locale={locale} groupe={g} ville={ville} />
        ))}
        {isoles.map((h) => (
          <ProductCard key={h.id} locale={locale} hit={h} ville={ville} />
        ))}
      </div>
    </>
  );
}
