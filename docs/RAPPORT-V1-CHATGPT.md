> Etat du deploiement en ligne : lire docs/DEPLOIEMENT-EN-LIGNE-2026-10-26.md. Depot GitHub prive cree, sources et outils Cloudflare construits, job 40242013802 PASS. Connexions navigateur Cloudflare/Render a terminer ; aucune application publique.

> Actualisation du deploiement : lire docs/DEPLOIEMENT-PREVERSION-2026-10-25.md. Neon chhal-preview est initialise (0000-0007, 52 produits, 4 paniers, zero prix). Render/Cloudflare non deployes ; la base locale reste intacte.

# Chhal — livraison du scope V1
Date : 25 octobre 2026. Reprise ChatGPT après validation « go pour scope V1 proposé ».

**Verdict : code V1 développé, PASS WITH ACTIONS. L'activation sur la base existante et la publication ne sont pas réalisées.**

## 1. Périmètre et état

| Lot validé | Développement livré | Validation / limite |
|---|---|---|
| 1 — Fiabilité des prix | Règle commune de validité et fraîcheur, sélection avant classement, exclusion des promotions futures et à validité inconnue, métadonnées publiques de provenance | Tests API et moteurs ; base de test en mémoire |
| 2 — Alimentation | Ingestion tracée obligatoire, activation et origine de source contrôlées, correspondance des données brutes, transaction par lot, candidats complets et décision produisant une observation, doublons et concurrence | Tests en mémoire ; première collecte réelle encore bloquée par SCRAPER_CONTACT |
| 3 — Fonctions pratiques | Accueil offres actuelles et offres à venir séparées, filtres, recherche EAN, source cliquable et validité, favoris nommés locaux, checklist de courses, budget, partage daté et recalcul | Tests des règles locales et build ; recette visuelle bloquée par le navigateur intégré |
| 4 — Administration | Suivi des sources, jobs, couverture ville/enseigne, choix du produit avec format lors de la validation, recherche pour contributions et erreurs de décision affichées | API protégée testée ; interface compilée |
| 5 — Recette / publication | Tests locaux, vérifications TypeScript, build Next et contrôle de cohérence Drizzle | Workers, PostgreSQL Neon et recette navigateur réelle restent à valider |

La V1 conserve FR/ar/EN et les fonctions existantes : familles « n'importe quelle marque », comparaison de paniers 1/2/multi-magasins, historique et rapports imprimables. BIM reste prioritaire ; Carrefour est exclu de l'ingestion automatisée. Aucun compte, abonnement, OCR photo, caméra, GPS ou nouvelle dépendance ajouté.

## 2. Corrections principales

- `apps/api/src/prices.ts` choisit la dernière observation publiée **parmi les observations temporellement utilisables**, et non l'inverse. Une promotion future n'efface donc pas un prix actuel valide.
- La recherche, les fiches et rapports utilisent 30 jours de fraîcheur. Le panier garde sa limite d'âge configurable et explique les exclusions ; les moteurs refusent aussi les dates futures indépendamment de l'API.
- Une promotion de catalogue sans fin de validité connue/estimée est conservée dans l'historique mais exclue du classement actuel.
- La date métier de production utilise Africa/Casablanca. Les tests utilisent une date de référence explicite.
- L'API et les écrans affichent URL source, date de collecte et fin de validité, avec mention « estimée » lorsque nécessaire.
- Un EAN identique avec un format contradictoire exige désormais une validation humaine. Les tests historiques qui validaient 9 g contre 1 kg ont été corrigés et un test de non-fusion a été ajouté.
- L'API `/admin/scraping/releves` exige la traçabilité. Une source inactive, une URL extérieure à cette source, une donnée brute incohérente ou un lot invalide empêchent l'écriture.
- Les lignes incertaines conservent le relevé complet et sa provenance. L'administrateur choisit le produit correspondant ; le format doit être compatible. La validation est transactionnelle et ne publie qu'une fois.
- Une clé unique protège l'ingestion simultanée. Lorsqu'un prix équivalent existe, le candidat est rattaché à cette observation sans duplication. Un relevé déjà rejeté ne se republie pas implicitement.
- Un ancien candidat sans payload reste visible ; il doit être réimporté avant publication. Aucune donnée ancienne n'a été inventée pour le compléter.
- La contribution peut rechercher un produit au lieu de dépendre des 50 premières fiches. Les validations de l'interface remontent leurs erreurs et empêchent les doubles actions en cours.
- Un panier partagé reste un instantané. Le recalcul est distinct et ne réécrit pas l'instantané.
- Les réponses API hors ligne sont horodatées, explicitement marquées et limitées à six heures et au même jour au Maroc. Une fin de validité dépassée est refusée. Les anciens caches v1 sont évacués par la version v2. Les prix périmés restent accessibles par l'historique en ligne, sans être réutilisés comme prix actuels.
- Les favoris stockent les compositions sur l'appareil ; la liste de courses mémorise les articles cochés pour le plan affiché. Le budget précise lorsque le total est partiel.

