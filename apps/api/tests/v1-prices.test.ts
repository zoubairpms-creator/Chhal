import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, chains, stores, products, priceObservations, observationReviews, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";
let h:DbHandle, app:ReturnType<typeof buildApp>, ids:number[];
beforeAll(async()=>{
 h=await createTestDb(); const [c]=await h.db.insert(chains).values({slug:"bim",nom:"BIM"}).returning();
 const [s]=await h.db.insert(stores).values({chainId:c.id,ville:"Casablanca"}).returning();
 const ps=await h.db.insert(products).values(["vieux","futur","actuel","inconnu"].map(slug=>({slug,nomAffiche:"Audit "+slug,nomNormalise:"audit "+slug,formatValeur:"1",formatUnite:"l" as const}))).returning();ids=ps.map(p=>p.id);
 const rows=[
 {productId:ids[0],dateReleve:"2026-08-01",source:"manuel" as const},
 {productId:ids[1],dateReleve:"2026-10-30",source:"catalogue" as const,validFrom:"2026-10-30",validUntil:"2026-11-06",validityStatus:"estimee"},
 {productId:ids[2],dateReleve:"2026-10-20",source:"catalogue" as const,validFrom:"2026-10-20",validUntil:"2026-10-27",validityStatus:"estimee",sourceUrl:"https://hmizate.ma/deal/audit",observedAt:new Date("2026-10-20T12:00:00Z")},
 {productId:ids[2],dateReleve:"2026-10-30",source:"catalogue" as const,validFrom:"2026-10-30",validUntil:"2026-11-06",validityStatus:"estimee"},
 {productId:ids[3],dateReleve:"2026-10-20",source:"catalogue" as const,validFrom:"2026-10-20",validityStatus:"inconnue"},
 ];
 for(const r of rows){const [o]=await h.db.insert(priceObservations).values({...r,storeId:s.id,prixMad:"15.00",confiance:"moyenne"}).returning();await h.db.insert(observationReviews).values({observationId:o.id,decision:"publie",reviewer:"test"});}
 app=buildApp(h.db,{today:()=>"2026-10-25"});
});
afterAll(async()=>{await app.close();await h.close();});
describe("V1 prix actuellement utilisables",()=>{
 it("exclut vieux et futurs de la recherche et des fiches",async()=>{
 const r=(await app.inject("/produits?q=audit&ville=Casablanca")).json();
 for(const id of [ids[0],ids[1],ids[3]]){expect((r.resultats.find((p:any)=>p.id===id)?.top3??[])).toHaveLength(0);expect((await app.inject("/produits/"+id+"/prix?ville=Casablanca")).json().resultats).toHaveLength(0);}
 });
 it("une offre future ne masque pas l'offre actuelle du meme produit",async()=>{
 const p=(await app.inject("/produits/"+ids[2]+"/prix?ville=Casablanca")).json().resultats;
 expect(p).toHaveLength(1);expect(p[0]).toMatchObject({dateReleve:"2026-10-20",validUntil:"2026-10-27",validityStatus:"estimee",sourceUrl:"https://hmizate.ma/deal/audit"});
 });
 it("le panier refuse une promotion future",async()=>{
 const r=(await app.inject({method:"POST",url:"/paniers/optimiser",payload:{ville:"Casablanca",articles:[{produitId:ids[1],quantite:1}]}})).json();expect(r.plan).toEqual([]);expect(r.totalMad).toBe(0);
 });
 it("la limite d'age du panier reste configurable",async()=>{
 const r=(await app.inject({method:"POST",url:"/paniers/optimiser",payload:{ville:"Casablanca",ageMaxJours:100,articles:[{produitId:ids[0],quantite:1}]}})).json();expect(r.totalMad).toBe(15);
 });
});
