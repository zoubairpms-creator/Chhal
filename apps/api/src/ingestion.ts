import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { chains, stores, products, sources, rawData, priceObservations, observationReviews, matchCandidates, importJobs, type Db } from "@chhal/db";
import { matchProduct, toBase, isValidGtin, type Unite } from "@chhal/matching";
import { z } from "zod";
function fail(statusCode:number,message:string):never { throw Object.assign(new Error(message),{statusCode}); }
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T00:00:00Z");return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===s;},"Date invalide.");
const rowSchema=z.object({
 libelle:z.string().trim().min(1).max(300),ean:z.string().refine(isValidGtin,"Code-barres invalide.").optional(),marque:z.string().max(100).optional(),
 valeur:z.number().positive().max(100000),unite:z.enum(["g","kg","ml","cl","l","piece"]),enseigne:z.string().min(1),ville:z.string().min(1),
 prixMad:z.number().positive().max(100000).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6,"2 décimales maximum."),
 dateReleve:day,source:z.enum(["scraping","catalogue"]).default("scraping"),
});
const traceSchema=z.object({
 sourceSlug:z.string().min(1),sourceUrl:z.string().url().refine(s=>{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password;},"Source HTTPS requise."),
 observedAt:z.string().datetime(),validFrom:day,validUntil:day.nullable(),validityStatus:z.enum(["connue","estimee","inconnue"]),
 rawDataId:z.number().int().positive().optional(),motif:z.string().max(300).optional(),
}).refine(t=>t.validUntil===null||t.validUntil>=t.validFrom,"Fin avant début.")
 .refine(t=>t.validityStatus==="inconnue"?t.validUntil===null:t.validUntil!==null,"Statut de validité incohérent.");
