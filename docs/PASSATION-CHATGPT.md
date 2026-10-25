> Actualisation du deploiement : lire docs/DEPLOIEMENT-PREVERSION-2026-10-25.md. Neon chhal-preview est initialise (0000-0007, 52 produits, 4 paniers, zero prix). Render/Cloudflare non deployes ; la base locale reste intacte.

> Livraison V1 ChatGPT : lire docs/PASSATION-CLAUDE-V1.md et docs/RAPPORT-V1-CHATGPT.md. Migration 0007 preparee et testee en memoire, non appliquee a la base existante. Les paragraphes suivants sont historiques.

> Mise a jour ChatGPT du 25/10/2026 : lire docs/REPRISE-CHATGPT-2026-10-25.md pour le dernier etat (332 tests locaux PASS, proxy runtime, preparation du deploiement). Le texte ci-dessous conserve le contexte precedent ; installation Cloudflare et collecte restent bloquees.

# Passation du projet Chhal (شحال) — à destination de ChatGPT

Rédigée le 2026-10-25. **Aucun secret dans ce fichier** : jetons, clés et authtokens ne doivent jamais être écrits dans le dépôt, le chat ou un fichier de configuration par l'agent ; le porteur les saisit lui-même.

## 1. Le produit
Comparateur de prix de supermarchés marocains : prix **datés, sourcés, avec confiance et validité**, paniers optimisés, prix au kg/L/pièce, familles « n'importe quelle marque », trilingue FR / darija-arabe (RTL) / EN, PWA hors ligne, rapports PDF par impression navigateur. Public : tout utilisateur. Principe cardinal : **aucune comparaison trompeuse** ; une donnée absente ou périmée n'est jamais présentée comme actuelle.

