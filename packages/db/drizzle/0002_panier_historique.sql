CREATE TABLE "carts" (
	"token" text PRIMARY KEY NOT NULL,
	"ville" text NOT NULL,
	"params" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"algorithm_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE VIEW published_history AS
SELECT o.id AS observation_id, o.product_id, o.store_id, o.prix_mad, o.date_releve, o.source, o.confiance, o.test_only
FROM price_observations o
JOIN LATERAL (
  SELECT r.decision FROM observation_reviews r WHERE r.observation_id = o.id ORDER BY r.id DESC LIMIT 1
) lr ON lr.decision = 'publie';
