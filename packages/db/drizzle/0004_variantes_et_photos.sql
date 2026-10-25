ALTER TABLE "products" ADD COLUMN "famille" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_credit" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "origine" text DEFAULT 'manuel' NOT NULL;--> statement-breakpoint
CREATE INDEX "products_famille_idx" ON "products" USING btree ("famille");