## 2. Architecture (monorepo pnpm, dossier `C:\Users\anass\Desktop\projet`, pas de dépôt git)
| Chemin | Rôle |
|---|---|
| `apps/web` | Next.js 16 (port 3000), proxy same-origin `/api-proxy`, PWA (`public/sw.js`) |
| `apps/api` | Fastify 5 (port 3001), toutes les routes dans `src/app.ts` |
| `apps/scraper` | Collecte (cheerio, robots-parser), parseur hmizate v2, CLI |
| `packages/db` | Drizzle + PGlite (dev) / PostgreSQL Neon (prod), migrations `drizzle/0000…0006` |
| `packages/matching`, `optimizer`, `i18n` | Appariement produits, optimiseur de panier déterministe v1.0.0, traductions |
| `docs/` | Rapports, plans, diagnostic (lire d'abord `DIAGNOSTIC-2026-10-18.md`, `PLAN-HMIZATE.md`, `RAPPORT-HMIZATE-PHASES-1-3.md`, `PLAN-CLOUDFLARE.md`) |

Données : `price_observations` est **append-only** (trigger interdisant UPDATE/DELETE). Statut par `observation_reviews` (dernier avis gagne) ; vues `published_prices`, `published_history`. Correction = rejeter l'ancienne ligne + en créer une nouvelle. Sources : scraping | manuel | crowd | photo | catalogue | fixture ; confiance haute/moyenne/basse ; `test_only` ; `ALLOW_TEST_DATA` refusé en production.

## 3. État vérifié au 2026-10-25
- **297 tests verts** (matching 10, optimizer 9, i18n 4, web 20, scraper 89, API 165) ; typecheck API et scraper propres. Commande : `corepack pnpm -r --if-present test` (pas de pnpm global).
- Base dev : `.data/dev` (PGlite), migration 0006 appliquée ; sauvegardes `.data/avant-migration-0004|0005|0006` et `avant-correction-provenance`.
- **Données réelles : 20 prix BIM (catalogue du 2026-09-01, source hmizate.ma), enrichis (URL, validité estimée jusqu'au 2026-09-08, donnée brute `raw_data #1`).** Ils sont **expirés** : l'application n'affiche donc **aucun prix** tant qu'aucune collecte fraîche n'a réussi. C'est voulu.
- Aucune requête réseau vers hmizate.ma n'a été faite avec le nouveau collecteur. **Bloquant : `SCRAPER_CONTACT` est absent de `.env`** (le robot refuse de tourner sans). Le porteur doit fournir un contact dédié (adresse ou URL) qui sera visible dans le User-Agent.
- Lancement local : API depuis la racine avec `.env` : `node apps/api/node_modules/tsx/dist/cli.mjs --env-file=.env apps/api/src/server.ts`. Redémarrer l'API après toute modification (le collecteur dépend des nouvelles routes).

## 4. Commandes utiles
- Essai à blanc de collecte (3 requêtes max, aucune écriture) : `corepack pnpm --filter @chhal/scraper hmizate`
- Réel (⛔ accord) : ajouter `--confirm` **et** `SCRAPE_CONFIRM=1`, source activée par `PATCH /admin/sources/hmizate {"activee":true}`.
- Rattrapage BIM (déjà appliqué, idempotent) : `corepack pnpm --filter @chhal/scraper bim:rattrapage`
- Import CSV de relevés : voir `docs/releves-a-saisir.csv`, API `/admin/releves/import` (essai à blanc disponible).

## 5. Décisions du porteur (à respecter)
- hmizate.ma : usage du contenu tiers **accepté sous sa responsabilité** (pas une validation juridique), consigné dans `sources` (`acceptee_par_le_porteur`, 2026-10-18). Périmètre : **BIM d'abord** ; Carrefour **exclu** (CGU). Fin de validité « semaine de promotions » : **estimée = début + 7 jours**, marquée `estimee`. Premier accès réseau : **3 requêtes max**, essai à blanc.
- Cloudflare : **option B** — web Next.js sur Workers (adaptateur `@opennextjs/cloudflare`, à vérifier avec Next 16), **API Fastify sur un hébergeur Node gratuit** (ex. Render), base **Neon**. Ajout des dépendances (`@opennextjs/cloudflare`, `wrangler`) **approuvé**. Voir `docs/PLAN-CLOUDFLARE.md`.
- Free tiers uniquement, web d'abord. Ne pas mélanger les ports avec le projet « ERP AI » du porteur (tunnel ngrok sur le port 8000 : ne pas y toucher).

## 6. Méthode imposée par le porteur
Plan → accord écrit → **tests d'abord** → code → rapport (PASS / PASS WITH ACTIONS / FAIL / BLOCKED). **Arrêt et accord obligatoires avant** : suppression de fichiers/données, nouvelle dépendance, changement de schéma/migration sur base existante (sauvegarde préalable), données réelles/personnelles, production, décision juridique/commerciale, scraping réel, commit/push. Jamais de commit ni push sans demande. Ne pas inventer de résultats de tests ni de prix. Ne pas modifier un fichier qu'un autre agent est en train de modifier. Pas d'e-mail personnel dans les User-Agents ou logs.

## 7. Déploiement Cloudflare — ce que ChatGPT peut faire
Il peut préparer et exécuter le déploiement, **si** le porteur valide chaque étape marquée ⛔ :
1. ⛔ Ajouter `@opennextjs/cloudflare` + `wrangler` à `apps/web`, créer `wrangler.jsonc`, remplacer le rewrite `/api-proxy` par une URL d'API de production (variable publique) ou une route proxy compatible Workers.
2. Tests : suite complète puis `wrangler dev` local.
3. ⛔ API Node : déployer `apps/api` sur Render (ou équivalent gratuit) avec `DATABASE_URL` (Neon), `ADMIN_TOKEN` fort, `CORS_ORIGIN` = URL finale, `ALLOW_TEST_DATA` **absent**, `trustProxy` activé. Appliquer les migrations 0000–0006 sur Neon (base neuve) puis semer catalogue et paniers prêts (`packages/db` : `seed`).
4. ⛔ `wrangler login` fait **par le porteur** (navigateur) ; ne jamais lui demander son jeton dans le chat. Premier déploiement en préversion `*.workers.dev`, vérification mobile/arabe/hors ligne.
5. ⛔ Données : tant que la collecte n'a pas réussi, l'application publique serait vide ; privilégier d'abord l'essai à blanc hmizate, puis l'exécution réelle, ou la saisie de relevés du porteur.
6. Afficher clairement « prix indicatifs, date et source affichées » ; ne pas publier tant que le porteur n'a pas validé.

## 8. Reste à faire (ordre recommandé)
1. Porteur : ajouter `SCRAPER_CONTACT=<contact dédié>` dans `C:\Users\anass\Desktop\projet\.env` (la ligne n'y était pas à la dernière vérification).
2. ⛔ Lancer l'essai à blanc (3 requêtes), lire le rapport, comparer à la copie locale `.cache/bim/…`.
3. ⛔ Activer la source et lancer 1 exécution réelle (1 article BIM) ; relire la file d'appariements incertains (`/admin/appariements`).
4. ⛔ Planification quotidienne (GitHub Actions `scrape.yml`) après succès ; un catalogue hebdomadaire exige une exécution par semaine.
5. Déploiement Cloudflare (section 7).
6. Plus tard : prix permanents (Marjane via Playwright, catalogues OCR), alertes de baisse, application mobile Expo (jamais clairement approuvée), tests sur PostgreSQL Neon réel, audit mobile/RTL/sombre des pages restantes.

## 9. Pièges connus
- Git Bash mutile les chemins du type `/api-proxy` (transformés en `C:/Program Files/Git/...`) : la valeur par défaut `API = "/api-proxy"` évite d'utiliser une variable d'environnement.
- Le volet de navigation intégré refuse les service workers : `public/sw.js` est testé dans un bac à sable Node.
- Les heredocs Bash contenant des apostrophes échouent : écrire les fichiers avec un outil d'écriture.
- Un ancien jeton d'administration en clair existe dans `start-api.bat` (le porteur s'en occupe) ; des identifiants ngrok ont été collés dans le chat et **doivent être révoqués**. Le tunnel ngrok du projet Chhal nécessite un second compte (`scripts\setup-ngrok-chhal.cmd`, saisie par le porteur).
- `docs/AUDIT-MVP.md` et `AUDIT-D4-CLAUDE.md` (écrits par un autre agent) sont périmés et inexacts (disent « hmizate activé », « 130 tests »).
- Licences : Open Food Facts (ODbL / photos CC BY-SA, partage à l'identique) — décision du porteur à prendre avant publication des photos.
