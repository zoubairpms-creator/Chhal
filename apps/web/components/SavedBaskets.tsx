"use client";
import {useEffect,useState} from "react";
import {t,type Locale} from "@chhal/i18n";
import {useBasket} from "@/lib/basket";
import {readFavorites,saveFavorite,type SavedBasket} from "@/lib/shopping";
const KEY="chhal_favorites_v1";
export function SavedBaskets({locale}:{locale:Locale}){
 const basket=useBasket();const [list,setList]=useState<SavedBasket[]>([]);const [name,setName]=useState("");const [message,setMessage]=useState("");
 useEffect(()=>{try{setList(readFavorites(localStorage.getItem(KEY)));}catch{}},[]);
 function persist(next:SavedBasket[]){try{localStorage.setItem(KEY,JSON.stringify(next));setList(next);setMessage("");return true;}catch{setMessage(t(locale,"v1.storageError"));return false;}}
 return <section className="card"><h2>{t(locale,"v1.favorites")}</h2>
 <div className="row"><label>{t(locale,"v1.basketName")}<input maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={!name.trim()||!basket.items.length} onClick={()=>{try{if(persist(saveFavorite(list,name,basket.items,crypto.randomUUID(),new Date().toISOString())))setName("");}catch{setMessage(t(locale,"common.error"));}}}>{t(locale,"v1.saveFavorite")}</button></div>
 <p className="muted">{t(locale,"v1.localOnly")}</p>
 {message&&<p role="status" className={message===t(locale,"v1.loaded")?"muted":"error"}>{message}</p>}
 {list.map(f=><div className="row" key={f.id}><strong>{f.name}</strong><span>{f.items.length}</span><button className="ghost" onClick={()=>{basket.replaceAll(f.items);setMessage(t(locale,"v1.loaded"));}}>{t(locale,"v1.loadBasket")}</button><button className="ghost" onClick={()=>persist(list.filter(v=>v.id!==f.id))}>{t(locale,"basket.remove")}</button></div>)}
 </section>;
}
