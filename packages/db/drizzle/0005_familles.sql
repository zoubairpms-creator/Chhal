CREATE TABLE "families" (
	"slug" text PRIMARY KEY NOT NULL,
	"nom" jsonb NOT NULL,
	"categorie" text NOT NULL,
	"classe" text NOT NULL,
	"alias" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "families_classe_valide" CHECK ("families"."classe" in ('masse', 'volume', 'piece'))
);
--> statement-breakpoint
-- Familles de produits (source : packages/db/src/familles.ts) et rattrapage des produits existants par leur slug.
--> statement-breakpoint
INSERT INTO "families" ("slug", "nom", "categorie", "classe", "alias") VALUES
  ('riz', '{"fr":"Riz","ar":"رز","en":"Rice"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Riz","langue":"fr"},{"texte":"رز","langue":"ar"},{"texte":"Rice","langue":"en"},{"texte":"rouz","langue":"darija"}]'::jsonb),
  ('sucre', '{"fr":"Sucre","ar":"سكر","en":"Sugar"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Sucre","langue":"fr"},{"texte":"سكر","langue":"ar"},{"texte":"Sugar","langue":"en"},{"texte":"skkar","langue":"darija"}]'::jsonb),
  ('farine', '{"fr":"Farine","ar":"دقيق","en":"Flour"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Farine","langue":"fr"},{"texte":"دقيق","langue":"ar"},{"texte":"Flour","langue":"en"},{"texte":"d9i9","langue":"darija"}]'::jsonb),
  ('semoule', '{"fr":"Semoule","ar":"سميد","en":"Semolina"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Semoule","langue":"fr"},{"texte":"سميد","langue":"ar"},{"texte":"Semolina","langue":"en"},{"texte":"smid","langue":"darija"}]'::jsonb),
  ('couscous', '{"fr":"Couscous","ar":"كسكس","en":"Couscous"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Couscous","langue":"fr"},{"texte":"كسكس","langue":"ar"},{"texte":"Couscous","langue":"en"},{"texte":"kseksou","langue":"darija"}]'::jsonb),
  ('pates', '{"fr":"Pâtes","ar":"معكرونة","en":"Pasta"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Pâtes","langue":"fr"},{"texte":"معكرونة","langue":"ar"},{"texte":"Pasta","langue":"en"},{"texte":"makarona","langue":"darija"},{"texte":"spaghetti","langue":"fr"}]'::jsonb),
  ('vermicelles', '{"fr":"Vermicelles","ar":"شعرية","en":"Vermicelli"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Vermicelles","langue":"fr"},{"texte":"شعرية","langue":"ar"},{"texte":"Vermicelli","langue":"en"},{"texte":"chaaria","langue":"darija"}]'::jsonb),
  ('huile-de-table', '{"fr":"Huile de table","ar":"زيت المائدة","en":"Cooking oil"}'::jsonb, 'epicerie', 'volume', '[{"texte":"Huile de table","langue":"fr"},{"texte":"زيت المائدة","langue":"ar"},{"texte":"Cooking oil","langue":"en"},{"texte":"zit","langue":"darija"},{"texte":"huile","langue":"fr"},{"texte":"زيت","langue":"ar"},{"texte":"oil","langue":"en"}]'::jsonb),
  ('huile-d-olive', '{"fr":"Huile d''olive","ar":"زيت الزيتون","en":"Olive oil"}'::jsonb, 'epicerie', 'volume', '[{"texte":"Huile d''olive","langue":"fr"},{"texte":"زيت الزيتون","langue":"ar"},{"texte":"Olive oil","langue":"en"},{"texte":"zit zitoun","langue":"darija"}]'::jsonb),
  ('the', '{"fr":"Thé","ar":"شاي","en":"Tea"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Thé","langue":"fr"},{"texte":"شاي","langue":"ar"},{"texte":"Tea","langue":"en"},{"texte":"atay","langue":"darija"},{"texte":"the","langue":"fr"}]'::jsonb),
  ('cafe', '{"fr":"Café","ar":"قهوة","en":"Coffee"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Café","langue":"fr"},{"texte":"قهوة","langue":"ar"},{"texte":"Coffee","langue":"en"},{"texte":"qahwa","langue":"darija"},{"texte":"cafe","langue":"fr"}]'::jsonb),
  ('sel', '{"fr":"Sel","ar":"ملح","en":"Salt"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Sel","langue":"fr"},{"texte":"ملح","langue":"ar"},{"texte":"Salt","langue":"en"},{"texte":"melha","langue":"darija"}]'::jsonb),
  ('concentre-de-tomate', '{"fr":"Concentré de tomate","ar":"معجون الطماطم","en":"Tomato paste"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Concentré de tomate","langue":"fr"},{"texte":"معجون الطماطم","langue":"ar"},{"texte":"Tomato paste","langue":"en"},{"texte":"tmatich m3ajen","langue":"darija"}]'::jsonb),
  ('lentilles', '{"fr":"Lentilles","ar":"عدس","en":"Lentils"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Lentilles","langue":"fr"},{"texte":"عدس","langue":"ar"},{"texte":"Lentils","langue":"en"},{"texte":"3ads","langue":"darija"}]'::jsonb),
  ('pois-chiches', '{"fr":"Pois chiches","ar":"حمص","en":"Chickpeas"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Pois chiches","langue":"fr"},{"texte":"حمص","langue":"ar"},{"texte":"Chickpeas","langue":"en"},{"texte":"hommos","langue":"darija"}]'::jsonb),
  ('haricots', '{"fr":"Haricots","ar":"لوبيا","en":"Beans"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Haricots","langue":"fr"},{"texte":"لوبيا","langue":"ar"},{"texte":"Beans","langue":"en"},{"texte":"loubia","langue":"darija"}]'::jsonb),
  ('sardines', '{"fr":"Sardines en conserve","ar":"سردين معلب","en":"Canned sardines"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Sardines en conserve","langue":"fr"},{"texte":"سردين معلب","langue":"ar"},{"texte":"Canned sardines","langue":"en"},{"texte":"sardine","langue":"darija"}]'::jsonb),
  ('thon', '{"fr":"Thon en conserve","ar":"تونة","en":"Canned tuna"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Thon en conserve","langue":"fr"},{"texte":"تونة","langue":"ar"},{"texte":"Canned tuna","langue":"en"},{"texte":"tun","langue":"darija"}]'::jsonb),
  ('confiture', '{"fr":"Confiture","ar":"مربى","en":"Jam"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Confiture","langue":"fr"},{"texte":"مربى","langue":"ar"},{"texte":"Jam","langue":"en"},{"texte":"mrabba","langue":"darija"}]'::jsonb),
  ('miel', '{"fr":"Miel","ar":"عسل","en":"Honey"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Miel","langue":"fr"},{"texte":"عسل","langue":"ar"},{"texte":"Honey","langue":"en"},{"texte":"3assel","langue":"darija"}]'::jsonb),
  ('olives', '{"fr":"Olives","ar":"زيتون","en":"Olives"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Olives","langue":"fr"},{"texte":"زيتون","langue":"ar"},{"texte":"Olives","langue":"en"},{"texte":"zitoun","langue":"darija"}]'::jsonb),
  ('harissa', '{"fr":"Harissa","ar":"هريسة","en":"Harissa"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Harissa","langue":"fr"},{"texte":"هريسة","langue":"ar"},{"texte":"Harissa","langue":"en"},{"texte":"harissa","langue":"darija"}]'::jsonb),
  ('biscuits', '{"fr":"Biscuits","ar":"بسكويت","en":"Biscuits"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Biscuits","langue":"fr"},{"texte":"بسكويت","langue":"ar"},{"texte":"Biscuits","langue":"en"},{"texte":"biscuit","langue":"darija"}]'::jsonb),
  ('chocolat', '{"fr":"Chocolat","ar":"شوكولاطة","en":"Chocolate"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Chocolat","langue":"fr"},{"texte":"شوكولاطة","langue":"ar"},{"texte":"Chocolate","langue":"en"},{"texte":"chocolat","langue":"darija"}]'::jsonb),
  ('pate-a-tartiner', '{"fr":"Pâte à tartiner","ar":"معجون الشوكولاطة","en":"Chocolate spread"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Pâte à tartiner","langue":"fr"},{"texte":"معجون الشوكولاطة","langue":"ar"},{"texte":"Chocolate spread","langue":"en"},{"texte":"nutella","langue":"darija"}]'::jsonb),
  ('ketchup-mayonnaise', '{"fr":"Ketchup et mayonnaise","ar":"كاتشاب ومايونيز","en":"Ketchup and mayonnaise"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Ketchup et mayonnaise","langue":"fr"},{"texte":"كاتشاب ومايونيز","langue":"ar"},{"texte":"Ketchup and mayonnaise","langue":"en"},{"texte":"ketchup","langue":"darija"},{"texte":"mayonnaise","langue":"darija"}]'::jsonb),
  ('cereales-petit-dejeuner', '{"fr":"Céréales du petit-déjeuner","ar":"رقائق الحبوب","en":"Breakfast cereals"}'::jsonb, 'epicerie', 'masse', '[{"texte":"Céréales du petit-déjeuner","langue":"fr"},{"texte":"رقائق الحبوب","langue":"ar"},{"texte":"Breakfast cereals","langue":"en"},{"texte":"corn flakes","langue":"darija"}]'::jsonb),
  ('lait', '{"fr":"Lait","ar":"حليب","en":"Milk"}'::jsonb, 'cremerie', 'volume', '[{"texte":"Lait","langue":"fr"},{"texte":"حليب","langue":"ar"},{"texte":"Milk","langue":"en"},{"texte":"halib","langue":"darija"}]'::jsonb),
  ('lait-en-poudre', '{"fr":"Lait en poudre","ar":"حليب مجفف","en":"Powdered milk"}'::jsonb, 'cremerie', 'masse', '[{"texte":"Lait en poudre","langue":"fr"},{"texte":"حليب مجفف","langue":"ar"},{"texte":"Powdered milk","langue":"en"},{"texte":"halib poudre","langue":"darija"}]'::jsonb),
  ('beurre', '{"fr":"Beurre","ar":"زبدة","en":"Butter"}'::jsonb, 'cremerie', 'masse', '[{"texte":"Beurre","langue":"fr"},{"texte":"زبدة","langue":"ar"},{"texte":"Butter","langue":"en"},{"texte":"zebda","langue":"darija"}]'::jsonb),
  ('margarine', '{"fr":"Margarine","ar":"مرغرين","en":"Margarine"}'::jsonb, 'cremerie', 'masse', '[{"texte":"Margarine","langue":"fr"},{"texte":"مرغرين","langue":"ar"},{"texte":"Margarine","langue":"en"},{"texte":"margarine","langue":"darija"}]'::jsonb),
  ('yaourt', '{"fr":"Yaourt","ar":"زبادي","en":"Yogurt"}'::jsonb, 'cremerie', 'piece', '[{"texte":"Yaourt","langue":"fr"},{"texte":"زبادي","langue":"ar"},{"texte":"Yogurt","langue":"en"},{"texte":"yaourt","langue":"darija"}]'::jsonb),
  ('fromage', '{"fr":"Fromage","ar":"جبن","en":"Cheese"}'::jsonb, 'cremerie', 'masse', '[{"texte":"Fromage","langue":"fr"},{"texte":"جبن","langue":"ar"},{"texte":"Cheese","langue":"en"},{"texte":"jben","langue":"darija"}]'::jsonb),
  ('lben-raib', '{"fr":"Lben et raïb","ar":"لبن ورايب","en":"Lben and raïb"}'::jsonb, 'cremerie', 'volume', '[{"texte":"Lben et raïb","langue":"fr"},{"texte":"لبن ورايب","langue":"ar"},{"texte":"Lben and raïb","langue":"en"},{"texte":"lben","langue":"darija"},{"texte":"raib","langue":"darija"},{"texte":"ayran","langue":"darija"}]'::jsonb),
  ('creme-fraiche', '{"fr":"Crème fraîche","ar":"كريمة طرية","en":"Cream"}'::jsonb, 'cremerie', 'masse', '[{"texte":"Crème fraîche","langue":"fr"},{"texte":"كريمة طرية","langue":"ar"},{"texte":"Cream","langue":"en"},{"texte":"creme","langue":"darija"}]'::jsonb),
  ('oeufs', '{"fr":"Œufs","ar":"بيض","en":"Eggs"}'::jsonb, 'frais', 'piece', '[{"texte":"Œufs","langue":"fr"},{"texte":"بيض","langue":"ar"},{"texte":"Eggs","langue":"en"},{"texte":"bid","langue":"darija"},{"texte":"oeufs","langue":"fr"}]'::jsonb),
  ('charcuterie-dinde', '{"fr":"Charcuterie de dinde","ar":"لحم الديك الرومي","en":"Turkey cold cuts"}'::jsonb, 'charcuterie', 'masse', '[{"texte":"Charcuterie de dinde","langue":"fr"},{"texte":"لحم الديك الرومي","langue":"ar"},{"texte":"Turkey cold cuts","langue":"en"},{"texte":"dinde","langue":"darija"}]'::jsonb),
  ('poulet', '{"fr":"Poulet","ar":"دجاج","en":"Chicken"}'::jsonb, 'frais', 'masse', '[{"texte":"Poulet","langue":"fr"},{"texte":"دجاج","langue":"ar"},{"texte":"Chicken","langue":"en"},{"texte":"djaj","langue":"darija"}]'::jsonb),
  ('viande-hachee', '{"fr":"Viande hachée","ar":"لحم مفروم","en":"Minced beef"}'::jsonb, 'frais', 'masse', '[{"texte":"Viande hachée","langue":"fr"},{"texte":"لحم مفروم","langue":"ar"},{"texte":"Minced beef","langue":"en"},{"texte":"kefta","langue":"darija"}]'::jsonb),
  ('viande-boeuf', '{"fr":"Viande de bœuf","ar":"لحم بقري","en":"Beef"}'::jsonb, 'frais', 'masse', '[{"texte":"Viande de bœuf","langue":"fr"},{"texte":"لحم بقري","langue":"ar"},{"texte":"Beef","langue":"en"},{"texte":"lham","langue":"darija"}]'::jsonb),
  ('pain', '{"fr":"Pain","ar":"خبز","en":"Bread"}'::jsonb, 'frais', 'piece', '[{"texte":"Pain","langue":"fr"},{"texte":"خبز","langue":"ar"},{"texte":"Bread","langue":"en"},{"texte":"khobz","langue":"darija"}]'::jsonb),
  ('pommes-de-terre', '{"fr":"Pommes de terre","ar":"بطاطس","en":"Potatoes"}'::jsonb, 'frais', 'masse', '[{"texte":"Pommes de terre","langue":"fr"},{"texte":"بطاطس","langue":"ar"},{"texte":"Potatoes","langue":"en"},{"texte":"batata","langue":"darija"}]'::jsonb),
  ('tomates', '{"fr":"Tomates","ar":"طماطم","en":"Tomatoes"}'::jsonb, 'frais', 'masse', '[{"texte":"Tomates","langue":"fr"},{"texte":"طماطم","langue":"ar"},{"texte":"Tomatoes","langue":"en"},{"texte":"matisha","langue":"darija"}]'::jsonb),
  ('oignons', '{"fr":"Oignons","ar":"بصل","en":"Onions"}'::jsonb, 'frais', 'masse', '[{"texte":"Oignons","langue":"fr"},{"texte":"بصل","langue":"ar"},{"texte":"Onions","langue":"en"},{"texte":"bsla","langue":"darija"}]'::jsonb),
  ('carottes', '{"fr":"Carottes","ar":"جزر","en":"Carrots"}'::jsonb, 'frais', 'masse', '[{"texte":"Carottes","langue":"fr"},{"texte":"جزر","langue":"ar"},{"texte":"Carrots","langue":"en"},{"texte":"khizzou","langue":"darija"}]'::jsonb),
  ('bananes', '{"fr":"Bananes","ar":"موز","en":"Bananas"}'::jsonb, 'frais', 'masse', '[{"texte":"Bananes","langue":"fr"},{"texte":"موز","langue":"ar"},{"texte":"Bananas","langue":"en"},{"texte":"banane","langue":"darija"}]'::jsonb),
  ('pommes', '{"fr":"Pommes","ar":"تفاح","en":"Apples"}'::jsonb, 'frais', 'masse', '[{"texte":"Pommes","langue":"fr"},{"texte":"تفاح","langue":"ar"},{"texte":"Apples","langue":"en"},{"texte":"tefah","langue":"darija"}]'::jsonb),
  ('oranges', '{"fr":"Oranges","ar":"برتقال","en":"Oranges"}'::jsonb, 'frais', 'masse', '[{"texte":"Oranges","langue":"fr"},{"texte":"برتقال","langue":"ar"},{"texte":"Oranges","langue":"en"},{"texte":"limoun","langue":"darija"}]'::jsonb),
  ('jus', '{"fr":"Jus","ar":"عصير","en":"Juice"}'::jsonb, 'boissons', 'volume', '[{"texte":"Jus","langue":"fr"},{"texte":"عصير","langue":"ar"},{"texte":"Juice","langue":"en"},{"texte":"3asir","langue":"darija"}]'::jsonb),
  ('boisson-gazeuse', '{"fr":"Boisson gazeuse","ar":"مشروب غازي","en":"Soft drink"}'::jsonb, 'boissons', 'volume', '[{"texte":"Boisson gazeuse","langue":"fr"},{"texte":"مشروب غازي","langue":"ar"},{"texte":"Soft drink","langue":"en"},{"texte":"gazouz","langue":"darija"},{"texte":"soda","langue":"fr"}]'::jsonb),
  ('eau', '{"fr":"Eau minérale","ar":"ماء","en":"Mineral water"}'::jsonb, 'boissons', 'volume', '[{"texte":"Eau minérale","langue":"fr"},{"texte":"ماء","langue":"ar"},{"texte":"Mineral water","langue":"en"},{"texte":"lma","langue":"darija"},{"texte":"eau","langue":"fr"}]'::jsonb),
  ('boisson-energisante', '{"fr":"Boisson énergisante","ar":"مشروب الطاقة","en":"Energy drink"}'::jsonb, 'boissons', 'volume', '[{"texte":"Boisson énergisante","langue":"fr"},{"texte":"مشروب الطاقة","langue":"ar"},{"texte":"Energy drink","langue":"en"},{"texte":"energy","langue":"darija"}]'::jsonb),
  ('lessive', '{"fr":"Lessive","ar":"مسحوق الغسيل","en":"Laundry detergent"}'::jsonb, 'menage', 'masse', '[{"texte":"Lessive","langue":"fr"},{"texte":"مسحوق الغسيل","langue":"ar"},{"texte":"Laundry detergent","langue":"en"},{"texte":"lessive","langue":"darija"},{"texte":"tide","langue":"darija"}]'::jsonb),
  ('liquide-vaisselle', '{"fr":"Liquide vaisselle","ar":"سائل الأطباق","en":"Dish soap"}'::jsonb, 'menage', 'volume', '[{"texte":"Liquide vaisselle","langue":"fr"},{"texte":"سائل الأطباق","langue":"ar"},{"texte":"Dish soap","langue":"en"},{"texte":"sabon dyal lmwaa3en","langue":"darija"}]'::jsonb),
  ('eau-de-javel', '{"fr":"Eau de Javel","ar":"ماء جافيل","en":"Bleach"}'::jsonb, 'menage', 'volume', '[{"texte":"Eau de Javel","langue":"fr"},{"texte":"ماء جافيل","langue":"ar"},{"texte":"Bleach","langue":"en"},{"texte":"javel","langue":"darija"}]'::jsonb),
  ('nettoyant-sol', '{"fr":"Nettoyant sol","ar":"منظف الأرضية","en":"Floor cleaner"}'::jsonb, 'menage', 'volume', '[{"texte":"Nettoyant sol","langue":"fr"},{"texte":"منظف الأرضية","langue":"ar"},{"texte":"Floor cleaner","langue":"en"},{"texte":"nettoyant","langue":"darija"}]'::jsonb),
  ('savon', '{"fr":"Savon de toilette","ar":"صابون","en":"Bar soap"}'::jsonb, 'hygiene', 'masse', '[{"texte":"Savon de toilette","langue":"fr"},{"texte":"صابون","langue":"ar"},{"texte":"Bar soap","langue":"en"},{"texte":"saboun","langue":"darija"}]'::jsonb),
  ('savon-liquide', '{"fr":"Savon liquide","ar":"صابون سائل","en":"Liquid soap"}'::jsonb, 'hygiene', 'volume', '[{"texte":"Savon liquide","langue":"fr"},{"texte":"صابون سائل","langue":"ar"},{"texte":"Liquid soap","langue":"en"},{"texte":"saboun","langue":"darija"}]'::jsonb),
  ('dentifrice', '{"fr":"Dentifrice","ar":"معجون الأسنان","en":"Toothpaste"}'::jsonb, 'hygiene', 'volume', '[{"texte":"Dentifrice","langue":"fr"},{"texte":"معجون الأسنان","langue":"ar"},{"texte":"Toothpaste","langue":"en"},{"texte":"dentifrice","langue":"darija"}]'::jsonb),
  ('shampoing', '{"fr":"Shampoing","ar":"شامبو","en":"Shampoo"}'::jsonb, 'hygiene', 'volume', '[{"texte":"Shampoing","langue":"fr"},{"texte":"شامبو","langue":"ar"},{"texte":"Shampoo","langue":"en"},{"texte":"shampooing","langue":"darija"}]'::jsonb),
  ('papier-toilette', '{"fr":"Papier toilette","ar":"ورق المرحاض","en":"Toilet paper"}'::jsonb, 'hygiene', 'piece', '[{"texte":"Papier toilette","langue":"fr"},{"texte":"ورق المرحاض","langue":"ar"},{"texte":"Toilet paper","langue":"en"},{"texte":"papier","langue":"darija"}]'::jsonb)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'riz' WHERE "slug" IN ('riz-long-grain-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'sucre' WHERE "slug" IN ('sucre-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'farine' WHERE "slug" IN ('farine-ble-5kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'semoule' WHERE "slug" IN ('semoule-fine-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'couscous' WHERE "slug" IN ('couscous-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'pates' WHERE "slug" IN ('pates-spaghetti-500g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'vermicelles' WHERE "slug" IN ('vermicelles-500g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'huile-de-table' WHERE "slug" IN ('huile-table-1l') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'huile-d-olive' WHERE "slug" IN ('huile-olive-1l') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'the' WHERE "slug" IN ('the-vert-200g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'cafe' WHERE "slug" IN ('cafe-moulu-250g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'sel' WHERE "slug" IN ('sel-fin-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'concentre-de-tomate' WHERE "slug" IN ('concentre-tomate-400g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'lentilles' WHERE "slug" IN ('lentilles-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'pois-chiches' WHERE "slug" IN ('pois-chiches-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'haricots' WHERE "slug" IN ('haricots-blancs-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'sardines' WHERE "slug" IN ('sardines-conserve-125g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'thon' WHERE "slug" IN ('thon-conserve-160g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'confiture' WHERE "slug" IN ('confiture-370g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'miel' WHERE "slug" IN ('miel-500g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'olives' WHERE "slug" IN ('olives-500g') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'lait' WHERE "slug" IN ('lait-demi-ecreme-1l') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'beurre' WHERE "slug" IN ('beurre-1kg', 'beurre-centrale-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'oeufs' WHERE "slug" IN ('oeufs-plateau-30') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'yaourt' WHERE "slug" IN ('yaourt-nature-x4') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'poulet' WHERE "slug" IN ('poulet-frais-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'viande-hachee' WHERE "slug" IN ('viande-hachee-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'viande-boeuf' WHERE "slug" IN ('viande-boeuf-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'pain' WHERE "slug" IN ('pain-baguette') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'pommes-de-terre' WHERE "slug" IN ('pommes-de-terre-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'tomates' WHERE "slug" IN ('tomates-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'oignons' WHERE "slug" IN ('oignons-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'carottes' WHERE "slug" IN ('carottes-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'bananes' WHERE "slug" IN ('bananes-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'pommes' WHERE "slug" IN ('pommes-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'oranges' WHERE "slug" IN ('oranges-1kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'eau' WHERE "slug" IN ('eau-minerale-1-5l', 'eau-minerale-5l', 'eau-minerale-ain-saiss') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'boisson-gazeuse' WHERE "slug" IN ('soda-1l', 'coca-cola-vanille-ou-cerise') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'jus' WHERE "slug" IN ('jus-orange-1l') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'lessive' WHERE "slug" IN ('lessive-poudre-3kg') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'liquide-vaisselle' WHERE "slug" IN ('liquide-vaisselle-1l') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'eau-de-javel' WHERE "slug" IN ('eau-de-javel-1l') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'nettoyant-sol' WHERE "slug" IN ('nettoyant-sol-1l') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'savon-liquide' WHERE "slug" IN ('savon-liquide-250ml') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'shampoing' WHERE "slug" IN ('shampoing-400ml') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'dentifrice' WHERE "slug" IN ('dentifrice-75ml') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'papier-toilette' WHERE "slug" IN ('papier-toilette-x12') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'boisson-energisante' WHERE "slug" IN ('monster-mangue') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'lben-raib' WHERE "slug" IN ('ayran-piknik') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'margarine' WHERE "slug" IN ('margarine-luxmar') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'charcuterie-dinde' WHERE "slug" IN ('tranches-de-dinde-genial', 'supreme-filet-de-dinde-dindy') AND "famille" IS NULL;
--> statement-breakpoint
UPDATE "products" SET "famille" = 'harissa' WHERE "slug" IN ('harissa-oualili') AND "famille" IS NULL;
--> statement-breakpoint
-- Garde-fou avant la contrainte : une valeur libre inconnue ne doit pas bloquer la migration.
UPDATE "products" SET "famille" = NULL WHERE "famille" IS NOT NULL AND "famille" NOT IN (SELECT "slug" FROM "families");
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_famille_families_slug_fk" FOREIGN KEY ("famille") REFERENCES "public"."families"("slug") ON DELETE no action ON UPDATE no action;