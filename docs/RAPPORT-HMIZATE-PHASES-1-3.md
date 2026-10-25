# Rapport — hmizate phases 1 à 3 (hors réseau)

Date : 2026-10-25. Verdict : **PASS WITH ACTIONS** (aucune requête réseau faite ; collecte réelle bloquée tant que le contact du robot n'est pas renseigné).

## Décisions reçues
Validité estimée (début + 7 jours) · migration 0006 + rattrapage avec sauvegarde · contact **plus tard** · premier accès réseau ≤ 3 requêtes, BIM d'abord, Carrefour exclu · stockage brut en base.

## Livré
- **Parseur v2** `apps/scraper/src/hmizate-article.ts` (`hmizate-article-2.0.0`) : lit uniquement `<article>`, date de début croisée texte/titre/adresse (jour de semaine vérifié), fin seulement si écrite, estimation +7 j marquée `estimee`, enseigne déduite (Carrefour exclu), promotions conditionnelles marquées, rejets journalisés.
- **Migration 0006** : tables `sources`, `raw_data`, `import_jobs` ; colonnes de traçabilité sur `price_observations` ; contraintes de validité ; vue `published_prices` étendue.
- **Rattrapage** `rattraperCatalogue` (append-only, idempotent) appliqué sur `.data/dev` : 20 prix BIM remplacés par des lignes enrichies (URL, validité, copie brute `raw_data #1`, `observed_at` = horodatage de la copie locale). Sauvegarde : `.data/avant-migration-0006`.
- **API** : un prix dont la fin de validité est dépassée n'apparaît plus (recherche, paniers, rapports).

## Tests
278 verts (247 avant) : parseur 25 (dont copie réelle locale : début 2026-09-01, 24 lignes, 0 rejet), traçabilité 6.

## Conséquence à connaître
Les 20 prix BIM sont **expirés** (fin estimée 2026-09-08, 54 jours) : l'application n'affiche donc plus aucun prix tant qu'une collecte fraîche n'a pas eu lieu. C'est voulu (pas de promotion périmée présentée comme actuelle).

## Reste à faire (⛔ = votre accord)
1. Renseigner `SCRAPER_CONTACT` dans `.env` (vous).
2. ⛔ Phase 4 : premier accès réseau, ≤ 3 requêtes (robots.txt, liste, 1 article), essai à blanc. Le code de collecte (téléchargement, stockage brut, ingestion) reste à écrire avant.
3. ⛔ Phase 5 : première exécution réelle ; phase 6 : planification.
4. Déploiement Cloudflare (option B) : après des prix frais.

---
## Mise à jour — collecte (phase 3 terminée, toujours aucune requête réseau)
- `apps/scraper/src/hmizate-collect.ts` : collecte polie (robots.txt relu, ≥ 2 s entre requêtes, plafond 3 requêtes = robots + liste + 1 article, arrêt sur 403/429/503/anti-robot, contact obligatoire dans le User-Agent) + envoi à l'API. CLI : `pnpm --filter @chhal/scraper hmizate` (essai à blanc par défaut).
- API : `POST /admin/sources/brut` (HTML gzip, idempotent par hash), `PATCH /admin/sources/:slug` (activation explicite, refusée sans décision consignée), `/admin/scraping/releves` avec `tracabilite` + `essaiABlanc` (aucune écriture en essai, doublon = URL + produit + magasin + début, journal `import_jobs`, source non activée = 409).
- Tests : 297 verts (scraper 89, API 165) ; typecheck API et scraper propres.
- Pour la suite (⛔ votre accord) : renseigner `SCRAPER_CONTACT` dans `.env`, puis lancer la commande d'essai à blanc (3 requêtes réelles vers hmizate.ma).
