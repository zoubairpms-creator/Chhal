import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {createTestDb,chains,stores,products,priceObservations,observationReviews,type DbHandle} from "@chhal/db";
import {buildApp} from "../src/app.js";
let h:DbHandle,app:ReturnType<typeof buildApp>,productId:number;
beforeAll(async()=>{
 h=await createTestDb();const[c]=await h.db.insert(chains).values({slug:"bim",nom:"BIM"}).returning();const[s]=await h.db.insert(stores).values({chainId:c.id,ville:"Casablanca"}).returning();
 const[p]=await h.db.insert(products).values({slug:"lait",nomAffiche:"Lait Audit",nomNormalise:"lait audit",formatValeur:"1",formatUnite:"l",ean:"3017620422003"}).returning();productId=p.id;
 const[o]=await h.db.insert(priceObservations).values({productId:p.id,storeId:s.id,prixMad:"10",dateReleve:"2026-10-25",source:"manuel",confiance:"haute"}).returning();await h.db.insert(observationReviews).values({observationId:o.id,decision:"publie",reviewer:"test"});
 await h.db.insert(products).values({slug:"sans-prix",nomAffiche:"Lait sans prix",nomNormalise:"lait sans prix",formatValeur:"1",formatUnite:"l"});
 app=buildApp(h.db,{today:()=>"2026-10-25",adminToken:"test-v1"});
});afterAll(async()=>{await app.close();await h.close();});
describe("V1 accueil recherche partage administration",()=>{
 it("affiche la vraie couverture et ne pretend pas comparer une seule enseigne",async()=>{
 const r=(await app.inject("/accueil?ville=Casablanca")).json();expect(r).toMatchObject({nbPrix:1,nbProduits:1,enseignes:["BIM"],comparaisonPossible:false});expect(r.offres[0].produitId).toBe(productId);
 });
 it("la ville sans prix reste vide sans resultat artificiel",async()=>{expect((await app.inject("/accueil?ville=Rabat")).json().offres).toEqual([]);});
 it("recherche un code-barres exact et applique les filtres",async()=>{
 expect((await app.inject("/produits?q=3017620422003")).json().resultats[0].id).toBe(productId);
 expect((await app.inject("/produits?q=lait&ville=Casablanca&inclureSansPrix=1")).json().resultats).toHaveLength(2);
 expect((await app.inject("/produits?q=lait&ville=Casablanca&avecPrix=1")).json().resultats).toHaveLength(1);
 expect((await app.inject("/produits?q=lait&promotions=1")).json().resultats).toHaveLength(0);
 });
 it("un partage est un instantane ; recalculer ne modifie jamais l'instantane",async()=>{
 const saved=(await app.inject({method:"POST",url:"/paniers",payload:{ville:"Casablanca",articles:[{produitId:productId,quantite:2}]}})).json();
 const before=(await app.inject("/paniers/"+saved.token)).json();expect(before.instantane).toBe(true);
 const recalculated=await app.inject({method:"POST",url:"/paniers/"+saved.token+"/recalculer"});expect(recalculated.json().totalMad).toBe(20);
 expect((await app.inject("/paniers/"+saved.token)).json()).toEqual(before);
 });
 it("le suivi exige le jeton et fournit une couverture reelle",async()=>{
 expect((await app.inject("/admin/suivi")).statusCode).toBe(401);
 const r=(await app.inject({url:"/admin/suivi",headers:{authorization:"Bearer test-v1"}})).json();expect(r.nbPrixActuels).toBe(1);expect(r.couverture).toMatchObject([{ville:"Casablanca",enseigne:"BIM",nbPrix:1}]);
 expect(JSON.stringify(r)).not.toContain("test-v1");
 });
});
