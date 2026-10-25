import { describe, expect, it } from "vitest";
import { readFavorites,saveFavorite,validItem,budgetBalance,usableSnapshot } from "../lib/shopping";
const items=[{produitId:1,nom:"Lait",quantite:2}];
describe("V1 paniers pratiques",()=>{
 it("preserve les paniers et remplace seulement un favori de meme nom",()=>{
 const a=saveFavorite([],"Semaine",items,"one","2026-10-25T10:00:00Z");items[0].quantite=3;expect(a[0].items[0]).toMatchObject({quantite:2});
 const b=saveFavorite(a,"weekend",items,"two","2026-10-25T10:00:00Z");
 const c=saveFavorite(b," SEMAINE ",items,"three","2026-10-25T10:00:00Z");expect(c).toHaveLength(2);expect(c[0].id).toBe("one");
 });
 it("rejette stockage corrompu et quantites invalides",()=>{
 expect(readFavorites("oops")).toEqual([]);expect(validItem({produitId:1,nom:"x",quantite:-2})).toBe(false);expect(validItem({famille:"oeufs",nom:"x",quantiteBase:1.5,unite:"piece"})).toBe(false);
 });
 it("calcule le budget au centime",()=>{expect(budgetBalance(100,79.95)).toBe(20.05);expect(budgetBalance(50,79.95)).toBe(-29.95);});
 it("ne reutilise aucun ancien calcul comme un prix actuel apres six heures ou changement de jour",()=>{
 expect(usableSnapshot("2026-10-25T09:00:00Z","2026-10-25",new Date("2026-10-25T10:00:00Z"))).toBe(true);
 expect(usableSnapshot("2026-10-24T09:00:00Z","2026-10-24",new Date("2026-10-25T10:00:00Z"))).toBe(false);
 expect(usableSnapshot("2026-10-25T01:00:00Z","2026-10-25",new Date("2026-10-25T10:00:00Z"))).toBe(false);
 });
});
