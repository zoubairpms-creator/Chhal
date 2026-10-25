import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, jsonb, numeric, pgEnum, pgTable, pgView, real, serial, text, timestamp, date, uniqueIndex,
} from "drizzle-orm/pg-core";

export const langueEnum = pgEnum("langue", ["fr", "ar", "darija", "en"]);
export const uniteEnum = pgEnum("unite", ["g", "kg", "ml", "cl", "l", "piece"]);
export const sourceEnum = pgEnum("source", ["scraping", "manuel", "crowd", "photo", "catalogue", "fixture"]);
export const confianceEnum = pgEnum("confiance", ["haute", "moyenne", "basse"]);
export const decisionEnum = pgEnum("decision", ["publie", "rejete"]);
export const candidatStatutEnum = pgEnum("candidat_statut", ["en_attente", "accepte", "rejete"]);

export const chains = pgTable("chains", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nom: text("nom").notNull(),
  nomAr: text("nom_ar"),
  alias: text("alias").array().notNull().default(sql`'{}'::text[]`),
  logoUrl: text("logo_url"),
  actif: boolean("actif").notNull().default(true),
});

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  chainId: integer("chain_id").notNull().references(() => chains.id),
  ville: text("ville").notNull(),
  adresse: text("adresse"),
  lat: real("lat"),
  lng: real("lng"),
}, (t) => [index("stores_chain_ville_idx").on(t.chainId, t.ville)]);

export const families = pgTable("families", {
  slug: text("slug").primaryKey(),
  nom: jsonb("nom").$type<{ fr: string; ar: string; en: string }>().notNull(),
  categorie: text("categorie").notNull(),
  /** Classe de format commune à toutes les variantes : masse, volume ou piece. */
  classe: text("classe").notNull(),
  alias: jsonb("alias").$type<{ texte: string; langue: "fr" | "ar" | "darija" | "en" }[]>().notNull().default(sql`'[]'::jsonb`),
}, (t) => [check("families_classe_valide", sql`${t.classe} in ('masse', 'volume', 'piece')`)]);

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nomNormalise: text("nom_normalise").notNull(),
  nomAffiche: text("nom_affiche").notNull(),
  marque: text("marque"),
  formatValeur: numeric("format_valeur", { precision: 12, scale: 3 }).notNull(),
  formatUnite: uniteEnum("format_unite").notNull(),
  ean: text("ean"),
  categorie: text("categorie"),
  /** Regroupe les variantes d'un même article (ex. « huile-de-table » : marques et formats différents). */
  famille: text("famille").references(() => families.slug),
  /** Photo du produit (URL). Toujours accompagnée de `imageCredit`. */
  imageUrl: text("image_url"),
  /** Mention de source et de licence de la photo (ex. « Photo : Open Food Facts, CC BY-SA »). */
  imageCredit: text("image_credit"),
  /** D'où vient la fiche produit : manuel, openfoodfacts, crowd… */
  origine: text("origine").notNull().default("manuel"),
}, (t) => [
  uniqueIndex("products_ean_uq").on(t.ean),
  index("products_nom_idx").on(t.nomNormalise),
  index("products_famille_idx").on(t.famille),
]);

export const productAliases = pgTable("product_aliases", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  texte: text("texte").notNull(),
  formeNormalisee: text("forme_normalisee").notNull(),
  langue: langueEnum("langue").notNull(),
}, (t) => [index("aliases_forme_idx").on(t.formeNormalisee)]);

// Sources de données externes (migration 0006). `activee` est faux par défaut : l'activation est un acte explicite et daté.
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nom: text("nom").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(),
  conditionsUrl: text("conditions_url"),
  robotsVerifieLe: timestamp("robots_verifie_le", { withTimezone: true }),
  robotsHash: text("robots_hash"),
  activee: boolean("activee").notNull().default(false),
  decisionJuridique: text("decision_juridique").notNull().default("non_evaluee"),
  decideeLe: date("decidee_le"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Données brutes conservées avant toute lecture (HTML gzip + base64). Unicité (source, hash) : un contenu identique n'est jamais retraité.
export const rawData = pgTable("raw_data", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => sources.id),
  url: text("url").notNull(),
  hashSha256: text("hash_sha256").notNull(),
  contentType: text("content_type"),
  httpStatus: integer("http_status"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  parserVersion: text("parser_version"),
  contenuGzipB64: text("contenu_gzip_b64").notNull(),
  note: text("note"),
}, (t) => [uniqueIndex("raw_data_source_hash_uq").on(t.sourceId, t.hashSha256)]);