## 3. Migration 0007 — préparée, NON appliquée à la base existante

Fichiers : `packages/db/drizzle/0007_v1_validation.sql`, son snapshot et le journal Drizzle.

Ajouts uniquement :
- `match_candidates.payload` : relevé, trace, magasin et clé d'ingestion.
- `match_candidates.ingestion_key` : unicité des candidats importés.
- `match_candidates.observation_id` : lien vers le prix publié.
- `price_observations.ingestion_key` : unicité de la publication.

Les triggers append-only et l'historique restent en place. Aucun ancien prix n'est modifié, supprimé ou fabriqué par cette migration.

**L'API V1 refuse de démarrer sur une base existante non migrée**, avec une explication. Elle ne déclenche plus de migration ou de reset automatique sur cette base. Une nouvelle base locale reçoit uniquement les références, sans prix de démonstration. Le chemin PGlite est fixé à `.data/dev` à la racine, même lorsque le serveur est lancé depuis `apps/api`.

La CLI de migration exige maintenant `--confirm` avant d'ouvrir la base. Son refus sans ce drapeau a été vérifié.

### Activation locale, après arrêt de l'API, sauvegarde et validation explicite

Vérifier d'abord que DATABASE_URL ne vise pas une autre base. Si DATABASE_URL est absent, la cible locale est `.data/dev` à la racine. Ne pas effectuer de sauvegarde de fichiers d'une base ouverte.

Depuis la racine du projet, après arrêt de l'API, exemple PowerShell de sauvegarde locale :

