CREATE TYPE "public"."candidat_statut" AS ENUM('en_attente', 'accepte', 'rejete');--> statement-breakpoint
CREATE TYPE "public"."confiance" AS ENUM('haute', 'moyenne', 'basse');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('publie', 'rejete');--> statement-breakpoint
CREATE TYPE "public"."langue" AS ENUM('fr', 'ar', 'darija', 'en');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('scraping', 'manuel', 'crowd', 'photo', 'catalogue', 'fixture');--> statement-breakpoint
CREATE TYPE "public"."unite" AS ENUM('g', 'kg', 'ml', 'cl', 'l', 'piece');--> statement-breakpoint
CREATE TABLE "chains" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nom" text NOT NULL,
	"nom_ar" text,
	"alias" text[] DEFAULT '{}'::text[] NOT NULL,
	"logo_url" text,
	"actif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "chains_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "match_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle_source" text NOT NULL,
	"chain_id" integer,
	"product_id_propose" integer,
	"score" real NOT NULL,
	"statut" "candidat_statut" DEFAULT 'en_attente' NOT NULL,
	"resolu_par" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observation_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"observation_id" integer NOT NULL,
	"decision" "decision" NOT NULL,
	"reviewer" text NOT NULL,
	"motif" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"prix_mad" numeric(10, 2) NOT NULL,
	"prix_unitaire_mad" numeric(10, 2),
	"date_releve" date NOT NULL,
	"source" "source" NOT NULL,
	"confiance" "confiance" NOT NULL,
	"photo_id" integer,
	"test_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prix_positif" CHECK ("price_observations"."prix_mad" > 0)
);
--> statement-breakpoint
CREATE TABLE "product_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"texte" text NOT NULL,
	"forme_normalisee" text NOT NULL,
	"langue" "langue" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom_normalise" text NOT NULL,
	"nom_affiche" text NOT NULL,
	"marque" text,
	"format_valeur" numeric(12, 3) NOT NULL,
	"format_unite" "unite" NOT NULL,
	"ean" text,
	"categorie" text
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"ville" text NOT NULL,
	"adresse" text,
	"lat" real,
	"lng" real
);
--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_product_id_propose_products_id_fk" FOREIGN KEY ("product_id_propose") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_reviews" ADD CONSTRAINT "observation_reviews_observation_id_price_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."price_observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_obs_idx" ON "observation_reviews" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "obs_product_store_date_idx" ON "price_observations" USING btree ("product_id","store_id","date_releve");--> statement-breakpoint
CREATE INDEX "aliases_forme_idx" ON "product_aliases" USING btree ("forme_normalisee");--> statement-breakpoint
CREATE UNIQUE INDEX "products_ean_uq" ON "products" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "products_nom_idx" ON "products" USING btree ("nom_normalise");--> statement-breakpoint
CREATE INDEX "stores_chain_ville_idx" ON "stores" USING btree ("chain_id","ville");