# Chhal — reprise ChatGPT du 25 octobre 2026

**Verdict : PASS WITH ACTIONS pour le lot local ; déploiement public BLOCKED.**

## Contexte et décisions conservées

Application indépendante de PROCURA ERP : comparateur de prix de supermarchés marocains, prix datés et sourcés, prix au kg/L/pièce, familles, paniers optimisés, FR/ar/EN et PWA. Reprise depuis l'historique demandé et la passation de Claude `docs/PASSATION-CHATGPT.md`.

BIM prioritaire, Carrefour exclu de la collecte, hmizate accepté sous la responsabilité du porteur le 18/10/2026, validité estimée à début + 7 jours. Architecture approuvée : web Workers avec OpenNext, API Node sur offre gratuite, PostgreSQL Neon. Aucun autre choix commercial ni fournisseur n'a été substitué.

Les règles d'arrêt de la passation restent applicables : pas de scraping réel, migration sur une base existante, import réel, publication ni commit/push sans l'accord correspondant. Les dépendances OpenNext/Wrangler étaient déjà approuvées ; leur installation reste techniquement bloquée.

## Ce qui a été développé

- Route serveur `apps/web/app/api-proxy/[...path]/route.ts`, destinée à fonctionner sur Node et OpenNext Workers. Elle remplace le rewrite externe de Next et lit `API_INTERNAL_URL` au runtime. Le navigateur garde `/api-proxy`.
- Transport testé : méthodes et JSON, recherche, jeton Bearer fourni par le navigateur, statuts 401/429, Retry-After, délai de 60 s, taille maximale 1 Mio lue par morceaux. Pas de cookies ni de jeton administrateur ajouté par le serveur. Les redirections de l'API sont refusées ; les erreurs restent génériques. HTTP reste permis en développement ; HTTPS et une origine fixe sont exigés en production.
- Pour Workers seulement, `CHHAL_CLOUDFLARE=1` permet de relayer l'adresse `CF-Connecting-IP` fournie par Cloudflare au limiteur de l'API. Aucun `X-Forwarded-For` arbitraire du navigateur n'est repris. La chaîne de proxy complète devra être vérifiée au déploiement.
- Configuration API de production : PostgreSQL obligatoire, origine CORS HTTPS exacte, jeton d'au moins 32 caractères, port valide, refus des données de test.
- Plus de migration automatique au démarrage de production. `/ready` vérifie la vue de prix et son schéma 0006 ; réponse 503 si la base ou le schéma manque. `/health` reste le contrôle du processus. Fermeture de la connexion à l'arrêt.
- `packages/db/src/seed-reference.ts` et sa CLI : catalogue générique, paniers prédéfinis manquants, BIM Casablanca et source hmizate inactive avec la décision déjà consignée. Aucun prix, fixture, effacement ou modification de panier personnalisé. Une transaction et des tests vérifient l'idempotence et la conservation des observations existantes.
- L'ancien seed de fixtures est interdit pour une URL PostgreSQL et en production ; en PGlite local, il exige désormais `--reset-dev`. **Ne pas l'utiliser pour préparer Neon.**
- `start-api.bat` lit désormais `.env` : le jeton auparavant codé en dur a été retiré de ce lanceur. Cela ne révoque pas un secret qui aurait été exposé auparavant.
- `scripts/test-offline.mjs` lance les tests avec les dépendances locales, sans télécharger pnpm. Il force une base de test en mémoire. Les anciens tests Open Food Facts dépendant d'Internet ont été conservés en tests `*.live.test.ts` avec opt-in `RUN_NETWORK_TESTS=1`. Les tests de contrat de l'adaptateur utilisent des réponses simulées identifiées comme telles.
- `scripts/preflight.mjs` vérifie les prérequis sans accès réseau, écriture ni affichage des valeurs sensibles. Ce diagnostic ne constitue jamais une validation de déploiement.
- Préparation Cloudflare/Render : `wrangler.jsonc`, modèle `open-next.config.ts.example`, modèle de variables locales, `render.yaml`, script de finalisation `setup-cloudflare.mjs`. Les sorties Workers, variables privées et fichiers locaux sont ignorés par Git.