~~~powershell
$backupPath = Join-Path (Get-Location) (".data/avant-v1-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
Copy-Item -LiteralPath .data/dev -Destination $backupPath -Recurse
~~~

Vérifier la présence et l'intégrité de cette sauvegarde avant la migration. Pour PostgreSQL, utiliser une sauvegarde PostgreSQL adaptée ; ne pas copier des fichiers PGlite.

Commande **préparée, non exécutée sur la base existante**, après validation de la cible :

~~~powershell
node packages/db/node_modules/tsx/dist/cli.mjs --env-file=.env packages/db/src/migrate.ts --confirm
~~~

Puis relancer `start-api.bat`. Le lanceur utilise uniquement les valeurs de `.env` ; aucun secret n'est inscrit dans le code.

Pour une nouvelle base distante, appliquer les migrations séparément, puis utiliser `seed-reference-cli.ts --confirm` uniquement pour les références. Ne pas utiliser le seed de fixtures.

## 4. Tests et contrôles

Résultats finaux à lire avec la passation courte `docs/PASSATION-CLAUDE-V1.md`.

| Contrôle | Résultat attendu dans la livraison vérifiée |
|---|---:|
| Matching | 11 PASS |
| Optimiseur | 10 PASS |
| i18n | 4 PASS |
| Web | 40 PASS |
| Scraper hors réseau | 90 PASS |
| API | 200 PASS |
| Diagnostic natif Node | 3 PASS |
| **Total local** | **358 PASS** |
| Tests Open Food Facts réels | 3 SKIPPED par défaut |
| TypeScript API / web / scraper | PASS |
| Build Next.js de production | PASS |
| Cohérence des migrations Drizzle | PASS |

Les tests fonctionnels utilisent PGlite en mémoire. Ils ne prouvent pas le fonctionnement sur Neon ou sur Workers. Le nombre de tests n'est pas présenté comme une recette utilisateur complète.

Commandes :

~~~powershell
node scripts/test-offline.mjs
node scripts/preflight.mjs
~~~

Dans `apps/api`, `apps/scraper` et `apps/web` :

~~~powershell
node node_modules/typescript/bin/tsc --noEmit
~~~

Dans `apps/web` :

~~~powershell
node node_modules/next/dist/bin/next build
~~~

Dans `packages/db` :

~~~powershell
node node_modules/drizzle-kit/bin.cjs check
~~~

Le diagnostic retourne volontairement un code non nul lorsque les prérequis de collecte/déploiement manquent.

Une API et un web temporaires ont été démarrés sur 3311/3309 avec une base mémoire et des fixtures uniquement pour tenter la recette visuelle. Le navigateur intégré n'a pas pu ouvrir sa route ; aucune validation visuelle n'est revendiquée. Ces deux processus ont été arrêtés. Le service worker est testé dans un bac à sable Node ; le téléphone réel reste à tester.

## 5. Collecte et automatisation

Le collecteur hmizate conserve le plafond initial de trois requêtes et l'essai à blanc par défaut. Les redirections HTTP ne sont pas suivies, un délai réseau est imposé, l'URL de liste doit appartenir à hmizate en HTTPS sans identifiants. Les protections robots.txt, 403/429/503 et anti-robot restent en place.

La CLI journalise un blocage dans l'API uniquement en mode réel confirmé. Les erreurs de collecte ou d'import donnent un code de sortie non nul.

Le workflow historique a été remplacé par le collecteur v2, en lancement **manuel uniquement**, mode essai par défaut. Il exige `CHHAL_COLLECTE_APPROUVEE=1`. Le mode réel exige aussi `SCRAPE_CONFIRM=1`, la source activée côté API et les secrets configurés. Aucun cron n'est activé. Le premier succès réel et l'accord du porteur restent requis avant planification quotidienne.

Aucune requête hmizate n'a été exécutée pendant cette livraison. SCRAPER_CONTACT est toujours absent. Le porteur doit choisir un courriel dédié ou une URL publique de contact et le renseigner localement.

## 6. Points restant bloqués

1. Validation et application de la migration 0007 sur la base existante, après sauvegarde.
2. SCRAPER_CONTACT et premier essai à blanc hmizate, puis import réel distinct après lecture du rapport.
3. Outils OpenNext/Wrangler absents ; accès npm indisponible dans cette session. Les dépendances étaient déjà approuvées, mais ne sont pas installées et le lockfile n'a pas été modifié artificiellement.
4. Aucune base Neon ni API distante configurée. Aucun test PostgreSQL réel réalisé.
5. Recette visuelle mobile, RTL, administration, partage, favoris et véritable service worker à faire dans un navigateur disponible.
6. Aucun dépôt Git distant pour Chhal. Aucun git init, commit ou push effectué.
7. La publication demeure une étape distincte. Aucun compte distant ni service public n'a été créé.

Ces blocages ne nécessitent pas de recommencer le développement. Conserver le code, lire les rapports, terminer l'activation et la recette.

## 7. Documentation

- Cette livraison : `docs/RAPPORT-V1-CHATGPT.md`.
- Passation courte pour Claude : `docs/PASSATION-CLAUDE-V1.md`.
- Historique de reprise : `docs/REPRISE-CHATGPT-2026-10-25.md`.
- Décisions d'origine : `docs/PASSATION-CHATGPT.md`, `docs/PLAN-HMIZATE.md`, `docs/PLAN-CLOUDFLARE.md`.

Le fichier `apps/web/AGENTS.md` a été généré par Next.js lors du lancement de développement. Il renvoie vers la documentation locale de la version installée. Ne pas confondre les anciens rapports (130, 247 ou 297 tests) avec l'état de cette livraison.
