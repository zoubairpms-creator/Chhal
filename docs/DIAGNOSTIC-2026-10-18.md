# Diagnostic du projet Chhal — 2026-10-18

Audit en **lecture seule** : aucun fichier du dépôt modifié, aucune source externe contactée, aucune base modifiée. Seuls ce rapport et des scripts d'audit hors dépôt ont été écrits.

## Pourquoi « il n'y a pas de résultat »
Trois causes vérifiées :
1. **La seule donnée réelle de la base utilisée par l'API tient en 20 prix BIM**, relevés du **2026-09-01**, soit **47 jours** au 2026-10-18. La règle de fraîcheur par défaut (30 jours) les écarte : paniers et recherches répondent « aucun prix récent ».
2. **Aucune collecte automatique n'est active** : 0 adaptateur activé (hmizate et le modèle sont à `enabled: false`), le workflow `scrape.yml` n'est pas déployé et exige `SCRAPE_CONFIRM`. Marjane est une application rendue par JavaScript (non lisible avec le scraper actuel) ; midio.ma sert des images (OCR non implémenté).
3. **Les 5 prix réels du beurre que vous avez fournis ne sont pas dans la base utilisée par l'API** (`.data/dev` à la racine). D'après l'historique de la session, ils sont dans l'ancienne base `apps/api/.data/dev` (non rouverte pour cet audit).

## 1. Objectif
Un comparateur de prix marocain **fiable et traçable** : rechercher un produit, comparer entre enseignes, panier comparatif, prix unitaire, date et source de chaque prix, éviter les comparaisons trompeuses et les données périmées, ajouter des sources sans réécrire le cœur.

## 2. Étude (`etude-comparateur-prix-maroc.md`, lue en entier : 875 lignes, 14 sections)
**Conclusions** : aucune API publique documentée chez les enseignes ; données fragmentées. MVP recommandé sur trois sources : **Marjane** (site de courses en ligne, P0, par navigateur automatisé), **une plateforme de catalogues** (midio.ma ou catalogue.ijob.ma, P0, images donc OCR) et **Open Food Facts** (enrichissement, sans prix, licence ODbL). **Carrefour exclu de l'extraction directe** (CGU interdisant robots et usage commercial des prix). Aswak et BIM en P1 ; Atacadão, Kazyon, Supeco en P2 (sites inexistants ou en construction).
**Modèle proposé** : `retailer_products`, `price_observations` (prix, prix normal, prix promo, `observed_at`, `valid_from`, `valid_until`, `source_type`, `verification_status`), `raw_data`, `sources`, `promotions`, `import_jobs`, `error_logs`, `matching_rules`.
**Matching** : EAN (1,0) → marque + référence (0,95) → nom + format (0,85) → similarité (validation manuelle sous 0,9) ; règles de non-fusion (packs, marques, prix au kg et à l'unité).
**Incertitudes déclarées** : EAN chez Marjane ? prix sur le site BIM ? JSON dans midio/ijob ? couverture Maroc d'Open Food Facts ? endpoint Bringo ?
**Décisions listées** : validation juridique, ville pilote, licence Open Food Facts, OCR, hébergement, modèle économique.
**Limites** : les URL et les CGU y sont « vérifiées en octobre 2026 » par l'auteur ; **je ne les ai pas revérifiées** (aucune requête externe dans cet audit). Les affirmations juridiques (CGU de Carrefour, absence de CGU d'extraction chez Marjane) ne sont pas une validation juridique.

## 3. État réel
| Domaine | État |
|---|---|
| Application web (3000) et API (3001) | Fonctionnelles ; lancées par cette session |
| Recherche, famille, top 3, prix au kg/L, panier, 3 scénarios, rapports PDF, hors ligne | Fonctionnent (tests) |
| Catalogue | 52 produits génériques + 20 produits BIM ; 61 familles ; aucune marque (`marque` vide) sur les produits de base |
| Collecte web | **Aucune active** : adaptateurs hmizate et modèle désactivés ; Open Food Facts : proposition de catalogue générée, **rien importé** |
| Marjane, midio, Aswak, BIM (site), Kazyon, Atacadão, Supeco, Carrefour | Aucun connecteur |
| Matching | EAN et marque+format+nom, file de validation ; **jamais testé sur deux enseignes réelles** (les 20 produits BIM viennent de la même source que leurs prix) |
| Neon / PostgreSQL réel | **Jamais testé** (PGlite uniquement) |
| Tunnel iPhone | Non configuré (`ngrok-chhal.yml` absent) ; accès Wi-Fi local seulement |

