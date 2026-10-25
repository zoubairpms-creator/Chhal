# Chhal — Rapport v1 (beta)

Date : 2026-10-17. Application de comparaison des prix des supermarchés au Maroc.

## Ce qui fonctionne (vérifié)

| Zone | Contenu | Preuve |
|---|---|---|
| Socle | Monorepo pnpm, schéma Drizzle, migrations, observations immuables (trigger), vue des prix publiés | 21 tests API |
| Fixture beurre | 5 prix triés (78,00 → 112,30), BIM absent, date et source | Test + navigateur |
| Recherche | Alias FR/AR/darija/EN + arabizi (« zit », « zebda ») | 10 tests matching, navigateur |
| Historique | Un point par relevé publié, jamais écrasé | Test API |
| Optimiseur | Sans limite (minimum par article) ; limite k par énumération ; garde-fou à 20 000 sous-ensembles ; tie-break lexicographique ; reproductible ; version d'algorithme | 9 tests, recalcul par force brute |
| Panier | Optimisation, enregistrement, lien de partage `/panier/<jeton>` | Tests API + navigateur |
| Contributions | Invisibles tant que non validées ; anti-abus (limite 10/heure/IP) ; prix aberrant signalé (> 40 % de la médiane) | Tests API |
| Administration | Jeton unique `ADMIN_TOKEN` ; validation, rejet, saisie directe, catalogue, magasins, appariements | Tests API |
| Scraping | Adaptateur modèle sur HTML figé ; robots.txt ; ≥ 2 s entre requêtes ; User-Agent identifiable ; cache ; arrêt sur 403/429 ; `SCRAPE_CONFIRM=1` obligatoire | 7 tests |
| OCR | Extraction du prix depuis un texte OCR, **suggestion seulement** | Test API |
| Web | Next.js trilingue (FR, darija en arabe RTL, EN), repli sur le français, recherche, fiche produit avec graphique, panier, contribution, administration | Build + navigateur |
| CI | Workflows GitHub (tests, scraping quotidien désactivé par défaut) | Fichiers uniquement |

Total : **54 tests verts** (matching 10, optimizer 9, i18n 4, scraper 7, web 3, api 21).

## Ce qui n'est PAS fait ou PAS vérifié

1. **Mobile Expo** : non construit (web d'abord, comme convenu). L'API et l'optimiseur sont prêts à le servir.
2. **Base Neon / PostgreSQL réel** : le fichier `.env` n'existait pas. Tout a été testé sur **PGlite** (PostgreSQL embarqué). Le chemin `pg` (Neon) est écrit mais **non exécuté** : à valider avec `DATABASE_URL` et `DATABASE_URL_TEST`.
3. **Aucun scraping réel** : l'adaptateur est un gabarit. Aucune enseigne n'est activée ; robots.txt et conditions d'utilisation de chaque site sont à vérifier avant de rédiger un vrai adaptateur.
4. **OCR sur image** : seul l'analyse de texte OCR existe ; pas de téléversement de photo ni de fournisseur de vision (`OCR_API_KEY` non utilisé). Stockage R2 non branché.
5. **Données** : seuls les 5 prix du beurre sont réels (ville Casablanca et date 2026-10-17 supposées). Le panier de 10 articles est **fictif** (`source=fixture`, `test_only`) et n'apparaît qu'avec `ALLOW_TEST_DATA=1`, toujours accompagné d'un avertissement.
6. **Catalogue (phase 0bis)** : recherche web de catalogue non lancée ; le catalogue se remplit via `POST /admin/produits`.
7. **Hébergement** : rien n'est déployé. Pas de Turnstile branché (clé absente) ; la limitation de débit est en mémoire (une instance).
8. **Sécurité** : jeton admin stocké dans l'état du navigateur pendant la session uniquement ; HTTPS et en-têtes de sécurité à ajouter au déploiement.
9. **Limite connue** : la recherche par alias s'exécute en mémoire (adaptée jusqu'à quelques dizaines de milliers d'alias) ; au-delà, passer à `pg_trgm`.
10. **Écart au prompt** : PGlite (dépendance non listée) ajouté sur instruction d'autonomie ; `@fastify/cors` et `@fastify/rate-limit` ajoutés (listés dans le plan) ; `cheerio` et `robots-parser` pour le scraper.

## Décisions de conception notables

- **Comparaison mono-magasin** : le meilleur magasin unique ne couvre pas toujours tous les articles. La comparaison se fait donc sur les articles qu'il couvre (`totalOptimiseMemesArticlesMad`), sinon un magasin partiel paraîtrait moins cher.
- **Statut des observations** : tables immuables ; le statut vient de `observation_reviews` (vue `published_prices`). Une observation sans décision est « en attente ».
- **Appariement** : certain (EAN, ou marque + format + nom identiques) → publié ; sinon `match_candidates`, jamais publié automatiquement.

## Lancer

```bash
corepack pnpm install
corepack pnpm -r test
ALLOW_TEST_DATA=1 ADMIN_TOKEN=dev corepack pnpm dev:api   # http://localhost:3001 (PGlite si DATABASE_URL absent)
corepack pnpm dev:web                                     # http://localhost:3000
```

Avec Neon : renseigner `.env` (voir `.env.example`), puis `corepack pnpm db:migrate`.

## Prochaines étapes recommandées

1. Créer `.env` avec les deux URL Neon et rejouer les tests sur PostgreSQL réel.
2. Choisir une enseigne, vérifier robots.txt et conditions d'utilisation, écrire le premier vrai adaptateur.
3. Remplacer le panier fictif par de vrais relevés.
4. Déployer (API sur Render ou Oracle, web sur Vercel) et brancher Turnstile.
5. Phase mobile Expo.
