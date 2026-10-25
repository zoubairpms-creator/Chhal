ALTER TABLE "match_candidates" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD COLUMN "ingestion_key" text;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD COLUMN "observation_id" integer;--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "ingestion_key" text;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_observation_id_price_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."price_observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_ingestion_key_unique" UNIQUE("ingestion_key");--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_ingestion_key_unique" UNIQUE("ingestion_key");