"use client";
import {useEffect,useState} from "react";
import {t,type Locale} from "@chhal/i18n";
import {api} from "@/lib/api";
type Job={id:number;statut:string;fin:string|null;erreur:string|null;observationsCreees:number;pagesLues:number};
type Data={nbPrixActuels:number;observationsExpirees:number;appariementsEnAttente:number;sources:{slug:string;nom:string;activee:boolean;dernierJob:Job|null}[];jobs:Job[];couverture:{ville:string;enseigne:string;nbPrix:number}[]};
export function AdminMonitor({locale,token}:{locale:Locale;token:string}){
 const [data,setData]=useState<Data|null>(null);const [error,setError]=useState("");
 const load=()=>api<Data>("/admin/suivi",{token}).then(setData).catch(e=>setError(e.message));
 useEffect(()=>{load();},[token]);
 return <section className="card"><h2>{t(locale,"v1.monitor")}</h2><button className="ghost" onClick={load}>{t(locale,"admin.load")}</button>
 {error&&<p className="error" role="alert">{error}</p>}
 {data&&<><p>{data.nbPrixActuels} {t(locale,"v1.withPrices")} · {data.appariementsEnAttente} {t(locale,"admin.candidates")}</p>
 <div className="scroll"><table><thead><tr><th>{t(locale,"product.source")}</th><th>{t(locale,"v1.sourceState")}</th><th>{t(locale,"v1.lastCollection")}</th></tr></thead><tbody>{data.sources.map(s=><tr key={s.slug}><td>{s.nom}</td><td>{t(locale,s.activee?"v1.enabled":"v1.disabled")}</td><td>{s.dernierJob? s.dernierJob.statut+" · "+(s.dernierJob.fin??""):"—"}</td></tr>)}</tbody></table></div>
 <h3>{t(locale,"v1.coverage")}</h3>{data.couverture.map(c=><p key={c.ville+c.enseigne}>{c.ville} · {c.enseigne} · {c.nbPrix}</p>)}
 <details><summary>{t(locale,"v1.lastCollection")}</summary>{data.jobs.map(j=><p key={j.id}>{j.fin} · {j.statut} · {j.observationsCreees} {t(locale,"v1.products")}{j.erreur&&<span className="error"> · {j.erreur}</span>}</p>)}</details></>}
 </section>;
}