type Row=z.infer<typeof rowSchema>;
type Trace=z.infer<typeof traceSchema>;
type Pending={row:Row;trace:Trace;storeId:number;key:string};
const keyFor=(r:Row,t:Trace,storeId:number)=>createHash("sha256").update(JSON.stringify([t.sourceSlug,t.sourceUrl,t.validFrom,t.validUntil,t.validityStatus,r.libelle,r.marque??"",r.ean??"",r.valeur,r.unite,storeId,r.prixMad,r.dateReleve])).digest("hex");
async function validateSource(db:Db,t:Trace,dry:boolean) {
 const [src]=await db.select().from(sources).where(eq(sources.slug,t.sourceSlug));
 if(!src)fail(404,"Source inconnue.");
 if(!dry&&(!src.activee||src.decisionJuridique==="non_evaluee"))fail(409,"Source non activée ou décision non consignée.");
 if(new URL(t.sourceUrl).origin!==new URL(src.url).origin)fail(422,"URL différente de la source.");
 if(!dry&&!t.rawDataId)fail(422,"Donnée brute obligatoire pour publier.");
 if(t.rawDataId){const [raw]=await db.select().from(rawData).where(eq(rawData.id,t.rawDataId));if(!raw||raw.sourceId!==src.id||raw.url!==t.sourceUrl)fail(422,"Donnée brute incohérente avec la source et l'URL.");}
 return src;
}
async function publish(db:Db,p:Pending,productId:number,reviewer:string) {
 const ingestionKey=createHash("sha256").update(JSON.stringify([p.trace.sourceSlug,p.trace.sourceUrl,productId,p.storeId,p.row.prixMad,p.row.dateReleve,p.trace.validFrom,p.trace.validUntil])).digest("hex");
 const [obs]=await db.insert(priceObservations).values({
 productId,storeId:p.storeId,prixMad:p.row.prixMad.toFixed(2),dateReleve:p.row.dateReleve,source:p.row.source,confiance:"moyenne",
 observedAt:new Date(p.trace.observedAt),validFrom:p.trace.validFrom,validUntil:p.trace.validUntil,validityStatus:p.trace.validityStatus,
 sourceUrl:p.trace.sourceUrl,rawDataId:p.trace.rawDataId,collectionMethod:"scraping",devise:"MAD",confianceMotif:p.trace.motif??"Source tierce ; validation tracée.",ingestionKey,
 }).onConflictDoNothing().returning();
 if(!obs){
  const [existing]=await db.select({id:priceObservations.id}).from(priceObservations).where(eq(priceObservations.ingestionKey,ingestionKey));
  const [review]=await db.select().from(observationReviews).where(eq(observationReviews.observationId,existing.id)).orderBy(desc(observationReviews.id)).limit(1);
  if(review?.decision!=="publie")fail(409,"Ce relevé a déjà été rejeté ; une correction explicite est nécessaire.");
  return {id:existing.id,created:false};
 }
 await db.insert(observationReviews).values({observationId:obs.id,decision:"publie",reviewer});
 return {id:obs.id,created:true};
}
export async function ingest(db:Db,input:unknown,today:string) {
 const b=z.object({releves:z.array(rowSchema).max(2000),tracabilite:traceSchema,essaiABlanc:z.boolean().default(false)}).parse(input);
 if(b.releves.some(r=>r.enseigne==="carrefour"))fail(400,"Carrefour est exclu de cette collecte.");
 if(b.releves.some(r=>r.source==="catalogue"&&r.dateReleve!==b.tracabilite.validFrom))fail(400,"Date du catalogue différente du début de validité.");
 if(b.releves.some(r=>r.source==="scraping"&&r.dateReleve>today))fail(400,"Un relevé hors catalogue ne peut pas être futur.");
 if(Date.parse(b.tracabilite.observedAt)>Date.now()+300000)fail(400,"Date de collecte future.");
 const src=await validateSource(db,b.tracabilite,b.essaiABlanc);
 const catalog=(await db.select().from(products)).map(p=>({id:p.id,ean:p.ean,marque:p.marque,valeur:Number(p.formatValeur),unite:p.formatUnite as Unite,nom:p.nomAffiche}));
 const storeRows=await db.select({id:stores.id,ville:stores.ville,chainId:chains.id,slug:chains.slug}).from(stores).innerJoin(chains,eq(chains.id,stores.chainId));
 const prepared=b.releves.map(r=>{const st=storeRows.find(s=>s.slug===r.enseigne&&s.ville.toLowerCase()===r.ville.toLowerCase());if(!st)fail(422,"Magasin inconnu pour une ligne du lot.");return {row:r,trace:b.tracabilite,storeId:st.id,key:keyFor(r,b.tracabilite,st.id),match:matchProduct({nom:r.libelle,...r},catalog),chainId:st.chainId};});
 const apply=async(tx:Db)=>{
 let publies=0,enAttente=0,doublons=0;const seen=new Set<string>();
 for(const p of prepared){
 if(seen.has(p.key)){doublons++;continue;}seen.add(p.key);
 const existing=await tx.select({id:priceObservations.id}).from(priceObservations).where(eq(priceObservations.ingestionKey,p.key));
 const pending=await tx.select({id:matchCandidates.id}).from(matchCandidates).where(eq(matchCandidates.ingestionKey,p.key));
 if(existing.length||pending.length){doublons++;continue;}
 if(p.match.kind==="certain"){if(b.essaiABlanc){publies++;continue;}if((await publish(tx,p,p.match.productId!,"scraping")).created)publies++;else doublons++;}
 else{if(b.essaiABlanc){enAttente++;continue;}const [c]=await tx.insert(matchCandidates).values({libelleSource:p.row.libelle,chainId:p.chainId,productIdPropose:p.match.productId,score:p.match.score,payload:{row:p.row,trace:p.trace,storeId:p.storeId,key:p.key},ingestionKey:p.key}).onConflictDoNothing().returning();if(c)enAttente++;else doublons++;}
 }
 if(!b.essaiABlanc)await tx.insert(importJobs).values({sourceId:src.id,fin:new Date(),statut:"ok",dryRun:false,pagesLues:1,observationsCreees:publies,rejets:{enAttente,doublons}});
 return {...(b.essaiABlanc?{essaiABlanc:true}:{}),publies,enAttente,ignores:0,doublons};
 };
 return b.essaiABlanc?apply(db):db.transaction(tx=>apply(tx));
}
export async function decideCandidate(db:Db,id:number,b:{decision:"accepte"|"rejete";produitId?:number}) {
 return db.transaction(async tx=>{
 const [c]=await tx.select().from(matchCandidates).where(eq(matchCandidates.id,id)).for("update");
 if(!c)fail(404,"Candidat introuvable.");if(c.statut!=="en_attente")fail(409,"Candidat déjà traité.");
 if(b.decision==="rejete"){await tx.update(matchCandidates).set({statut:"rejete",resoluPar:"admin"}).where(eq(matchCandidates.id,id));return {ok:true};}
 if(!c.payload)fail(422,"Ancien candidat incomplet : réimporter la source avant publication.");
 const p=c.payload as unknown as Pending;const target=b.produitId??c.productIdPropose;if(!target)fail(400,"Choisir le produit correspondant.");
 const [product]=await tx.select().from(products).where(eq(products.id,target));if(!product)fail(404,"Produit introuvable.");
 const a=toBase(p.row.valeur,p.row.unite),v=toBase(Number(product.formatValeur),product.formatUnite as Unite);
 if(a.famille!==v.famille||Math.abs(a.quantite-v.quantite)>1e-6)fail(400,"Format incompatible avec le produit choisi.");
 await validateSource(tx,p.trace,false);
 const publication=await publish(tx,p,target,"admin-appariement");const observationId=publication.id;
 await tx.update(matchCandidates).set({statut:"accepte",resoluPar:"admin",productIdPropose:target,observationId}).where(eq(matchCandidates.id,id));
 return {ok:true,observationId,doublon:!publication.created};
 });
}
