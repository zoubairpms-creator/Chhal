"use client";
import { useState } from "react";
import { t, type Locale } from "@chhal/i18n";
import { ApiError, api } from "@/lib/api";
import {AdminMonitor} from "./AdminMonitor";
import {PriceEvidence} from "./PriceEvidence";
import type {ProduitHit,PriceTrace} from "@/lib/api";
import { fmt } from "./ui";

type Obs = {
  id: number; produit: string; enseigne: string; ville: string; prixMad: number;
  dateReleve: string; source: string; medianePubliee: number | null; suspect: boolean;
};
type Cand = { id:number;libelleSource:string;score:number;productIdPropose:number|null;produitPropose?:{id:number;nom:string;formatValeur:string;formatUnite:string}|null;payload:{row:{prixMad:number;ville:string;dateReleve:string};trace:PriceTrace}|null };
type ImportErr = { ligne: number; colonne?: string; message: string };
type ImportOk = { observations: number; lignes: number; essaiABlanc: boolean };

export function AdminView({ locale }: { locale: Locale }) {
  const [token, setToken] = useState("");
  const [obs, setObs] = useState<Obs[] | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [catalog,setCatalog]=useState<ProduitHit[]>([]);
  const [productQuery,setProductQuery]=useState("");
  const [chosen,setChosen]=useState<Record<number,number>>({});
  const [busy,setBusy]=useState<number|null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [importOk, setImportOk] = useState<ImportOk | null>(null);
  const [importErrs, setImportErrs] = useState<ImportErr[]>([]);

  async function load() {
    setErr(null);
    try {
      setObs((await api<{ observations: Obs[] }>("/admin/en-attente", { token })).observations);
      setCands((await api<{ candidats: Cand[] }>("/admin/appariements", { token })).candidats);
      setCatalog((await api<{resultats:ProduitHit[]}>("/produits")).resultats);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function decide(id:number,decision:"publie"|"rejete"){
    setBusy(id);try{await api("/admin/observations/"+id+"/decision",{method:"POST",token,body:JSON.stringify({decision})});await load();}catch(e){setErr((e as Error).message);}finally{setBusy(null);}
  }
  async function decideCand(c:Cand,decision:"accepte"|"rejete"){
    setBusy(c.id);try{await api("/admin/appariements/"+c.id+"/decision",{method:"POST",token,body:JSON.stringify({decision,produitId:chosen[c.id]??c.productIdPropose??undefined})});await load();}catch(e){setErr((e as Error).message);}finally{setBusy(null);}
  }

  async function runImport(essaiABlanc: boolean) {
    setImportOk(null);
    setImportErrs([]);
    try {
      setImportOk(await api<ImportOk>("/admin/releves/import", { method: "POST", token, body: JSON.stringify({ csv, essaiABlanc }) }));
      if (!essaiABlanc) setCsv("");
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) setImportErrs(e.details as ImportErr[]);
      else setErr((e as Error).message);
    }
  }

  return (
    <>
      <h1>{t(locale, "admin.title")}</h1>
      <div className="card row">
        <label>
          {t(locale, "admin.token")}
          <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        <button onClick={load} disabled={!token}>
          {t(locale, "admin.load")}
        </button>
      </div>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      {obs&&<AdminMonitor locale={locale} token={token}/>}
      {obs && (
        <section className="card">
          <h2>{t(locale, "admin.pending")}</h2>
          {obs.length === 0 && <p>{t(locale, "admin.none")}</p>}
          {obs.map((o) => (
            <div key={o.id} className="row" style={{ justifyContent: "space-between", margin: "8px 0" }}>
              <div>
                <strong>{o.produit}</strong> · {o.enseigne} · {o.ville} — <span className="price">{fmt(o.prixMad)}</span> · {o.dateReleve}
                {o.suspect && (
                  <div className="warn">
                    {t(locale, "admin.suspect")} ({o.medianePubliee})
                  </div>
                )}
              </div>
              <div className="row">
                <button disabled={busy!==null} onClick={() => decide(o.id, "publie")}>{t(locale, "admin.publish")}</button>
                <button disabled={busy!==null} className="danger" onClick={() => decide(o.id, "rejete")}>
                  {t(locale, "admin.reject")}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="card">
        <h2>{t(locale, "admin.import.title")}</h2>
        <p className="muted">{t(locale, "admin.import.help")}</p>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {t(locale, "admin.import.choose")}
          <input type="file" accept=".csv,text/csv" onChange={async (e) => setCsv((await e.target.files?.[0]?.text()) ?? "")} />
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="ghost" disabled={!token || !csv} onClick={() => runImport(true)}>
            {t(locale, "admin.import.check")}
          </button>
          <button disabled={!token || !csv} onClick={() => runImport(false)}>
            {t(locale, "admin.import.run")}
          </button>
        </div>
        {importOk && (
          <p role="status" className="best">
            {importOk.essaiABlanc ? t(locale, "admin.import.ok", { n: importOk.observations, m: importOk.lignes }) : t(locale, "admin.import.done", { n: importOk.observations })}
          </p>
        )}
        {importErrs.length > 0 && (
          <div role="alert">
            <p className="error">{t(locale, "admin.import.errors", { n: importErrs.length })}</p>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t(locale, "admin.import.line")}</th>
                    <th>{t(locale, "admin.import.column")}</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {importErrs.map((e, i) => (
                    <tr key={i}>
                      <td>{e.ligne}</td>
                      <td>{e.colonne ?? ""}</td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      {obs && cands.length > 0 && (
        <section className="card">
          <h2>{t(locale, "admin.candidates")}</h2><div className="row"><input aria-label={t(locale,"v1.chooseProduct")} value={productQuery} onChange={e=>setProductQuery(e.target.value)}/><button onClick={async()=>{try{setCatalog((await api<{resultats:ProduitHit[]}>("/produits?"+new URLSearchParams({q:productQuery}))).resultats);}catch(e){setErr((e as Error).message);}}}>{t(locale,"v1.chooseProduct")}</button></div>
          {cands.map((c) => (
            <div key={c.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>
                {c.libelleSource} <span className="badge">{Math.round(c.score * 100)}%</span>
                {c.payload?<><p>{c.payload.row.prixMad} DH · {c.payload.row.ville} · {c.payload.row.dateReleve}</p><PriceEvidence locale={locale} price={c.payload.trace}/></>:<p className="warn">{t(locale,"v1.noPayload")}</p>}
                <label>{t(locale,"v1.pendingProduct")}<select value={chosen[c.id]??c.productIdPropose??""} onChange={e=>setChosen({...chosen,[c.id]:Number(e.target.value)})}><option value="">—</option>{c.produitPropose&&!catalog.some(p=>p.id===c.produitPropose!.id)&&<option value={c.produitPropose.id}>{c.produitPropose.nom} · {c.produitPropose.formatValeur} {c.produitPropose.formatUnite}</option>}{catalog.map(p=><option key={p.id} value={p.id}>{p.nom} · {p.format}</option>)}</select></label>
              </span>
              <span className="row">
                <button disabled={busy!==null||!c.payload||!(chosen[c.id]??c.productIdPropose)} onClick={() => decideCand(c, "accepte")}>{t(locale, "admin.publish")}</button>
                <button className="danger" disabled={busy!==null} onClick={() => decideCand(c, "rejete")}>
                  {t(locale, "admin.reject")}
                </button>
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
