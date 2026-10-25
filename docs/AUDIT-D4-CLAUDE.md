# Audit D4 — Vérification du travail antérieur (Claude / Anthropic)

**Date :** octobre 2026
**Phase :** Vérification obligatoire avant poursuite du développement

---

## 1. Objectif

Vérifier l'état réel de l'étape D4 et les travaux antérieurs attribués à Claude (Anthropic) dans le projet Chhal. Identifier les tâches réalisées, les recommandations émises, et les écarts entre les propositions et le code actuel.

---

## 2. Limites de l'audit

**Aucune trace de travail spécifique à Claude (Anthropic) n'a été trouvée dans le dépôt.**

Les éléments suivants ont été vérifiés et aucun ne mentionne Claude ou Anthropic :

| Élément vérifié | Résultat |
|---|---|
| Fichiers markdown à la racine | `etude-comparateur-prix-maroc.md` uniquement (étude stratégique, pas de mention Claude) |
| Dossier `docs/` | `RAPPORT-V1.md`, `RAPPORT-LOT1.md`, `RAPPORT-LOT2.md`, `PLAN-LOT2.md`, `AUDIT-MVP.md` — aucun ne mentionne Claude |
| Dossier `.github/workflows/` | `ci.yml`, `scrape.yml` — aucune référence à Claude |
| Code source (apps/, packages/) | Aucune référence à Claude ou Anthropic |
| Git | Pas de dépôt git (pas d'historique de commits) |
| Fichiers cachés | Aucun fichier `.claude/` ou similaire |

**Conclusion :** Le travail du projet a été réalisé avec OpenCode. Il n'y a pas de rapports, commits ou fichiers attribués à Claude. Les revues QA/Sécurité/DevOps mentionnées dans `RAPPORT-LOT1.md` et `RAPPORT-LOT2.md` ont été effectuées dans le cadre du développement OpenCode, pas par Claude.

---

## 3. Interprétation de "D4"

Le terme "D4" dans ce projet désigne un **défaut identifié lors de la revue QA du Lot 1**, et non une "étape D4" du développement.

| Référence | Source | Description |
|---|---|---|
| D4 (défaut) | `docs/RAPPORT-LOT1.md` ligne 27 | "Un prix à 3 décimales (79,999) est accepté puis arrondi à 80,00 sans avertissement." Gravité : Faible. |
| D4 (correction) | `docs/PLAN-LOT2.md` ligne 9 | "D4 : refuser plus de 2 décimales sur les prix." |
| D4 (correction) | `docs/RAPPORT-LOT2.md` ligne 9 | "D4 (2 décimales)" listé parmi les corrections. |
| D4 (test) | `apps/api/tests/qa-limites.test.ts` ligne 83 | "D4 corrigé : un prix à 3 décimales est refusé (400), 79.99 est accepté" |

Le D4 a été **corrigé et verrouillé par un test** dans le Lot 2. Ce n'est pas une "étape D4" du développement.

---

## 4. Travaux réalisés par OpenCode (résumé)

### 4.1 Lots précédents

| Lot | Document | Contenu | Tests |
|---|---|---|---|
| Lot 1 | `RAPPORT-LOT1.md` | Revue QA/Sécurité/DevOps. 3 défauts (D1-D3) + D4. 66 tests. | 66 PASS, 3 défauts documentés |
| Lot 2 | `RAPPORT-LOT2.md` | Corrections D1-D4, nouvelle interface, top 3, paniers prédéfinis. | 66 → 75+ tests |
| V1 | `RAPPORT-V1.md` | Rapport beta. 54 tests verts. | 54 PASS |

### 4.2 Travaux OpenCode (cette session)

| Étape | Contenu | Fichiers | Tests |
|---|---|---|---|
| Étude | Recherche stratégique (875 lignes) | `etude-comparateur-prix-maroc.md` | — |
| Étape A | Audit + adaptateur hmizate | `AUDIT-MVP.md`, `hmizate.ts`, `hmizate.test.ts` | +6 (scraper) |
| Étape B | Connecteur Open Food Facts | `openfoodfacts.ts`, `openfoodfacts.test.ts` | +3 (scraper) |
| Étape C | Seed chains + produits + scraping réel | `seed-chains-cli.ts`, `seed-hmizate.ts`, `seed-hmizate-cli.ts` | — |
| Étape D | Validation end-to-end | Vérification panier, prix, unités | — |

### 4.3 État actuel

| Métrique | Valeur |
|---|---|
| Tests totaux | 130 |
| Tests passants | 130 |
| Tests échoués | 0 |
| Enseignes avec données réelles | 1 (BIM) |
| Produits canoniques | 46 (20 BIM + 26 catalogue) |
| Prix publiés | 20 (BIM, Casablanca) |
| Adaptateurs scraper | 2 (modele désactivé, hmizate activé) |
| Connecteurs enrichissement | 1 (Open Food Facts) |

---

## 5. Recommandations de Claude

**Aucune recommandation de Claude n'a été trouvée.** Le projet ne contient aucune trace de travail avec Claude (Anthropic).

Les revues mentionnées dans les rapports (Lot 1, Lot 2) sont des revues QA/Sécurité/DevOps effectuées dans le cadre du développement OpenCode, pas par Claude.

---

## 6. Recommandations déjà appliquées et vérifiées

Les corrections suivantes ont été identifiées dans le Lot 1 et corrigées dans le Lot 2. Elles sont vérifiées par les tests :

| Défaut | Description | Correction | Test | Statut |
|---|---|---|---|---|
| D1 | Limiteur de contributions inopérant | Limiteur enregistré avant la route | `qa-limites.test.ts` | ✅ Corrigé et verrouillé |
| D2 | POST /paniers sans limite | Limite 20/heure | `qa-limites.test.ts` | ✅ Corrigé et verrouillé |
| D3 | POST /paniers/optimiser sans limite | Limite 60/minute | `qa-limites.test.ts` | ✅ Corrigé et verrouillé |
| D4 | Prix à 3 décimales accepté | Refus si > 2 décimales (400) | `qa-limites.test.ts` ligne 83 | ✅ Corrigé et verrouillé |
| S2 | trustProxy non configuré | Paramètre trustProxy ajouté | `qa-limites.test.ts` | ✅ Corrigé et verrouillé |
| S3 | CORS accepte toute origine | Refus si CORS_ORIGIN absent en production | `qa-limites.test.ts` | ✅ Corrigé et verrouillé |
| S5 | Pas d'en-têtes de sécurité | En-têtes ajoutés (nosniff, DENY, etc.) | `qa-limites.test.ts` | ✅ Corrigé et verrouillé |

---

## 7. Points restant à corriger ou à tester

| # | Point | Priorité | Statut |
|---|---|---|---|
| 1 | Étendre la couverture à d'autres enseignes (Marjane, Kazyon, Supeco via hmizate) | P0 | En attente |
| 2 | Extraire les marques des produits hmizate pour améliorer le matching | P0 | En attente |
| 3 | Connecter Open Food Facts pour l'enrichissement (couverture Maroc à vérifier) | P0 | En attente |
| 4 | Ajouter des produits canoniques pour les 4 produits non matchés | P1 | En attente |
| 5 | Tester le panier avec plusieurs enseignes | P1 | En attente |
| 6 | Tests sur PostgreSQL réel (Neon) | P1 | Non exécuté |
| 7 | Déploiement (Render/Vercel) et Turnstile | P2 | Non exécuté |
| 8 | OCR sur images (midio.ma) | P2 | Non implémenté |
| 9 | Base `sources`, `raw_data`, `promotions` | P2 | Non implémenté |

---

## 8. Backlog priorisé du MVP

### P0 — Indispensable

| # | Tâche | Statut |
|---|---|---|
| 1 | Étendre les catalogues hmizate (Marjane, Kazyon, Supeco) | En attente |
| 2 | Extraire les marques des produits hmizate | En attente |
| 3 | Connecter Open Food Facts (couverture Maroc) | En attente |
| 4 | Ajouter les produits canoniques manquants | En attente |
| 5 | Tester le panier multi-enseignes | En attente |

### P1 — Amélioration importante

| # | Tâche | Statut |
|---|---|---|
| 6 | Tests sur PostgreSQL réel | Non exécuté |
| 7 | Historique des prix (vue matérialisée) | Implémenté (API) |
| 8 | Recherche par code-barres (EAN) | Implémenté (API) |
| 9 | Alertes de baisse de prix | Non implémenté |

### P2 — Évolution ultérieure

| # | Tâche | Statut |
|---|---|---|
| 10 | Déploiement production | Non exécuté |
| 11 | OCR sur images (midio.ma) | Non implémenté |
| 12 | Tables `sources`, `raw_data`, `promotions` | Non implémenté |
| 13 | Application mobile | Non implémenté |

---

## 9. Écarts identifiés

Aucun écart n'a été identifié entre le travail OpenCode et les remarques des rapports existants. Les défauts D1-D4 ont été corrigés et verrouillés par des tests.

Les recommandations de l'étude (`etude-comparateur-prix-maroc.md`) sont en cours d'implémentation :
- ✅ Connecteurs indépendants (hmizate, Open Food Facts)
- ✅ Traçabilité (source, date, confiance)
- ✅ Interface d'administration
- ✅ Matching progressif
- ✅ Tests (130 verts)
- ⚠️ Open Food Facts (connecteur créé, couverture Maroc non vérifiée)
- ⚠️ Marjane (bloqué par SPA, alternative hmizate implémentée)
- ❌ midio.ma (images, OCR non implémenté)
- ❌ Tables `sources`, `raw_data`, `promotions` (non implémentées)

---

## 10. Conclusion

**Aucun travail spécifique à Claude (Anthropic) n'a été trouvé dans le dépôt.** Le projet a été développé avec OpenCode. Les revues QA/Sécurité/DevOps mentionnées dans les rapports (Lot 1, Lot 2) sont des revues internes au développement OpenCode.

Le D4 (défaut de 3 décimales) a été corrigé et verrouillé par un test. Les travaux OpenCode (Étapes A-D) ont produit un MVP fonctionnel avec des données réelles (BIM, 20 produits, Casablanca), 130 tests verts, et des connecteurs pour hmizate.ma et Open Food Facts.

**Prochaine action recommandée :** Étendre la couverture à d'autres enseignes via hmizate.ma (Marjane, Kazyon, Supeco) et améliorer le matching en extrayant les marques des produits.