## 4. Fichiers
**Consultés** : l'étude (en entier), `docs/AUDIT-MVP.md`, `docs/AUDIT-D4-CLAUDE.md`, adaptateurs du scraper, `.gitignore`, clés de `.env` et `.env.ngrok` (valeurs masquées), `start-api.bat` (masqué), journaux, listes de caches, base via l'API d'administration.
**Modifiés dans le dépôt** : aucun. **Créés** : ce rapport ; un script d'audit dans le dossier temporaire de la session.
**Agent concurrent** : OpenCode est ouvert (processus lancés à 22:07). Dans les 20 dernières minutes, seuls des fichiers de cette session ont changé ; je ne peux pas savoir s'il travaille en ce moment.

## 5. Tests
Commande : `corepack pnpm -r test`.
| Paquet | TOTAL | PASS | FAIL | ERROR | BLOCKED | SKIPPED |
|---|---|---|---|---|---|---|
| matching | 10 | 10 | 0 | 0 | 0 | 0 |
| optimizer | 9 | 9 | 0 | 0 | 0 | 0 |
| i18n | 4 | 4 | 0 | 0 | 0 | 0 |
| scraper | 51 | 51 | 0 | 0 | 0 | 0 |
| web | 20 | 20 | 0 | 0 | 0 | 0 |
| api | 153 | 153 | 0 | 0 | 0 | 0 |
| **Total** | **247** | **247** | **0** | **0** | **0** | **0** |

