import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, chains, stores, products, sources, rawData, priceObservations, matchCandidates, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";
let h:DbHandle, app:ReturnType<typeof buildApp>, productId:number, rawId:number;
const headers={authorization:"Bearer audit-v1"};
const row={libelle:"Lait Test",marque:"Test",valeur:1,unite:"l",enseigne:"bim",ville:"Casablanca",prixMad:12,dateReleve:"2026-10-20",source:"catalogue"};
const trace=()=>({sourceSlug:"hmizate",sourceUrl:"https://hmizate.ma/deal/test",observedAt:"2026-10-20T12:00:00Z",validFrom:"2026-10-20",validUntil:"2026-10-27",validityStatus:"estimee",rawDataId:rawId});
const post=(url:string,payload:object)=>app.inject({method:"POST",url,payload,headers});
beforeAll(async()=>{
 h=await createTestDb();const [c]=await h.db.insert(chains).values({slug:"bim",nom:"BIM"}).returning();await h.db.insert(stores).values({chainId:c.id,ville:"Casablanca"});
 const [p]=await h.db.insert(products).values({slug:"lait-test",nomNormalise:"lait test",nomAffiche:"Lait Test",marque:"Test",formatValeur:"1",formatUnite:"l"}).returning();productId=p.id;
 const [s]=await h.db.insert(sources).values({slug:"hmizate",nom:"hmizate.ma",url:"https://hmizate.ma",type:"catalogue",activee:true,decisionJuridique:"acceptee_par_le_porteur"}).returning();
 const [raw]=await h.db.insert(rawData).values({sourceId:s.id,url:"https://hmizate.ma/deal/test",hashSha256:"a".repeat(64),contenuGzipB64:"test",fetchedAt:new Date("2026-10-20T12:00:00Z")}).returning();rawId=raw.id;
 app=buildApp(h.db,{adminToken:"audit-v1",today:()=>"2026-10-25"});
});
afterAll(async()=>{await app.close();await h.close();});
describe("V1 ingestion tracee et resolution",()=>{
 it("refuse les catalogues sans trace et les donnees brutes incoherentes",async()=>{
 expect((await post("/admin/scraping/releves",{releves:[row]})).statusCode).toBe(400);
 expect((await post("/admin/scraping/releves",{releves:[row],tracabilite:{...trace(),rawDataId:99999}})).statusCode).toBe(422);
 expect(await h.db.select().from(priceObservations)).toHaveLength(0);
 });
 it("essai a blanc sans ecriture puis import certain idempotent",async()=>{
 expect((await post("/admin/scraping/releves",{releves:[row],tracabilite:trace(),essaiABlanc:true})).json().publies).toBe(1);
 expect(await h.db.select().from(priceObservations)).toHaveLength(0);
 expect((await post("/admin/scraping/releves",{releves:[row],tracabilite:trace()})).json().publies).toBe(1);
 expect((await post("/admin/scraping/releves",{releves:[row],tracabilite:trace()})).json().doublons).toBe(1);
 });
 it("conserve le releve incertain et publie une seule fois apres choix du produit",async()=>{
 const r=await post("/admin/scraping/releves",{releves:[{...row,libelle:"Lait Test incertain",prixMad:13}],tracabilite:trace()});expect(r.json().enAttente).toBe(1);
 const [c]=await h.db.select().from(matchCandidates).where(eq(matchCandidates.statut,"en_attente"));expect(c.payload).toBeTruthy();
 const before=(await h.db.select().from(priceObservations)).length;
 expect((await post("/admin/appariements/"+c.id+"/decision",{decision:"accepte",produitId:productId})).statusCode).toBe(200);
 expect(await h.db.select().from(priceObservations)).toHaveLength(before+1);
 expect((await post("/admin/appariements/"+c.id+"/decision",{decision:"accepte",produitId:productId})).statusCode).toBe(409);
 expect(await h.db.select().from(priceObservations)).toHaveLength(before+1);
 });
 it("deux imports simultanes n'ajoutent qu'un prix",async()=>{
 const responses=await Promise.all([post("/admin/scraping/releves",{releves:[{...row,prixMad:14}],tracabilite:trace()}),post("/admin/scraping/releves",{releves:[{...row,prixMad:14}],tracabilite:trace()})]);
 expect(responses.every(r=>r.statusCode===200)).toBe(true);expect(responses.reduce((n,r)=>n+r.json().publies,0)).toBe(1);
 });
 it("un appariement deja publie se rattache au prix existant sans doublon",async()=>{
 await post("/admin/scraping/releves",{releves:[{...row,prixMad:17}],tracabilite:trace()});
 await post("/admin/scraping/releves",{releves:[{...row,libelle:"Lait label alternatif",prixMad:17}],tracabilite:trace()});
 const[c]=await h.db.select().from(matchCandidates).where(eq(matchCandidates.statut,"en_attente"));
 const before=(await h.db.select().from(priceObservations)).length;
 const r=await post("/admin/appariements/"+c.id+"/decision",{decision:"accepte",produitId:productId});
 expect(r.json()).toMatchObject({ok:true,doublon:true});expect(r.json().observationId).toBeGreaterThan(0);
 expect(await h.db.select().from(priceObservations)).toHaveLength(before);
 });
 it("un produit de format incompatible est refuse sans perdre le candidat",async()=>{
 const[p]=await h.db.insert(products).values({slug:"lait-2l",nomAffiche:"Lait 2L",nomNormalise:"lait 2l",formatValeur:"2",formatUnite:"l"}).returning();
 await post("/admin/scraping/releves",{releves:[{...row,libelle:"Lait format a verifier",prixMad:16}],tracabilite:trace()});
 const[c]=await h.db.select().from(matchCandidates).where(eq(matchCandidates.statut,"en_attente"));
 expect((await post("/admin/appariements/"+c.id+"/decision",{decision:"accepte",produitId:p.id})).statusCode).toBe(400);
 expect((await h.db.select().from(matchCandidates).where(eq(matchCandidates.id,c.id)))[0].statut).toBe("en_attente");
 expect((await post("/admin/appariements/"+c.id+"/decision",{decision:"rejete"})).statusCode).toBe(200);
 });
 it("refuse le rejeu apres desactivation et refuse Carrefour",async()=>{
 await h.db.update(sources).set({activee:false});
 expect((await post("/admin/scraping/releves",{releves:[row],tracabilite:trace()})).statusCode).toBe(409);
 await h.db.update(sources).set({activee:true});
 expect((await post("/admin/scraping/releves",{releves:[{...row,enseigne:"carrefour"}],tracabilite:trace()})).statusCode).toBe(400);
 });
 it("rejette une ligne invalide avant toute ecriture du lot",async()=>{
 const before=(await h.db.select().from(priceObservations)).length;
 expect((await post("/admin/scraping/releves",{releves:[{...row,prixMad:14},{...row,dateReleve:"2026-02-31"}],tracabilite:trace()})).statusCode).toBe(400);
 expect(await h.db.select().from(priceObservations)).toHaveLength(before);
 });
});
