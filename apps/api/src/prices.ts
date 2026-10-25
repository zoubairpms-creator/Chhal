import { type SQL, and, desc, eq, gte, lte, or, isNull, sql } from "drizzle-orm";
import { priceObservations, type Db } from "@chhal/db";
export const cutoff = (today:string, age=30) => new Date(Date.parse(today+"T00:00:00Z")-age*86400000).toISOString().slice(0,10);
export function moroccoToday() {
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Casablanca",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 return ["year","month","day"].map(k=>p.find(x=>x.type===k)!.value).join("-");
}
/** Select eligible rows BEFORE taking the latest price; future promotions cannot hide today's offer. */
export function currentPrices(db:Db,today:string|SQL,includeTest:boolean) {
 const o=priceObservations;
 return db.selectDistinctOn([o.productId,o.storeId],{
 observationId:o.id,productId:o.productId,storeId:o.storeId,prixMad:o.prixMad,dateReleve:o.dateReleve,source:o.source,confiance:o.confiance,testOnly:o.testOnly,
 validFrom:o.validFrom,validUntil:o.validUntil,validityStatus:o.validityStatus,sourceUrl:o.sourceUrl,observedAt:o.observedAt,confianceMotif:o.confianceMotif,rawDataId:o.rawDataId,
 }).from(o).where(and(
 includeTest?undefined:eq(o.testOnly,false),
 lte(o.dateReleve,today),or(isNull(o.validFrom),lte(o.validFrom,today)),
 or(isNull(o.validUntil),gte(o.validUntil,today)),
 or(sql`${o.source} <> 'catalogue'`,and(sql`${o.validUntil} IS NOT NULL`,sql`${o.validityStatus} IN ('connue','estimee')`)),
 sql`(SELECT r.decision FROM observation_reviews r WHERE r.observation_id = ${o.id} ORDER BY r.id DESC LIMIT 1) = 'publie'`
 )).orderBy(o.productId,o.storeId,desc(o.dateReleve),desc(o.id)).as("current_prices");
}
export function priceMeta(r:{validFrom?:string|null;validUntil?:string|null;validityStatus?:string|null;sourceUrl?:string|null;observedAt?:Date|null;confianceMotif?:string|null}) {
 return {validFrom:r.validFrom??null,validUntil:r.validUntil??null,validityStatus:r.validityStatus??null,sourceUrl:r.sourceUrl??null,observedAt:r.observedAt?.toISOString()??null,confianceMotif:r.confianceMotif??null};
}
