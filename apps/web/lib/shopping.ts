import type { BasketItem } from "./basket";
export type SavedBasket={id:string;name:string;items:BasketItem[];savedAt:string};
export function validItem(x:unknown):x is BasketItem {
 if(!x||typeof x!=="object")return false;const o=x as Record<string,unknown>;
 if(typeof o.nom!=="string"||o.nom.length>300)return false;
 if("famille" in o)return typeof o.famille==="string"&&/^[a-z0-9-]+$/.test(o.famille)&&["kg","l","piece"].includes(String(o.unite))&&typeof o.quantiteBase==="number"&&Number.isFinite(o.quantiteBase)&&o.quantiteBase>=0.1&&o.quantiteBase<=99&&(o.unite!=="piece"||Number.isInteger(o.quantiteBase));
 return typeof o.produitId==="number"&&Number.isInteger(o.produitId)&&o.produitId>0&&typeof o.quantite==="number"&&Number.isInteger(o.quantite)&&o.quantite>=1&&o.quantite<=99;
}
export function readFavorites(raw:string|null):SavedBasket[] {
 try {const data=JSON.parse(raw??"[]");if(!Array.isArray(data))return [];
 return data.filter((v:any)=>v&&typeof v.id==="string"&&typeof v.name==="string"&&v.name.trim().length>0&&v.name.length<=60&&Array.isArray(v.items)&&v.items.length<=50&&v.items.every(validItem)&&typeof v.savedAt==="string").slice(0,20);
 }catch{return [];}
}
export function saveFavorite(list:SavedBasket[],name:string,items:BasketItem[],id:string,now:string):SavedBasket[] {
 const title=name.trim().slice(0,60);if(!title||!items.length||items.length>50||!items.every(validItem))throw new Error("Panier invalide.");
 const existing=list.find(v=>v.name.toLocaleLowerCase()===title.toLocaleLowerCase());
 return [{id:existing?.id??id,name:title,items:structuredClone(items),savedAt:now},...list.filter(v=>v.id!==existing?.id)].slice(0,20);
}
export function budgetBalance(budget:number,total:number){return Math.round((Math.round(budget*100)-Math.round(total*100)))/100;}
export function moroccoDay(date:Date){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Casablanca",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);return ["year","month","day"].map(k=>p.find(x=>x.type===k)!.value).join("-");}
export function usableSnapshot(savedAt:string,referenceDate:string,now=new Date()){
 const saved=Date.parse(savedAt);return Number.isFinite(saved)&&+now>=saved&&+now-saved<=6*3600000&&moroccoDay(now)===referenceDate;
}