## Vérifications réalisées

| Vérification | Résultat |
|---|---:|
| Matching | 10 PASS |
| Optimiseur | 9 PASS |
| i18n | 4 PASS |
| Web, dont 13 tests du proxy | 33 PASS |
| Scraper hors réseau | 90 PASS |
| API, dont configuration, initialisation et disponibilité | 183 PASS |
| Diagnostic natif Node | 3 PASS |
| **Total local** | **332 PASS, 0 échec** |
| Tests Open Food Facts en direct | 3 SKIPPED par défaut |
| TypeScript API / scraper / web | PASS |
| Build Next.js de production | PASS — route /api-proxy présente |
| Démarrage Next de production sur un port temporaire | Processus prêt, puis arrêté |
| Vérification HTTP locale / navigateur | BLOCKED — fetch loopback refusé EACCES |
| Build OpenNext / Wrangler / taille du Worker | BLOCKED — outils non installés |
| PostgreSQL Neon réel | NON EXÉCUTÉ |

Première relance de la suite historique : 294 PASS et 3 erreurs DNS Open Food Facts. Ces trois tests ont ensuite été isolés explicitement des tests locaux ; aucune réussite réseau n'est revendiquée.

Commandes de validation depuis la racine :

~~~powershell
node scripts/test-offline.mjs
node scripts/preflight.mjs
~~~

Le diagnostic termine volontairement avec un code non nul lorsque des prérequis manquent.

Typecheck : dans chaque dossier `apps/api`, `apps/scraper`, `apps/web` :

~~~powershell
node node_modules/typescript/bin/tsc --noEmit
~~~

Build web : depuis `apps/web` :

~~~powershell
node node_modules/next/dist/bin/next build
~~~

Aucune commande d'import ou de migration n'a été exécutée sur la base de développement existante. Les migrations des tests s'exécutent en mémoire. Aucun scraping hmizate, aucun déploiement, aucun compte distant créé, aucun commit/push. Le tunnel d'un autre projet n'a pas été utilisé.

## Blocages réels

1. **SCRAPER_CONTACT est toujours absent de .env.** Le porteur doit renseigner un contact public dédié (courriel dédié ou URL), pas une adresse personnelle choisie par l'agent. Il apparaîtra dans le User-Agent.
2. L'environnement de cette session refuse l'accès au registre npm : `corepack pnpm` essaie de récupérer pnpm 12.14.0 et échoue avec `ENOTFOUND registry.npmjs.org`. Les paquets OpenNext et Wrangler ne sont pas présents ; aucune dépendance ni version n'a été ajoutée manuellement au lockfile.
3. Aucun `DATABASE_URL` de production ni service API distant n'a été fourni. La base Neon n'est pas initialisée.
4. Les 20 prix BIM demeurent expirés selon la passation de Claude. Aucun nouveau prix n'a été collecté. Leur présence actuelle n'a pas été réauditée par une lecture directe de la base.
5. La session interdit aussi les requêtes HTTP de contrôle vers localhost. Le build et les tests en mémoire ne remplacent pas une recette dans le navigateur.

## Reprise conseillée — commandes préparées, pas exécutées

### Contact et premier essai à blanc

Ajouter dans le `.env` racine, par le porteur :

~~~dotenv
SCRAPER_CONTACT=<contact public dédié choisi par le porteur>
~~~

Après configuration et dans le périmètre du premier accès réseau validé (3 requêtes maximum), depuis le dossier apps/scraper :

~~~powershell
node node_modules/tsx/dist/cli.mjs src/hmizate-cli.ts
~~~

Alternative habituelle avec pnpm disponible :

~~~powershell
corepack pnpm --filter @chhal/scraper hmizate
~~~

Essai à blanc par défaut, sans `--confirm` ni `SCRAPE_CONFIRM=1`. Le premier essai réel et l'activation de la source restent des étapes distinctes à valider après lecture du rapport. Ne pas planifier la collecte avant un premier succès. Le workflow historique n'a pas été modifié.

