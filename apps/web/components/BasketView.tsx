"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { t, type Locale, type MessageKey } from "@chhal/i18n";
import { ApiError, api, type BasketResult, type Comparison } from "@/lib/api";
import { estFamille, pasDeFamille, toArticles, useBasket } from "@/lib/basket";
import { useRefs } from "./useCity";
import {SavedBaskets} from "./SavedBaskets";
import {ShoppingMode} from "./ShoppingMode";
import {budgetBalance,usableSnapshot} from "@/lib/shopping";
import { BasketResultView } from "./BasketResultView";
import { fmtQty } from "./FamilyCard";
import { fmt } from "./ui";

const unitLabel = (u: string) => (u === "l" ? "L" : u === "piece" ? "pièce" : u);

export function BasketView({ locale }: { locale: Locale }) {
  const basket = useBasket();
  const { villes, enseignes, ville, setVille } = useRefs();
  const [excl, setExcl] = useState<string[]>([]);
  const [age, setAge] = useState(30);
  const [budget,setBudget]=useState("");
  const [cmp, setCmp] = useState<Comparison | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const [offlineAt, setOfflineAt] = useState<string | null>(null);
  const [offlineMiss, setOfflineMiss] = useState(false);

  const payload = (maxMagasins: number | null = null) => ({
    ville,
    articles: toArticles(basket.items),
    maxMagasins,
    enseignesExclues: excl,
    ageMaxJours: age,
  });

  // Calcul automatique à chaque changement (panier, ville, exclusions, âge des prix).
  const signature = JSON.stringify(payload());
  useEffect(() => {
    const mine = ++seq.current;
    if (!ville || basket.items.length === 0) {
      setCmp(null);
      return;
    }
    setBusy(true);
    setShare(null);
    const timer = setTimeout(async () => {
      try {
        const res = await api<Comparison>("/paniers/comparer", { method: "POST", body: signature });
        if (mine !== seq.current) return;
        setCmp(res);
        setErr(null);
        setOfflineAt(null);
        setOfflineMiss(false);
        try {
          localStorage.setItem("chhal_last_cmp", JSON.stringify({ signature, savedAt: new Date().toISOString(), data: res }));
        } catch {
          /* stockage indisponible */
        }
        setSelected((cur) => (cur && res.options.some((o) => o.cle === cur && o.disponible) ? cur : res.recommande));
      } catch (e) {
        if (mine !== seq.current) return;
        if (e instanceof ApiError && e.status !== 503) {
          setErr(e.message || t(locale, "common.error"));
        } else {
          // Hors ligne ou serveur injoignable : on réaffiche le dernier calcul de CE panier, s'il existe.
          let saved: { signature: string; savedAt: string; data: Comparison } | null = null;
          try {
            saved = JSON.parse(localStorage.getItem("chhal_last_cmp") ?? "null");
          } catch {
            saved = null;
          }
          if (saved && saved.signature === signature && saved.data.options.some(o=>o.disponible&&usableSnapshot(saved!.savedAt,o.resultat.dateReference))) {
            setCmp(saved.data);
            setSelected((cur) => cur ?? saved!.data.recommande);
            setOfflineAt(saved.savedAt);
            setOfflineMiss(false);
          } else {
            setCmp(null);setSelected(null);setOfflineAt(null);setOfflineMiss(true);
          }
        }
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  async function saveSelected() {
    const opt = cmp?.options.find((o) => o.cle === selected);
    if (!opt) return;
    try {
      const out = await api<BasketResult & { token: string }>("/paniers", { method: "POST", body: JSON.stringify(payload(opt.maxMagasins)) });
      setShare(`${location.origin}/${locale}/panier/${out.token}`);
    } catch (e) {
      setErr((e as Error).message || t(locale, "common.error"));
    }
  }

  if (basket.items.length === 0)
    return (
      <>
        <h1>{t(locale, "basket.title")}</h1>
        <p>{t(locale, "basket.empty")}</p><SavedBaskets locale={locale}/>
      </>
    );

  const current = cmp?.options.find((o) => o.cle === selected);
  return (
    <>
      <h1>{t(locale, "basket.title")}</h1>
      <SavedBaskets locale={locale}/>
      <div className="card">
        {basket.items.map((i) =>
          estFamille(i) ? (
            <div className="basket-line" key={`f-${i.famille}`}>
              <span className="name">
                {i.noms?.[locale] ?? i.nom} <span className="badge">{t(locale, "card.anyBrand")}</span>
                <span className="muted small" style={{ display: "block" }}>
                  <Link href={`/${locale}?q=${encodeURIComponent(i.noms?.[locale] ?? i.nom)}`}>{t(locale, "basket.chooseBrand")}</Link>
                </span>
              </span>
              <div className="stepper" role="group" aria-label={t(locale, "basket.quantity")}>
                <button onClick={() => basket.decrementFamille(i.famille)} aria-label="−">
                  −
                </button>
                <output aria-live="polite" style={{ minWidth: 64 }}>
                  {fmtQty(i.quantiteBase)} {unitLabel(i.unite)}
                </output>
                <button onClick={() => basket.addFamille({ famille: i.famille, nom: i.nom, noms: i.noms, unite: i.unite })} aria-label="+" title={`+ ${fmtQty(pasDeFamille(i.unite))} ${unitLabel(i.unite)}`}>
                  +
                </button>
              </div>
              <button className="danger" onClick={() => basket.removeFamille(i.famille)}>
                {t(locale, "basket.remove")}
              </button>
            </div>
          ) : (
            <div className="basket-line" key={i.produitId}>
              <span className="name">{i.nom}</span>
              <div className="stepper" role="group" aria-label={t(locale, "basket.quantity")}>
                <button onClick={() => basket.decrement(i.produitId)} aria-label="−">
                  −
                </button>
                <output aria-live="polite">{i.quantite}</output>
                <button onClick={() => basket.setQty(i.produitId, i.quantite + 1)} aria-label="+">
                  +
                </button>
              </div>
              <button className="danger" onClick={() => basket.remove(i.produitId)}>
                {t(locale, "basket.remove")}
              </button>
            </div>
          ),
        )}
        <button className="ghost" onClick={basket.clear}>
          {t(locale, "basket.clear")}
        </button>
      </div>

      <div className="row filters" style={{ margin: "8px 0" }}>
        <label>
          {t(locale, "search.city")}
          <select value={ville} onChange={(e) => setVille(e.target.value)}>
            {villes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      {busy && <p className="muted">{t(locale, "basket.computing")}</p>}
      {offlineAt && (
        <div className="warn" role="status">
          {t(locale, "basket.lastResult", { date: new Date(offlineAt).toLocaleString(locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-MA", { dateStyle: "medium", timeStyle: "short" }) })}
        </div>
      )}
      {offlineMiss && !cmp && (
        <div className="warn" role="status">
          {t(locale, "basket.offlineNoResult")}
        </div>
      )}

      {cmp && (
        <div className="options" role="radiogroup" aria-label={t(locale, "basket.plan")}>
          {cmp.options.map((o) => (
            <button
              key={o.cle}
              role="radio"
              aria-checked={selected === o.cle}
              disabled={!o.disponible}
              className={`option ${selected === o.cle ? "on" : ""}`}
              onClick={() => setSelected(o.cle)}
            >
              <span className="opt-title">
                {t(locale, `basket.opt.${o.cle}` as MessageKey)}
                {cmp.recommande === o.cle && <span className="badge ok">{t(locale, "basket.recommended")}</span>}
              </span>
              {o.disponible ? (
                <>
                  <span className="price big">
                    {fmt(o.totalMad)} {t(locale, "common.mad")}
                  </span>
                  <span className="muted">
                    {t(locale, "basket.stores", { n: o.nbMagasins })} · {t(locale, "basket.covered", { n: o.articlesCouverts, m: o.articlesDemandes })}
                  </span>
                  {o.articlesCouverts < o.articlesDemandes && <span className="warn small">{t(locale, "basket.notCovered")}</span>}
                </>
              ) : (
                <span className="muted">{t(locale, "basket.unavailable")}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {current?.disponible && (
        <>
          <div className="row" style={{ margin: "12px 0" }}>
            <button onClick={saveSelected}>{t(locale, "basket.saveOption")}</button>
            <a className="button-link" href={`/${locale}/rapport/panier?${new URLSearchParams({ ville, age: String(age), ...(excl.length ? { excl: excl.join(",") } : {}) })}`}>
              {t(locale, "report.open")}
            </a>
          </div>
          {share && (
            <p>
              {t(locale, "basket.shareLink")} : <a href={share}>{share}</a>{" "}
              <button className="ghost" onClick={() => navigator.clipboard?.writeText(share).then(() => setCopied(true))}>
                {copied ? t(locale, "basket.copied") : t(locale, "basket.copy")}
              </button>
            </p>
          )}
          <section className="card"><label>{t(locale,"v1.budget")}<input inputMode="decimal" type="number" min="0" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
          {budget!==""&&Number.isFinite(Number(budget))&&Number(budget)>=0&&<p className={budgetBalance(Number(budget),current.totalMad)<0?"warn":"best"}>{t(locale,budgetBalance(Number(budget),current.totalMad)<0?"v1.overBudget":"v1.remaining")} : {fmt(Math.abs(budgetBalance(Number(budget),current.totalMad)))} {t(locale,"common.mad")}</p>}
          {current.articlesCouverts<current.articlesDemandes&&<p className="warn">{t(locale,"v1.partialBudget")}</p>}</section>
          <ShoppingMode locale={locale} result={current.resultat}/>
          <BasketResultView locale={locale} r={current.resultat} />
        </>
      )}

      <details className="card">
        <summary>{t(locale, "basket.options")}</summary>
        <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
          <legend className="muted">{t(locale, "basket.exclude")}</legend>
          {enseignes.map((c) => (
            <label key={c.slug} style={{ marginInlineEnd: 14, display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                style={{ minHeight: 0 }}
                checked={excl.includes(c.slug)}
                onChange={(e) => setExcl(e.target.checked ? [...excl, c.slug] : excl.filter((s) => s !== c.slug))}
              />
              {c.nom}
            </label>
          ))}
        </fieldset>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, maxWidth: 200 }}>
          {t(locale, "basket.maxAge")}
          <input type="number" min={1} max={365} value={age} onChange={(e) => setAge(Number(e.target.value) || 30)} />
        </label>
      </details>
    </>
  );
}
