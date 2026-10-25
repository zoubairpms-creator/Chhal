CREATE TABLE "preset_baskets" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"profil" text NOT NULL,
	"nom" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"menage" integer DEFAULT 4 NOT NULL,
	"lignes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preset_baskets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- Migration sûre sur une base existante : colonne d'abord nullable, rattrapage des lignes existantes, puis NOT NULL.
ALTER TABLE "products" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "products" SET "slug" = 'produit-' || "id" WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_slug_unique" UNIQUE("slug");