export const importJobs = pgTable("import_jobs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => sources.id),
  debut: timestamp("debut", { withTimezone: true }).notNull().defaultNow(),
  fin: timestamp("fin", { withTimezone: true }),
  statut: text("statut").notNull().default("en_cours"),
  dryRun: boolean("dry_run").notNull().default(true),
  pagesLues: integer("pages_lues").notNull().default(0),
  observationsCreees: integer("observations_creees").notNull().default(0),
  rejets: jsonb("rejets"),
  erreur: text("erreur"),
});

export const priceObservations = pgTable("price_observations", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  storeId: integer("store_id").notNull().references(() => stores.id),
  prixMad: numeric("prix_mad", { precision: 10, scale: 2 }).notNull(),
  prixUnitaireMad: numeric("prix_unitaire_mad", { precision: 10, scale: 2 }),
  dateReleve: date("date_releve").notNull(),
  source: sourceEnum("source").notNull(),
  confiance: confianceEnum("confiance").notNull(),
  photoId: integer("photo_id"),
  testOnly: boolean("test_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Traçabilité (migration 0006) : toutes optionnelles pour les anciennes lignes.
  observedAt: timestamp("observed_at", { withTimezone: true }),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  validityStatus: text("validity_status"),
  sourceUrl: text("source_url"),
  rawDataId: integer("raw_data_id").references(() => rawData.id),
  collectionMethod: text("collection_method"),
  devise: text("devise").notNull().default("MAD"),
  confianceMotif: text("confiance_motif"),
  ingestionKey: text("ingestion_key").unique(),
}, (t) => [
  check("prix_positif", sql`${t.prixMad} > 0`),
  check("validity_status_valide", sql`${t.validityStatus} IS NULL OR ${t.validityStatus} IN ('connue','estimee','inconnue')`),
  check("validity_coherente", sql`${t.validUntil} IS NULL OR ${t.validFrom} IS NULL OR ${t.validUntil} >= ${t.validFrom}`),
  index("obs_product_store_date_idx").on(t.productId, t.storeId, t.dateReleve),
]);

export const observationReviews = pgTable("observation_reviews", {
  id: serial("id").primaryKey(),
  observationId: integer("observation_id").notNull().references(() => priceObservations.id),
  decision: decisionEnum("decision").notNull(),
  reviewer: text("reviewer").notNull(),
  motif: text("motif"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("reviews_obs_idx").on(t.observationId)]);

export const matchCandidates = pgTable("match_candidates", {
  id: serial("id").primaryKey(),
  libelleSource: text("libelle_source").notNull(),
  chainId: integer("chain_id").references(() => chains.id),
  productIdPropose: integer("product_id_propose").references(() => products.id),
  score: real("score").notNull(),
  statut: candidatStatutEnum("statut").notNull().default("en_attente"),
  resoluPar: text("resolu_par"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  ingestionKey: text("ingestion_key").unique(),
  observationId: integer("observation_id").references(() => priceObservations.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Vue published_prices (définie dans la migration 0001) : dernier prix publié par produit et magasin.
export const priceSelect = pgView("published_prices", {
  observationId: integer("observation_id"),
  productId: integer("product_id").notNull(),
  storeId: integer("store_id").notNull(),
  prixMad: numeric("prix_mad", { precision: 10, scale: 2 }).notNull(),
  prixUnitaireMad: numeric("prix_unitaire_mad", { precision: 10, scale: 2 }),
  dateReleve: date("date_releve").notNull(),
  source: sourceEnum("source").notNull(),
  confiance: confianceEnum("confiance").notNull(),
  testOnly: boolean("test_only").notNull(),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  validityStatus: text("validity_status"),
  sourceUrl: text("source_url"),
  observedAt: timestamp("observed_at", { withTimezone: true }),
}).existing();

export const carts = pgTable("carts", {
  token: text("token").primaryKey(),
  ville: text("ville").notNull(),
  params: jsonb("params").notNull(),
  items: jsonb("items").notNull(),
  result: jsonb("result").notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Vue published_history (migration 0002) : toutes les observations publiées, pour l'historique des prix.
export const historySelect = pgView("published_history", {
  observationId: integer("observation_id"),
  productId: integer("product_id").notNull(),
  storeId: integer("store_id").notNull(),
  prixMad: numeric("prix_mad", { precision: 10, scale: 2 }).notNull(),
  dateReleve: date("date_releve").notNull(),
  source: sourceEnum("source").notNull(),
  confiance: confianceEnum("confiance").notNull(),
  testOnly: boolean("test_only").notNull(),
}).existing();

export const presetBaskets = pgTable("preset_baskets", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  profil: text("profil").notNull(),
  nom: jsonb("nom").$type<{ fr: string; ar: string; en: string }>().notNull(),
  description: jsonb("description").$type<{ fr: string; ar: string; en: string }>().notNull(),
  menage: integer("menage").notNull().default(4),
  lignes: jsonb("lignes").$type<({ slug: string; quantite: number } | { famille: string; quantiteBase: number; unite: "kg" | "l" | "piece" })[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
