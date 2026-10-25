# Rapport Lot 1 — Revue QA, Sécurité, DevOps de la v1

Date : 2026-10-17. Verdict : **PASS WITH ACTIONS**.

## Fichiers touchés
- Ajouté : `apps/api/tests/qa-limites.test.ts` (15 tests de cas limites). Aucun code applicatif modifié (QA signale, ne corrige pas).

## Résultats des tests (exécutés)
| Suite | Résultat |
|---|---|
| matching | 10 PASS |
| optimizer | 9 PASS |
| i18n | 4 PASS |
| scraper | 7 PASS |
| web | 3 PASS |
| api | 33 PASS + 3 échecs attendus (défauts connus, `it.fails`) = 36 |
| Total | 66 PASS, 3 défauts documentés |

## QA — constats
Cas limites validés : JSON malformé (4xx), identifiant non numérique (400), `maxMagasins`/quantités/51 articles invalides (400), ville inconnue (404), injection SQL dans ville et recherche (aucune fuite, aucune erreur serveur), requête de 10 000 caractères, articles en double (quantités cumulées), tous articles sans prix (plan vide), âge maximum, décisions invalides, jetons admin de longueur différente.

| Id | Défaut | Gravité |
|---|---|---|
| D1 | **La limite d'envoi des contributions (10/heure) ne fonctionne pas** : le limiteur est enregistré de façon asynchrone après la déclaration de la route, donc la route n'est pas protégée. Le rapport v1 annonçait cette protection sans l'avoir testée : c'était inexact. | Élevée |
| D2 | `POST /paniers` (écriture publique) sans limite de débit : risque de remplissage de la base. | Moyenne |
| D3 | `POST /paniers/optimiser` (calcul) sans limite de débit. | Moyenne |
| D4 | Un prix à 3 décimales (79,999) est accepté puis arrondi à 80,00 sans avertissement. | Faible |

## Sécurité — constats
- Aucun secret dans le code ; `.env` ignoré par git ; aucun secret dans les journaux (les `console.*` n'impriment ni jeton ni URL de base).
- Jeton admin comparé en temps constant ; routes admin fermées sans jeton (401) ou sans configuration (503).
- Dépendances : 1 vulnérabilité modérée (`esbuild` ≤ 0.24.2 via `drizzle-kit`), outil de développement uniquement, absente du code exécuté en production.

| Id | Constat | Gravité |
|---|---|---|
| S1 | = D1 : la protection anti-abus annoncée est inopérante. | Élevée |
| S2 | `trustProxy` non configuré : derrière Render ou Vercel, tous les visiteurs auraient la même IP pour le limiteur. | Moyenne |
| S3 | CORS : si `CORS_ORIGIN` est absent, toute origine est acceptée. À fixer en production. | Moyenne |
| S4 | Turnstile (anti-robot) non branché sur les contributions. | Moyenne |
| S5 | Aucun en-tête de sécurité (CSP, HSTS, etc.) sur le web ni l'API. | Moyenne |
| S6 | Vulnérabilité `esbuild` de développement (voir ci-dessus). | Faible |

## DevOps — état
- Pas de `.env` : Neon jamais connecté. **Chemin PostgreSQL réel non exécuté.**
- Pas de dépôt git, pas de sauvegarde, pas d'environnement QA ni production, rien de déployé.
- Migrations : 3 fichiers, rejouées avec succès sur PGlite uniquement.

## Décisions et points ouverts
- Les défauts D1 à D3 sont consignés dans les tests (`it.fails`) ; ils passent en rouge dès qu'ils sont corrigés, ce qui force à retirer la marque.
- Correction à planifier en tête du Lot 2 (approbation requise, voir `PLAN-LOT2.md`).
- Reste à faire : `.env` Neon, tests sur PostgreSQL réel.

## Prochaine étape
Approuver le plan du Lot 2 (corrections D1 à D4, nouvelle interface, top 3, paniers prédéfinis).
