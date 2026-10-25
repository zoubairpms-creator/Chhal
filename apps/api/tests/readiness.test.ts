import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import {createTestDb,type DbHandle} from "@chhal/db";
import {buildApp} from "../src/app.js";
let h:DbHandle;
beforeAll(async()=>{h=await createTestDb();});afterAll(async()=>{await h.close();});
describe("disponibilite du schema sans migration automatique",()=>{
 it("verifie la vue de prix et le schema requis",async()=>{const app=buildApp(h.db);try{expect((await app.inject("/ready")).statusCode).toBe(200);}finally{await app.close();}});
 it("une base indisponible donne 503 sans exposer la connexion",async()=>{
 const spy=vi.spyOn(h.db,"execute").mockRejectedValueOnce(new Error("secret-db-connection"));const app=buildApp(h.db);
 try{const r=await app.inject("/ready");expect(r.statusCode).toBe(503);expect(r.body).not.toContain("secret-db-connection");expect((await app.inject("/health")).statusCode).toBe(200);}finally{spy.mockRestore();await app.close();}
 });
});
