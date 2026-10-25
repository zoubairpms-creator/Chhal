CREATE FUNCTION forbid_observation_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'price_observations est immuable (historique conserve) : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER price_observations_immutable
BEFORE UPDATE OR DELETE ON price_observations
FOR EACH ROW EXECUTE FUNCTION forbid_observation_change();
--> statement-breakpoint
CREATE FUNCTION forbid_review_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'observation_reviews est immuable : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER observation_reviews_immutable
BEFORE UPDATE OR DELETE ON observation_reviews
FOR EACH ROW EXECUTE FUNCTION forbid_review_change();
--> statement-breakpoint
CREATE VIEW published_prices AS
SELECT DISTINCT ON (o.product_id, o.store_id)
  o.id AS observation_id, o.product_id, o.store_id, o.prix_mad, o.prix_unitaire_mad,
  o.date_releve, o.source, o.confiance, o.test_only
FROM price_observations o
JOIN LATERAL (
  SELECT r.decision FROM observation_reviews r
  WHERE r.observation_id = o.id ORDER BY r.id DESC LIMIT 1
) lr ON lr.decision = 'publie'
ORDER BY o.product_id, o.store_id, o.date_releve DESC, o.id DESC;
