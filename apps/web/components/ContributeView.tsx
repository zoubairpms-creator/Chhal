"use client";
import { useEffect, useState } from "react";
import { t, type Locale } from "@chhal/i18n";
import { api, type ProduitHit } from "@/lib/api";
import { useRefs } from "./useCity";

export function ContributeView({ locale }: { locale: Locale }) {
  const { villes, enseignes, ville, setVille } = useRefs();
  const [products, setProducts] = useState<ProduitHit[]>([]);
  const [produitId, setProduitId] = useState("");
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [enseigne, setEnseigne] = useState("");
  const [prix, setPrix] = useState("");
  const [date, setDate] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let active=true;
    api<{ resultats: ProduitHit[] }>("/produits?"+new URLSearchParams({q:query}))
      .then((r) => {if(active)setProducts(r.resultats)})
      .catch(() => {});
    return()=>{active=false;};
  }, [query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();if(busy)return;setBusy(true);
    try {
      await api("/contributions", {
        method: "POST",
        body: JSON.stringify({
          produitId: Number(produitId),
          enseigne: enseigne || enseignes[0]?.slug,
          ville,
          prixMad: Number(prix.replace(",", ".")),
          ...(date ? { dateReleve: date } : {}),
        }),
      });
      setState("ok");
    } catch (e2) {
      setMsg((e2 as Error).message);
      setState("err");
    }finally{setBusy(false);}
  }
  return (
    <>
      <h1>{t(locale, "contribute.title")}</h1>
      <p className="muted">{t(locale, "contribute.intro")}</p>
      <form className="card" onSubmit={submit}><label>{t(locale,"v1.chooseProduct")}<input value={query} onChange={e=>{setQuery(e.target.value);setProduitId("");}}/></label>
        <div className="row">
          <label>
            {t(locale, "contribute.product")}
            <select required value={produitId} onChange={(e) => setProduitId(e.target.value)}>
              <option value="" />
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "contribute.chain")}
            <select value={enseigne} onChange={(e) => setEnseigne(e.target.value)}>
              {enseignes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "contribute.city")}
            <select value={ville} onChange={(e) => setVille(e.target.value)}>
              {villes.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "contribute.price")}
            <input required inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} />
          </label>
          <label>
            {t(locale, "contribute.date")}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>{t(locale, "contribute.submit")}</button>
        </div>
        {state === "ok" && <p role="status">{t(locale, "contribute.thanks")}</p>}
        {state === "err" && (
          <p className="error" role="alert">
            {msg}
          </p>
        )}
      </form>
    </>
  );
}
