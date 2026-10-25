# Audit MVP — Projet Chhal (Comparateur de prix Maroc)

**Date :** octobre 2026
**Phase :** Étape A — Audit et plan d'implémentation

---

## 1. Objectif

Auditer le dépôt existant, comparer avec l'étude stratégique (`etude-comparateur-prix-maroc.md`), identifier les composants disponibles et manquants, et définir le premier incrément P0.

---

## 2. État du dépôt

### 2.1 Structure

Monorepo pnpm avec 3 apps et 5 packages :

| Composant | Chemin | Stack | Statut |
|---|---|---|---|
| API | `apps/api` | Fastify 5, Drizzle ORM, Zod 4 | ✅ Fonctionnel, 75 tests |
| Web | `apps/web` | Next.js 16, React 19 | ✅ Fonctionnel, 16 tests |
| Scraper | `apps/scraper` | cheerio, robots-parser | ✅ Fonctionnel, 7 tests (+ 6 nouveaux) |
| DB | `packages/db` | Drizzle ORM, PGlite/PostgreSQL | ✅ Schéma complet, migrations |
| Matching | `packages/matching` | TypeScript pur | ✅ 10 tests |
| Optimizer | `packages/optimizer` | TypeScript pur | ✅ 9 tests |
| Shared | `packages/shared` | Zod schemas | ✅ |
| i18n | `packages/i18n` | FR/AR/darija/EN | ✅ 4 tests |

### 2.2 Tests

| Package | Tests | Statut |
|---|---|---|
| matching | 10 | ✅ PASS |
| optimizer | 9 | ✅ PASS |
| i18n | 4 | ✅ PASS |
| web | 16 | ✅ PASS |
| scraper | 13 (7 + 6 nouveaux) | ✅ PASS |
| api | 75 | ✅ PASS |
| **Total** | **127** | **✅ ALL PASS** |

### 2.3 Schéma de base de données

Le schéma existant (`packages/db/src/schema.ts`) correspond au modèle de données recommandé par l'étude :

| Entité étude | Table existante | Correspondance |
|---|---|---|
| Product | `products` | ✅ (slug, nomNormalise, nomAffiche, marque, formatValeur, formatUnite, ean, categorie) |
| Retailer | `chains` | ✅ (slug, nom, nomAr, alias, logoUrl, actif) |
| Store | `stores` | ✅ (chainId, ville, adresse, lat, lng) |
| RetailerProduct | — | ⚠️ Pas de table dédiée ; le matching se fait à l'ingestion via `matchProduct()` |
| PriceObservation | `price_observations` | ✅ (productId, storeId, prixMad, prixUnitaireMad, dateReleve, source, confiance, testOnly) |
| Source | — | ⚠️ Pas de table `sources` ; les sources sont des enums (`sourceEnum`) |
| MatchCandidate | `match_candidates` | ✅ (libelleSource, chainId, productIdPropose, score, statut) |
| Cart | `carts` | ✅ (token, ville, params, items, result) |
| PresetBasket | `preset_baskets` | ✅ |