### Finalisation Cloudflare sur un poste avec accès npm

Depuis la racine :

~~~powershell
corepack pnpm --filter @chhal/web add -D @opennextjs/cloudflare wrangler
node scripts/setup-cloudflare.mjs
corepack pnpm --filter @chhal/web build:worker
~~~

Le script copie le modèle en `open-next.config.ts` seulement après détection des outils, ajoute les scripts de build et de prévisualisation, n'écrase pas une configuration existante et ne publie rien. Les versions effectivement installées devront être consignées dans le lockfile puis la suite rejouée. Ne pas déclarer le Worker validé avant un build et une prévisualisation effectifs ; vérifier sa taille pour l'offre gratuite.

La variable serveur `API_INTERNAL_URL` doit désigner l'origine HTTPS réelle de l'API. La renseigner dans les variables runtime Workers ; garder `NEXT_PUBLIC_API_URL` absent pour conserver la même origine. `CHHAL_CLOUDFLARE=1` est prévu uniquement pour le Worker. Les variables runtime configurées au tableau de bord doivent être préservées avec l'option `--keep-vars` lors d'un futur déploiement approuvé.

Le modèle `.dev.vars.example` est un exemple local sans secret ; la documentation OpenNext recommande les fichiers `.env` Next pour partager les variables entre `next dev` et la prévisualisation Worker. Ne jamais copier le `.env` API contenant ADMIN_TOKEN dans le web.

`wrangler login` reste à exécuter par le porteur dans son navigateur. Aucun jeton n'est demandé dans le chat.

### API Node et Neon — après accord sur la cible

`render.yaml` est une préparation, pas un service déployé. Il utilise l'offre free et désactive les déploiements automatiques. Il exige un dépôt Git distant, actuellement absent ; ne pas créer de dépôt/commit/push implicitement. L'installation conserve les dépendances de développement car le serveur et les packages workspace utilisent le chargeur TypeScript `tsx` déjà présent.

Variables API : `NODE_ENV=production`, `DATABASE_URL` Neon avec TLS, `ADMIN_TOKEN` externe suffisamment long, `CORS_ORIGIN` = origine HTTPS finale exacte sans slash final, `TRUST_PROXY=1`. Omettre `ALLOW_TEST_DATA`. Ne jamais les coller dans le chat.

Appliquer séparément les migrations 0000–0006 sur la base cible après validation et sauvegarde si elle existe. Puis seulement, pour initialiser les références sans prix, en ayant fourni DATABASE_URL dans l'environnement du processus :

~~~powershell
node packages/db/node_modules/tsx/dist/cli.mjs packages/db/src/seed-reference-cli.ts --confirm
~~~

Cette commande est préparée mais non exécutée. Elle n'applique pas de migration. L'ancienne commande `db:seed` charge des fixtures et ne convient pas.

Vérifier `/ready`, l'accès à la base et la chaîne d'adresses client avant publication. Tester FR/ar/EN, RTL, mobile, administration, erreurs de démarrage à froid et hors ligne dans un navigateur réel. Ne pas publier un comparateur présenté comme alimenté tant que le flux de prix frais n'a pas abouti.

## Références techniques consultées le 25/10/2026

- [OpenNext — versions et fonctions prises en charge](https://opennext.js.org/cloudflare)
- [OpenNext — installation pour une application existante](https://opennext.js.org/cloudflare/get-started)
- [OpenNext — variables d'environnement](https://opennext.js.org/cloudflare/howtos/env-vars)
- [Render — Blueprint](https://render.com/docs/blueprint-spec)
- [Render — offres gratuites et limites](https://render.com/docs/free)

La documentation OpenNext annonce la prise en charge de Next 16 ; cela ne prouve pas la compatibilité du bundle de Chhal tant que son build Worker n'a pas été exécuté. La configuration garde le choix OpenNext déjà approuvé. Render gratuit peut se mettre en veille : prévoir un message d'attente et vérifier les limites avant usage public.
