# Plan — Collecte hmizate.ma avec date, validité et données brutes

Statut : **à approuver par écrit. Aucun code, aucune requête réseau avant validation.** Rédigé le 2026-10-18.
Décision du porteur du projet : usage du contenu de hmizate.ma **accepté sous sa responsabilité**. Ce n'est pas une validation juridique : la décision et sa date seront consignées dans `docs/SOURCES.md` (conditions d'utilisation et droits sur les catalogues d'enseignes **non évalués par un juriste**).

## 1. Ce qui est vérifié sur la vraie page (copie locale du 2026-10-17, `.cache/bim`, aucune requête)
| Constat | Détail |
|---|---|
| Titre | « Catalogue BIM Maroc : offres du 1 septembre 2026 » ; `og:title` : « Catalogue BIM 1 septembre 2026 » |
| **Début de validité** | Dit dans le texte : « à partir du **mardi 1er septembre 2026** » (2026-09-01 est bien un mardi) ; répété dans le titre et dans l'adresse (`catalogue-bim-1-septembre-2026-n1085`) |
| **Fin de validité** | **Jamais écrite** : seulement « cette nouvelle semaine de promotions ». Aucun « jusqu'au », aucun « du … au » |
| Date de publication | Absente du balisage : ni `<time>`, ni JSON-LD, ni date ISO |
| Structure des produits | Sections `<h2>` (« Offres alimentaires BIM du 1er septembre »…) puis `<ul><li>Nom format à <strong>prix DH</strong></li>` |
| Autres contenus de la page | Menus, filtres, liens vers d'autres catalogues (BIM juin à octobre 2026, Kazyon, Marjane…), cookies : **à exclure** pour ne pas lire de prix hors article |
| Fixture de test actuelle | `apps/scraper/fixtures/hmizate-bim.html` est une page **inventée et simplifiée** (1,2 Ko), pas la vraie (112 Ko) : les tests actuels ne prouvent donc rien sur la page réelle |
**Non vérifié** : la page de liste des catalogues, le catalogue « BIM octobre 2026 » (la page en cite l'existence), le `robots.txt` actuel, la présence de promotions conditionnelles (« 2 pour », carte).

## 2. Règles de date et de validité (jamais la date du jour)
1. **Début** (`valid_from`) : phrase « à partir du <jour> <j> <mois> <année> » du texte ; sinon titre ; sinon adresse. Les trois doivent concorder (et le jour de la semaine doit correspondre à la date) : sinon l'article est **rejeté** pour relecture.
2. **Fin** (`valid_until`) : seulement si l'article la dit (« jusqu'au », « du … au »). Sinon elle reste **inconnue** ; aucune date n'est inventée.
3. **Estimation, uniquement si vous l'approuvez** (décision 2) : si le texte parle d'une « semaine de promotions » sans date de fin, `valid_until` = début + 7 jours, statut **`estimee`**, motif écrit dans l'observation. Un prix `estimee` ou `connue` expiré n'apparaît jamais comme « le moins cher ».
4. **Date de collecte** (`observed_at`) = instant du téléchargement, jamais confondue avec la validité. `date_releve` (existant) prend la valeur de `valid_from` pour un catalogue.
5. Une date introuvable reste introuvable : l'observation n'est pas publiée automatiquement.