**Écarts mineurs avec l'étude :**
- Pas de table `sources` dédiée (les sources sont un enum).
- Pas de table `retailer_products` (le matching se fait à l'ingestion).
- Pas de table `promotions` avec dates de validité.
- Pas de table `raw_data` pour la conservation brute.
- Pas de table `import_jobs` ni `error_logs`.

**Décision :** Le schéma existant est fonctionnel et testé. Les tables manquantes (sources, raw_data, promotions, import_jobs, error_logs) sont des améliorations P1/P2. Le MVP peut fonctionner sans elles.

### 2.4 API

L'API Fastify expose les endpoints suivants :

| Catégorie | Endpoints | Statut |
|---|---|---|
| Référentiels | `/villes`, `/enseignes` | ✅ |
| Recherche | `/produits`, `/produits/:id/prix`, `/produits/:id/historique` | ✅ |
| Panier | `/paniers/optimiser`, `/paniers`, `/paniers/comparer`, `/paniers/:token` | ✅ |
| Rapports | `/rapports/panier`, `/paniers/:token/rapport`, `/produits/:id/rapport` | ✅ |
| Paniers prédéfinis | `/paniers-prets`, `/paniers-prets/:slug` | ✅ |
| Contributions | `/contributions` | ✅ |
| Admin | `/admin/en-attente`, `/admin/observations/:id/decision`, `/admin/observations`, `/admin/releves/import`, `/admin/produits`, `/admin/magasins`, `/admin/appariements`, `/admin/scraping/releves`, `/admin/ocr/suggestion` | ✅ |

### 2.5 Scraper

| Composant | Statut | Détail |
|---|---|---|
| Politesse (robots.txt, rate limiter, cache) | ✅ | `politeness.ts` — 7 tests |
| Adaptateur modèle | ✅ | `modele.ts` — gabarit + tests |
| Adaptateur hmizate | ✅ **NOUVEAU** | `hmizate.ts` — parsing texte structuré, 6 tests |
| Adaptateurs réels (Marjane, BIM, etc.) | ❌ | Aucun (sauf hmizate) |
| OCR | ⚠️ | Suggestion texte uniquement (`ocr.ts`) |

### 2.6 Matching

| Règle | Implémentée | Détail |
|---|---|---|
| EAN exact | ✅ | `matchProduct()` — confiance 1.0 |
| Marque + format + nom | ✅ | `matchProduct()` — score >= 0.999 → certain |
| Similarité textuelle | ⚠️ | Score partiel (0.3/0.3/0.4) → incertain si > 0.3 |
| Validation manuelle | ✅ | `match_candidates` + admin endpoint |
| Lots/packs | ⚠️ | `parseSizeHmizate()` gère les packs (×) mais pas de conversion automatique en unités |

---

## 3. Comparaison avec l'étude

### 3.1 Convergence

L'étude et le code existant sont largement alignés :
- Modèle de données : ✅ correspond
- Matching progressif : ✅ implémenté
- Connecteurs indépendants : ✅ architecture modulaire
- Traçabilité (source, date, confiance) : ✅
- Interface d'administration : ✅
- Tests : ✅ 127 tests verts
- Politesse (robots.txt, rate limiting, cache) : ✅

### 3.2 Écarts

| Point étude | État code | Écart |
|---|---|---|
| Source Marjane (P0) | ❌ Aucun adaptateur | Marjane est un SPA (JS-rendered) → cheerio ne suffit pas |
| Source midio.ma (P0) | ❌ Aucun adaptateur | Sert des images → nécessite OCR |
| Source Open Food Facts (P0) | ❌ Aucun connecteur | API non intégrée |
| Source Aswak Assalam (P1) | ❌ Aucun adaptateur | Site + e-commerce limité |
| Source BIM (P1) | ❌ Aucun adaptateur | Site simple, pas d'e-commerce |
| Données réelles | ⚠️ Partiel | Seul le beurre (5 prix) est réel ; le panier de 10 articles est fictif |
| Base PostgreSQL réelle | ⚠️ Non testé | Tout testé sur PGlite |
| OCR sur image | ❌ | Seul l'analyse de texte OCR existe |
| Table `sources` | ❌ | Pas de table dédiée |
| Table `raw_data` | ❌ | Pas de conservation brute |
| Table `promotions` | ❌ | Pas de gestion des promotions datées |

---

## 4. Blocages identifiés

### 4.1 Marjane (SPA)

**Problème :** Le site Marjane (marjane.ma) est une Single Page Application (SPA) rendue côté client. Le contenu produit (nom, prix, format) est chargé dynamiquement via JavaScript/XHR. Le HTML initial ne contient que la navigation et le footer. Cheerio (utilisé par le scraper) ne peut pas extraire les données.

**Options :**
1. **Headless browser (Playwright/Puppeteer)** — ajoute une dépendance lourde (~200 MB). Permettrait de scraper Marjane correctement.
2. **API interne** — Marjane utilise `api-ayaline.marjane.ma` pour le CMS. L'endpoint produit n'est pas documenté et retourne 403.
3. **Alternative : hmizate.ma** — contient des articles détaillant les promotions Marjane (texte structuré). ✅ **Implémenté.**

**Décision recommandée :** Ne pas implémenter de scraper Marjane pour le MVP (bloqué par la SPA). Utiliser hmizate.ma comme source de promotions pour Marjane et les autres enseignes.

### 4.2 midio.ma (images)

**Problème :** midio.ma sert des catalogues sous forme d'images (webp). L'extraction nécessite de l'OCR (Tesseract ou Google Vision).

**Options :**
1. **OCR Tesseract** (open source) — gratuit mais moins précis.
2. **Google Vision API** (payant) — plus précis mais coûteux.
3. **Alternative : hmizate.ma** — texte structuré, pas d'OCR nécessaire. ✅ **Implémenté.**

**Décision recommandée :** Reporter l'OCR à P1. Utiliser hmizate.ma pour le MVP.

### 4.3 Open Food Facts

**Problème :** L'API Open Food Facts est documentée et accessible, mais la couverture au Maroc n'a pas été vérifiée.

**Action :** Tester l'API avec des EAN de produits marocains pour évaluer la couverture.

---

## 5. Sources effectivement testées

| Source | URL testée | robots.txt | Contenu extractible | Résultat |
|---|---|---|---|---|
| hmizate.ma | https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1085 | ✅ Allow: / (sauf bots IA) | ✅ Texte structuré (HTML) | **24 produits extraits** avec format et prix |
| Marjane | https://www.marjane.ma/courses-en-ligne/... | ✅ Allow: / (sauf /wallet, /account) | ❌ SPA (JS-rendered) | Bloqué pour cheerio |
| midio.ma | https://midio.ma/catalogue/... | Non vérifié | ❌ Images (webp) | Nécessite OCR |

---

## 6. Premier incrément P0 implémenté

### 6.1 Adaptateur hmizate.ma

**Fichier créé :** `apps/scraper/src/adapters/hmizate.ts`

**Fonctionnalités :**
- Parsing de texte structuré (pattern "Nom format à prix DH")
- Gestion des packs (×) : "6 × 30 g" → 180 g
- Déduplication par libellé + prix + format
- Ignoration des éléments sans format lisible

**Fichier test créé :** `apps/scraper/tests/hmizate.test.ts` (6 tests)

**Résultat test réel :** 24 produits extraits de la page hmizate.ma (BIM, septembre 2026).

**Enregistrement dans run.ts :** L'adaptateur est ajouté à la liste ADAPTERS (désactivé par défaut, `enabled: false`).

### 6.2 Tests

| Test | Résultat |
|---|---|
| Extraction de relevés lisibles | ✅ PASS |
| Ignoration des éléments sans format | ✅ PASS |
| Déduplication | ✅ PASS |
| Extraction pack (6 × 30 g → 180 g) | ✅ PASS |
| Extraction prix entier | ✅ PASS |
| Test réel (24 produits) | ✅ PASS |

---

## 7. Rapport tests

| Package | TOTAL | PASS | FAIL | ERROR | BLOCKED | SKIPPED |
|---|---|---|---|---|---|---|
| matching | 10 | 10 | 0 | 0 | 0 | 0 |
| optimizer | 9 | 9 | 0 | 0 | 0 | 0 |
| i18n | 4 | 4 | 0 | 0 | 0 | 0 |
| web | 16 | 16 | 0 | 0 | 0 | 0 |
| scraper | 13 | 13 | 0 | 0 | 0 | 0 |
| api | 75 | 75 | 0 | 0 | 0 | 0 |
| **Total** | **127** | **127** | **0** | **0** | **0** | **0** |

---

## 8. Risques et sécurité

| Risque | Niveau | Mitigation |
|---|---|---|
| hmizate.ma CGU ne mentionnent pas d'interdiction d'extraction | Moyen | robots.txt autorise le crawl général. Mentions légales = privacy policy uniquement. Activation avec `enabled: true` uniquement après validation juridique. |
| Données de promotion, pas de prix permanent | Moyen | Les observations sont marquées `source: "scraping"` avec `confiance: "moyenne"`. La date de collecte est enregistrée. |
| Format pack (×) mal interprété | Faible | Testé avec 6 × 30 g → 180 g. |
| hmizate.ma peut changer sa structure HTML | Moyen | Connecteur indépendant. Monitoring + alertes. |
| Marjane bloqué (SPA) | Élevé | Documenté. Alternative hmizate.ma. |
| midio.ma bloqué (images) | Moyen | Reporter à P1 (OCR). |

---

## 9. Décisions nécessaires

1. **Juridique :** Valider l'extraction de hmizate.ma (robots.txt autorise, CGU ne mentionnent pas d'interdiction). Recommandation : consulter un juriste avant activation en production.
2. **Marjane :** Confirmer l'abandon du scraping direct (SPA) pour le MVP. Utiliser hmizate.ma comme source de promotions.
3. **Open Food Facts :** Tester la couverture au Maroc (EAN de produits marocains).
4. **Activation :** Passer `enabled: true` dans l'adaptateur hmizate après validation.

