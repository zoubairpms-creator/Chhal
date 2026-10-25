CREATE TABLE "import_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"debut" timestamp with time zone DEFAULT now() NOT NULL,
	"fin" timestamp with time zone,
	"statut" text DEFAULT 'en_cours' NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"pages_lues" integer DEFAULT 0 NOT NULL,
	"observations_creees" integer DEFAULT 0 NOT NULL,
	"rejets" jsonb,
	"erreur" text
);
--> statement-breakpoint
CREATE TABLE "raw_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"url" text NOT NULL,
	"hash_sha256" text NOT NULL,
	"content_type" text,
	"http_status" integer,
	"fetched_at" timestamp with time zone NOT NULL,
	"parser_version" text,
	"contenu_gzip_b64" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nom" text NOT NULL,
	"url" text NOT NULL,
	"type" text NOT NULL,
	"conditions_url" text,
	"robots_verifie_le" timestamp with time zone,
	"robots_hash" text,
	"activee" boolean DEFAULT false NOT NULL,
	"decision_juridique" text DEFAULT 'non_evaluee' NOT NULL,
	"decidee_le" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "valid_from" date;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "valid_until" date;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "validity_status" text;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "raw_data_id" integer;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "collection_method" text;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "devise" text DEFAULT 'MAD' NOT NULL;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "confiance_motif" text;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_data" ADD CONSTRAINT "raw_data_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raw_data_source_hash_uq" ON "raw_data" USING btree ("source_id","hash_sha256");--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_raw_data_id_raw_data_id_fk" FOREIGN KEY ("raw_data_id") REFERENCES "public"."raw_data"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "validity_status_valide" CHECK ("price_observations"."validity_status" IS NULL OR "price_observations"."validity_status" IN ('connue','estimee','inconnue'));--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "validity_coherente" CHECK ("price_observations"."valid_until" IS NULL OR "price_observations"."valid_from" IS NULL OR "price_observations"."valid_until" >= "price_observations"."valid_from");
--> statement-breakpoint
CREATE OR REPLACE VIEW published_prices AS
SELECT DISTINCT ON (o.product_id, o.store_id)
  o.id AS observation_id, o.product_id, o.store_id, o.prix_mad, o.prix_unitaire_mad,
  o.date_releve, o.source, o.confiance, o.test_only,
  o.valid_from, o.valid_until, o.validity_status, o.source_url, o.observed_at
FROM price_observations o
JOIN LATERAL (
  SELECT r.decision FROM observation_reviews r
  WHERE r.observation_id = o.id ORDER BY r.id DESC LIMIT 1
) lr ON lr.decision = 'publie'
ORDER BY o.product_id, o.store_id, o.date_releve DESC, o.id DESC;