## 3. Modèle de données (migration 0006, votre accord requis, sauvegarde préalable)
- **`sources`** : slug, nom, URL, type, URL des conditions, `robots_verifie_le`, `robots_hash`, `activee` (faux par défaut), `decision_juridique` (`non_evaluee` | `acceptee_par_le_porteur`), `decidee_le`.
- **`raw_data`** : source, URL, hash SHA-256, type de contenu, état HTTP, `fetched_at`, version du parseur, contenu compressé (gzip). Unicité (source, hash) : un même article n'est jamais retraité.
- **`import_jobs`** : source, début, fin, statut, pages lues, observations créées, lignes rejetées avec raison, erreurs.
- **`price_observations`** (colonnes ajoutées, toujours immuables) : `observed_at`, `valid_from`, `valid_until`, `validity_status` (`connue` | `estimee` | `inconnue`), `source_url`, `raw_data_id`, `collection_method`, `devise` (MAD), `confiance_motif`.
- **Rattrapage des 20 prix BIM** (même méthode que la correction de provenance : avis « rejeté » sur l'ancienne ligne + nouvelle ligne enrichie, jamais de modification) : URL de l'article, `valid_from` 2026-09-01, validité `inconnue`, copie locale de la page importée dans `raw_data` (hash), `observed_at` = date de la copie locale (2026-10-17 19:20, preuve : horodatage du fichier ; motif écrit).

## 4. Chaîne de collecte
1. **Découverte** : une seule page de liste des catalogues, titres filtrés (`Catalogue <enseigne> … <date>`), au plus **2 articles par exécution**, jamais d'exploration large.
2. **Collecte** : `robots.txt` relu à chaque exécution (copie conservée), 1 requête toutes les ≥ 2 s, cache, User-Agent identifiable avec votre contact (`SCRAPER_CONTACT`, **refus de tourner s'il est vide**), arrêt immédiat et désactivation sur 403, 429, 503 ou page de contrôle anti-robot, sans contournement.
3. **Données brutes** : HTML stocké avant toute lecture, avec hash et URL.
4. **Extraction** (parseur versionné) : uniquement le contenu de l'article (sections `<h2>` + listes) ; lignes « nom format à prix » ; lots (« 6 × 30 g ») convertis ; **promotions conditionnelles** (« 2 pour », carte, lot) détectées, marquées et exclues du « prix le plus bas » ; chaque ligne rejetée est journalisée avec sa raison.
5. **Enseigne** déduite du titre et de l'adresse ; ambigu → rejet. **Périmètre proposé : BIM d'abord**, puis Kazyon, Marjane, Aswak ; **Carrefour exclu** tant qu'un avis juridique manque (l'étude signale ses CGU).
6. **Normalisation, appariement, validation** : format et prix ; appariement existant (EAN, marque + format + nom) avec extraction de marque seulement depuis un dictionnaire connu (jamais devinée) ; **seuls les appariements certains sont publiés**, les autres vont dans la file de validation administrateur ; contrôles : prix > 0, écart anormal à la médiane (alerte), `valid_until ≥ valid_from`, doublon (URL, produit, magasin, début).
7. **Publication** : source `catalogue`, confiance `moyenne` + motif écrit (« prix promotionnel d'un site tiers, fin de validité inconnue/estimée »).

## 5. Garde-fous d'activation
- `sources.activee` reste **faux** ; l'activation est un acte explicite, daté et consigné ; exécution réelle seulement avec `SCRAPE_CONFIRM=1`.
- **Première exécution en essai à blanc** : lecture et rapport, aucune écriture en base.
- Plafonds : 2 articles et 1 exécution par jour ; planification quotidienne (GitHub Actions) **seulement après** une première exécution réussie et votre accord.
- Les tests n'utilisent **jamais le réseau** : pages figées uniquement.

## 6. Interface et API
Chaque prix affiche : « Catalogue du 1 sept. 2026 · validité de fin inconnue (ou estimée jusqu'au 8 sept.) · lu le 17 oct. · source hmizate.ma ». Un prix expiré est écarté des paniers et du « le moins cher ». Mention explicite : **prix de promotion, pas prix permanent**.

## 7. Tests (écrits avant le code)
- **Dates** : « 1 septembre 2026 », « 1er », « mardi 1er septembre 2026 », « août », « décembre », date impossible (31 février), jour de la semaine incohérent, texte/titre/adresse discordants → rejet.
- **Validité** : « du X au Y », « jusqu'au X », aucune mention → inconnue, « semaine de promotions » → estimée seulement si la règle est approuvée.
- **Périmètre** : une fixture au **balisage identique à la vraie page mais au contenu fictif** (on ne copie pas la page d'un tiers dans le dépôt) avec des prix dans le menu et la barre latérale qui **ne doivent pas être lus** ; lots, produit sans format, produit sans prix, promotion conditionnelle.
- **Données** : 100 % des observations de cette source ont `source_url`, `observed_at`, `valid_from`, `raw_data_id` ; jamais « aujourd'hui » comme date de validité ; idempotence (même hash → rien).
- **API** : rejet des validités incohérentes ; prix expiré jamais « le moins cher » ; rattrapage des 20 prix BIM sans perte d'historique.
- **Local seulement, ignoré si absent** : test sur la copie réelle de `.cache/bim` (compté comme SKIPPED s'il manque).
- Non-régression : les 247 tests actuels.

## 8. Phases (un arrêt pour votre accord à chaque ligne marquée ⛔)
1. ⛔ Migration 0006 et rattrapage des 20 prix BIM (sauvegarde préalable de la base).
2. Parseur v2 : dates, validité, périmètre, conditionnelles ; sur pages figées.
3. Stockage brut, ingestion v2, validations, affichage.
4. ⛔ **Premier accès réseau** : au plus 3 requêtes (`robots.txt`, une page de liste, un article), essai à blanc.
5. ⛔ Première exécution réelle : 1 article BIM, publication des appariements certains, file de validation, rapport.
6. ⛔ Planification quotidienne et suivi de fraîcheur et d'erreurs.

## 9. Risques et limites
- **Juridique** : décision acceptée par vous, non validée par un juriste ; hmizate republie des catalogues d'enseignes (droits des enseignes) ; son `robots.txt` interdit les robots d'IA (notre usage n'en est pas un, mais le site peut bloquer ou changer de position).
- **Fragilité** : source unique, balisage fabriqué par un éditeur de texte (`data-section-id`) pouvant changer sans préavis ; le parseur est versionné et alerte.
- **Couverture faible** : uniquement des promotions, environ 20 à 30 lignes par catalogue et par enseigne, **pas de prix permanents**.
- **Appariement** : sans code-barres ni marque, peu de lignes seront certaines ; compter une relecture administrateur à chaque catalogue.
- **Fraîcheur** : un catalogue hebdomadaire exige une exécution chaque semaine ; sans cela, les prix expirent et l'application redevient vide.
- Le catalogue d'octobre existe peut-être ; sinon il n'y a rien de plus récent que le 1er septembre.

## 10. Décisions demandées
1. **Contact** publié dans le User-Agent (`SCRAPER_CONTACT`) : adresse ou page de votre choix (le robot refusera de tourner sans).
2. **Fin de validité estimée** : début + 7 jours, marquée « estimée », quand l'article parle d'une semaine de promotions (recommandé) — ou laisser « inconnue ».
3. **Migration 0006 et rattrapage des 20 prix BIM**.
4. **Premier accès réseau** limité à 3 requêtes, essai à blanc.
5. **Périmètre** : BIM d'abord (recommandé), puis Kazyon, Marjane, Aswak ; Carrefour exclu pour l'instant.
6. **Stockage brut** : dans la base, compressé (recommandé, portable) ou fichiers locaux.