---

## 10. Reste à faire (P0)

| # | Tâche | Priorité |
|---|---|---|
| 1 | Tester l'API Open Food Facts avec des EAN marocains | P0 |
| 2 | Activer l'adaptateur hmizate (`enabled: true`) | P0 |
| 3 | Exécuter le scraping réel (`SCRAPE_CONFIRM=1`) | P0 |
| 4 | Vérifier l'ingestion des données via `/admin/scraping/releves` | P0 |
| 5 | Ajouter des produits canoniques correspondants dans la DB | P0 |
| 6 | Tester le matching end-to-end | P0 |
| 7 | Mettre à jour la documentation (README, .env) | P0 |

---

## 11. Prochaine étape proposée

**Étape B — Socle fonctionnel :**
- Intégrer Open Food Facts (API par EAN)
- Activer et tester le scraping hmizate.ma
- Ajouter des produits canoniques pour les 24 produits extraits
- Tester le matching end-to-end
- Vérifier que les données sont visibles dans l'interface web

---

## Fichiers créés ou modifiés

| Fichier | Action |
|---|---|
| `apps/scraper/src/adapters/hmizate.ts` | Créé — adaptateur hmizate.ma |
| `apps/scraper/tests/hmizate.test.ts` | Créé — 6 tests |
| `apps/scraper/fixtures/hmizate-bim.html` | Créé — fixture de test |
| `apps/scraper/src/run.ts` | Modifié — ajout de l'adaptateur hmizate |
| `docs/AUDIT-MVP.md` | Créé — rapport d'audit |

---

## Sources de données effectivement testées

| Source | URL | Résultat |
|---|---|---|
| hmizate.ma (BIM, sept. 2026) | https://hmizate.ma/deal/catalogue-bim-1-septembre-2026-n1085 | ✅ 24 produits extraits (format + prix) |
| Marjane (courses en ligne) | https://www.marjane.ma/courses-en-ligne/... | ❌ SPA (JS-rendered) — bloqué pour cheerio |
| midio.ma (catalogue Marjane) | https://midio.ma/catalogue/... | ❌ Images (webp) — nécessite OCR |
| hmizate.ma robots.txt | https://hmizate.ma/robots.txt | ✅ Allow: / (sauf bots IA) |
| hmizate.ma mentions légales | https://hmizate.ma/content/mention | ✅ Privacy policy (loi 09-08), pas d'interdiction d'extraction |
