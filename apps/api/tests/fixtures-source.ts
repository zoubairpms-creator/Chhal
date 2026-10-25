import {createHash} from "node:crypto";
import {eq} from "drizzle-orm";
import {sources,rawData,type Db} from "@chhal/db";
export async function makeTrace(db:Db,day="2026-10-18"){
 const url="https://fixtures.chhal.test/"+day;
 await db.insert(sources).values({slug:"fixture-source",nom:"Fixture de test",url:"https://fixtures.chhal.test",type:"catalogue",activee:true,decisionJuridique:"acceptee_par_le_porteur"}).onConflictDoNothing();
 const [s]=await db.select().from(sources).where(eq(sources.slug,"fixture-source"));
 const [raw]=await db.insert(rawData).values({sourceId:s.id,url,hashSha256:createHash("sha256").update(day).digest("hex"),fetchedAt:new Date(day+"T12:00:00Z"),contenuGzipB64:"fixture"}).onConflictDoNothing().returning();
 const existing=raw??(await db.select().from(rawData).where(eq(rawData.url,url)))[0];
 return {sourceSlug:s.slug,sourceUrl:url,observedAt:day+"T12:00:00Z",validFrom:day,validUntil:new Date(Date.parse(day)+7*86400000).toISOString().slice(0,10),validityStatus:"estimee",rawDataId:existing.id};
}
