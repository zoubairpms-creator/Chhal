> Mise a jour ChatGPT du 25/10/2026 : lire docs/REPRISE-CHATGPT-2026-10-25.md pour le dernier etat (332 tests locaux PASS, proxy runtime, preparation du deploiement). Le texte ci-dessous conserve le contexte precedent ; installation Cloudflare et collecte restent bloquees.

# Plan — Mise en ligne sur Cloudflare Workers

Statut : **à approuver par écrit. Aucun code, aucune installation, aucun déploiement avant validation.** Rédigé le 2026-10-25.

## 1. L'application est-elle « opérationnelle » ? (état vérifié)
- Fonctionnel : recherche, familles, paniers, optimiseur, rapports, PWA, FR/ar/EN. 247 tests verts (dernier relevé).
- **Données réelles : 20 prix BIM du 2026-09-01, soit 54 jours** (seuil de fraîcheur : 30 jours). En mode production (sans `ALLOW_TEST_DATA`), un visiteur verrait donc **peu ou pas de prix valides**.
- Aucune collecte automatique active ; plan hmizate toujours en attente.
- Base de production Neon : jamais testée. Les serveurs locaux sont actuellement arrêtés.
Verdict : **bêta techniquement déployable, mais vide de prix frais.** Un lien public montrerait une application sans résultats, ce qui est précisément votre critique initiale.

## 2. Architecture cible (limites techniques)
| Brique | Aujourd'hui | Sur Cloudflare |
|---|---|---|
| Web Next.js 16 | Node | Worker via l'adaptateur `@opennextjs/cloudflare` (compatibilité Next 16 à vérifier) |
| API Fastify 5 | Node + PGlite fichier | **Fastify ne tourne pas nativement sur Workers** et PGlite fichier n'existe pas. Option A : réécrire les routes en Hono (Worker) + Neon via driver HTTP. Option B : garder Fastify sur un hébergeur Node gratuit (Render) et ne mettre que le web sur Cloudflare |
| Base | PGlite dev | Neon PostgreSQL (migrations 0000–0005 à appliquer, sauvegarde non applicable : base neuve) |
| Proxy `/api-proxy` | rewrite Next | Binding de service ou URL de l'API |

Recommandation : **Option A** si vous voulez tout sur Cloudflare (travail plus long, mais un seul fournisseur), **Option B** pour aller vite.

## 3. Prérequis de votre côté (je n'entre jamais de jeton)
1. Compte Cloudflare gratuit ; vous lancez `wrangler login` vous-même (navigateur).
2. Chaîne de connexion Neon (dans `.env`, que vous créez) ; `ADMIN_TOKEN` fort ; `CORS_ORIGIN` = l'URL finale.
3. Décision sur les données à publier : sans prix frais, soit saisie de vos relevés, soit hmizate (plan séparé).

## 4. Phases (⛔ = arrêt pour votre accord)
1. ⛔ Ajout des dépendances (`@opennextjs/cloudflare`, `wrangler`, + `hono` si option A) et de `wrangler.jsonc`.
2. Tests d'abord : routes API identiques (suite existante rejouée sur la nouvelle couche), build Workers local (`wrangler dev`).
3. ⛔ Migrations sur Neon (base neuve) et import du catalogue/paniers prêts.
4. ⛔ Premier déploiement en **préversion** (URL `*.workers.dev`), `ALLOW_TEST_DATA` désactivé, vérification en mobile/arabe/hors ligne.
5. ⛔ Passage en lien « officiel » et import des prix (relevés ou hmizate).

## 5. Garde-fous
Production sans données de test ; en-têtes de sécurité, limitation de débit (via règles Cloudflare ou `@fastify/rate-limit` équivalent), CORS strict, jeton admin hors dépôt, aucune donnée personnelle, mention « prix indicatifs, date et source affichées ».

## 6. Décisions demandées
1. Option A (tout Workers) ou B (web Workers + API Node gratuite) ?
2. Accord pour ajouter les dépendances listées.
3. Données au lancement : publier même vides/périmées, attendre vos relevés, ou lancer d'abord le plan hmizate ?
4. Nom/domaine : `*.workers.dev` gratuit suffit-il ?
