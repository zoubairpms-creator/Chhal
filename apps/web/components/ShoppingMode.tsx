"use client";
import {useEffect,useState} from "react";
import {t,type Locale} from "@chhal/i18n";
import type {BasketResult} from "@/lib/api";
import {fmt} from "./ui";
export function ShoppingMode({locale,result}:{locale:Locale;result:BasketResult}){
 const signature=JSON.stringify([result.dateReference,result.plan]);
 const [checked,setChecked]=useState<string[]>([]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("chhal_shopping_v1")??"null");setChecked(saved?.signature===signature&&Array.isArray(saved.checked)?saved.checked.filter((x:unknown)=>typeof x==="string"):[]);}catch{setChecked([]);}},[signature]);
 const keys=result.plan.flatMap(p=>p.articles.map((a,i)=>JSON.stringify([p.enseigne,a.produitId,a.quantite,i])));
 function toggle(key:string){const next=checked.includes(key)?checked.filter(k=>k!==key):[...checked,key];setChecked(next);try{localStorage.setItem("chhal_shopping_v1",JSON.stringify({signature,checked:next}));}catch{}}
 return <details className="card"><summary>{t(locale,"v1.shoppingMode")} · {checked.filter(k=>keys.includes(k)).length}/{keys.length}</summary>
 {result.plan.map(p=><section key={p.enseigne}><h3>{p.enseigne}</h3>{p.articles.map((a,i)=>{const key=JSON.stringify([p.enseigne,a.produitId,a.quantite,i]);return <label className="shopping-check" key={key}><input type="checkbox" checked={checked.includes(key)} onChange={()=>toggle(key)}/><span style={{textDecoration:checked.includes(key)?"line-through":undefined}}>{a.nom} × {a.quantite}</span><strong>{fmt(a.totalMad)} {t(locale,"common.mad")}</strong></label>;})}</section>)}
 {result.exclus.length>0&&<p className="warn">{t(locale,"v1.partialBudget")}</p>}
 </details>;
}
