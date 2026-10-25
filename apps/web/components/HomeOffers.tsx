"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {t,type Locale} from "@chhal/i18n";
import {api,type PriceTrace} from "@/lib/api";
import {fmt} from "./ui";
import {PriceEvidence} from "./PriceEvidence";
type Home={dateReference:string;nbPrix:number;nbProduits:number;enseignes:string[];comparaisonPossible:boolean;offres:(PriceTrace&{produitId:number;produit:string;prixMad:number;enseigne:string;dateReleve:string;source:string})[];aVenir:{id:number;produit:string;enseigne:string;validFrom:string}[]};
export function HomeOffers({locale,ville}:{locale:Locale;ville:string}){
 const [data,setData]=useState<Home|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{if(!ville)return;let active=true;setData(null);api<Home>("/accueil?"+new URLSearchParams({ville})).then(r=>{if(active){setData(r);setError(false);}}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[ville]);
 if(error)return <p className="warn">{t(locale,"common.error")}</p>;
 if(!data)return <div className="skeleton" aria-busy="true"/>;
 return <section><h2>{t(locale,"v1.currentOffers")}</h2><p className="muted">{ville} · {data.nbProduits} {t(locale,"v1.products")} · {data.enseignes.join(", ")}</p>
 {!data.comparaisonPossible&&<p className="warn">{t(locale,data.enseignes.length===1?"v1.singleRetailer":"v1.noFreshPrices")}</p>}
 <div className="offers-grid">{data.offres.map((o,i)=><article className="card" key={o.produitId+":"+i}><Link href={"/"+locale+"/produit/"+o.produitId+"?"+new URLSearchParams({ville})}>{o.produit}</Link><p>{o.enseigne} · <strong className="price">{fmt(o.prixMad)} {t(locale,"common.mad")}</strong></p><small>{o.dateReleve}</small><PriceEvidence locale={locale} price={o}/></article>)}</div>
 {data.aVenir.length>0&&<details className="card"><summary>{t(locale,"v1.upcoming")}</summary>{data.aVenir.map(o=><p key={o.id}>{o.produit} · {o.enseigne} · {o.validFrom}</p>)}</details>}
 </section>;
}