(Les « 141 » du rapport précédent datent d'avant les Lots 3 et 4.) **Non exécuté** : PostgreSQL réel, iPhone réel, connecteurs sur sources réelles, charge, tests d'interface automatisés des cartes famille, mesure des faux positifs de matching (critère de l'étude : moins de 5 % sur 100 produits).

## 6. Données (base utilisée par l'API : `.data/dev`)
| Mesure | Valeur |
|---|---|
| Observations publiées | **20**, toutes BIM, Casablanca, source `catalogue`, confiance `moyenne`, date `2026-09-01` |
| Données de test | 0 |
| Doublons (même produit, magasin, date) | 0 |
| Prix ≤ 0 | 0 |
| En attente de validation / appariements incertains | 0 / 0 |
| Âge des relevés | 47 jours (tous) |
| Produits listés (50 premiers) | 34 avec famille, 0 avec marque, 0 avec photo |
| Familles avec variante tarifée à Casablanca | 7 : boisson énergisante, boisson gazeuse, charcuterie de dinde, eau, harissa, lben/raïb, margarine |
| Enseignes ayant au moins un prix | **1** (BIM), 1 ville (Casablanca) |

**Provenance** : les 20 prix viennent d'un article tiers (hmizate.ma, catalogue BIM du 1er septembre 2026), initialement enregistrés « manuel / haute » à tort, corrigés en « catalogue / moyenne » par ajout d'avis (historique conservé, voir `CORRECTION-PROVENANCE-BIM.md`). Ce sont des **prix de promotion**, sans date de fin connue.
**Écarts du modèle avec le principe « traçabilité complète »** (étude et consigne) : pas de devise explicite, pas d'URL de source, pas de date de collecte distincte de la date du catalogue, pas de `valid_from`/`valid_until`, pas de méthode de collecte détaillée, pas de justification de la confiance, pas de données brutes conservées. La date du catalogue d'un adaptateur est aujourd'hui **codée en dur** (2026-09-01) au lieu d'être lue dans l'article.

## 7. Sécurité et conformité
| Point | Constat | Gravité |
|---|---|---|
| `start-api.bat` | Jeton administrateur **en clair**, et les fichiers `.bat` ne sont pas dans `.gitignore` | **Élevée** avant tout `git init` |
| Dépôt git | **Aucun** (pas d'historique ; sauvegardes seulement dans `.data/`) | Moyenne |
| Tokens ngrok | Une clé API et un authtoken ont été collés dans la conversation : exposés, à révoquer | Élevée (à votre charge) |
| Secrets dans le code et les journaux | Aucun trouvé ; `.env` et `.env.*` ignorés | OK |
| Adresse e-mail personnelle | Aucune occurrence restante (code, docs, caches, journaux) | OK |
| `ALLOW_TEST_DATA=1` dans `.env` | Dev uniquement ; la production le refuse (testé) ; 0 donnée de test en base | Faible |
| Collecte déjà effectuée | hmizate.ma (par OpenCode, avec un User-Agent contenant votre adresse à l'époque) et Open Food Facts (OpenCode, puis 85 requêtes de cette session) | Information |
| Droits d'usage | hmizate.ma (site tiers), Open Food Facts (ODbL/CC BY-SA, partage à l'identique), Marjane et Carrefour (CGU) : **décisions juridiques non prises** | Élevée avant production |
| Dépendances | 1 vulnérabilité modérée (`esbuild` via `drizzle-kit`, outil de développement) | Faible |
| Tunnel d'ERP AI (pid 24312, port 8000) | Intact | OK |

## 8. Écarts
- **Besoin initial / étude** : l'étude fait de **Marjane** la source P0 ; elle n'est pas implémentée (SPA), faute d'un navigateur automatisé (dépendance lourde, non approuvée) et d'une décision juridique.
- **Étude / code** : tables `sources`, `raw_data`, `promotions`, `import_jobs`, `error_logs`, `retailer_products` absentes ; `valid_*`, `unit_price`, `regular_price`, `availability`, devise absents ; recherche en texte intégral et UUID non repris (identifiants entiers).
- **Documentation** : `AUDIT-D4-CLAUDE.md` affirme que « le projet a été développé avec OpenCode » et qu'aucune trace de Claude n'existe : **faux**, les rapports `RAPPORT-LOT1` à `RAPPORT-LOT4`, `PLAN-LOT2`, `PLAN-LOT4`, `CORRECTION-PROVENANCE-BIM` et les Lots 3 et 4 ont été écrits dans cette session. Il décrit aussi hmizate comme « activé » (contradiction avec `AUDIT-MVP.md`) et ses observations comme `scraping/moyenne` alors qu'elles avaient été saisies `manuel/haute` (corrigé depuis). Ces deux documents sont **périmés** (127 et 130 tests, hmizate activé).
- **Principes de qualité** : le test « promo ≤ prix normal » est impossible (pas de prix normal) ; l'alerte de prix anormal existe mais avec un seuil de ±40 % de la médiane (l'étude : ×0,1 / ×10).

## 9. Décisions attendues
1. **Première source de collecte réelle** (la seule décision qui débloque « des résultats ») :
   - **A. Vos relevés par CSV** : immédiat, sans question juridique, `docs/releves-a-saisir.csv` est prêt.
   - **B. hmizate.ma** (texte facile à lire) : si vous acceptez l'usage du contenu d'un site tiers.
   - **C. Marjane** par navigateur automatisé (Playwright) : exige votre accord sur la dépendance **et** une validation juridique des CGU.
   Ma recommandation : **A maintenant**, et **B ou C seulement après décision juridique écrite**.
2. **Évolution du modèle de prix** (migration) : `observed_at`, `valid_from`, `valid_until`, `source_url`, `collection_method`, `devise`, `confiance_motif`, table `raw_data`. Recommandé avant toute collecte réelle.
3. **Règle de fraîcheur des promotions** : durée de validité lue dans l'article ; si inconnue, prix affiché comme « validité inconnue » et exclu du « prix le plus bas ».
4. **Licence Open Food Facts** : accepter le partage à l'identique, ou limiter l'usage à un enrichissement interne.
5. **Import des 5 prix du beurre** dans la base utilisée par l'API ? (ils sont réels, vos relevés)
6. **`git init`** après avoir sorti le jeton de `start-api.bat`.

## 10. Reste à faire
**P0**
1. Sortir le jeton de `start-api.bat` (lecture depuis `.env`), ignorer `*.bat` et `.env*` avant `git init`. *Critère : aucun secret hors `.env` ; `git status` n'affiche aucun fichier sensible.*
2. Étendre le modèle de prix (décision 2). *Critère : toute nouvelle observation porte une date de collecte, une URL de source et une validité (ou « inconnue » explicite) ; 20 prix BIM rattrapés sans effacer l'historique ; tests.*
3. Premier flux réel selon la décision 1. *Critère : au moins une enseigne avec des prix de moins de 7 jours ; chaque prix relié à sa source et à ses données brutes ; adaptateur documenté (robots.txt, CGU, risques) ; tests sur HTML figé.*
4. Règle de fraîcheur et de validité des promotions (décision 3). *Critère : un prix expiré n'apparaît jamais comme « le moins cher » ; test dédié.*
5. Import des relevés du beurre (décision 5) et des relevés de base (A). *Critère : au moins 20 produits de base avec 2 enseignes ou plus, cohérents avec `releves-a-saisir.csv`.*

**P1** : tables `sources`, `import_jobs`, `error_logs` ; extraction des marques des libellés hmizate ; connecteur Open Food Facts par code-barres ; mesure des faux positifs de matching sur 100 produits ; test sur Neon ; tunnel iPhone ; audit mobile des pages restantes ; OCR d'un catalogue (midio) ; panier multi-enseignes sur données réelles.
**P2** : alertes de baisse de prix, Carrefour par partenariat, application mobile native, API publique, déploiement.
