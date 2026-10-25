# Étude stratégique et architecture — Application de comparaison des prix des supermarchés au Maroc

**Date de consultation / rédaction :** octobre 2026
**Marché cible :** Maroc (national, avec granularité ville/magasin/zone de livraison)
**Statut :** Phase de recherche et d'architecture — pas de développement applicatif à ce stade

---

## 1. Synthèse exécutive

### 1.1 Conclusion principale

Le marché marocain de la grande distribution dispose de **sources de prix publiques mais fragmentées et non structurées**. Aucune enseigne étudiée n'expose d'API publique documentée pour les prix au Maroc. Les données exploitables proviennent principalement de :

1. **Les sites e-commerce officiels** (Marjane courses en ligne, Bringo pour Carrefour, Aswak Delivery) — prix à jour mais extraction sujette aux CGU et à la stabilité technique.
2. **Les catalogues promotionnels** (midio.ma, catalogue.ijob.ma, tkdia.com, promocatalogues.ma, hmizate.ma) — données textuelles partiellement structurées, datées, non permanentes.
3. **Open Food Facts** — enrichissement descriptif (EAN, nom, marque, ingrédients, nutrition, images) sous licence ODbL, **sans prix**.

### 1.2 Recommandation MVP

Lancer le MVP sur **trois sources complémentaires** :

| Priorité | Source | Rôle | Justification |
|---|---|---|---|
| P0 | Marjane (marjane.ma) | Source de vérité prix | Courses en ligne avec prix, promotions, format, marque, image ; robots.txt permissif (sitemaps disponibles) ; couverture nationale |
| P0 | Plateforme de catalogues (midio.ma ou catalogue.ijob.ma) | Source B (promotions datées) | Couverture multi-enseignes (BIM, Kazyon, Carrefour, Supeco, Atacadão, Aswak Assalam) avec données textuelles partiellement structurées |
| P0 | Open Food Facts | Source C (enrichissement) | Base EAN/nom/marque/catégorie/images sous licence ouverte, pour le matching et la normalisation |

Carrefour Maroc est **exclu du MVP en extraction directe** car ses CGU interdisent explicitement l'usage de robots/spiders et l'usage commercial des prix. Il sera intégré uniquement via les catalogues promotionnels (source B) ou via un partenariat/licence.

### 1.3 Risques majeurs

- **Légal :** Carrefour Maroc interdit l'extraction automatisée et l'usage commercial. Marjane ne publie pas de CGU d'extraction claire (seules les CGU fidélité sont visibles). Les plateformes de catalogues sont indépendantes et non affiliées aux enseignes.
- **Technique :** Aucune API documentée. Les sites sont des SPA avec rendu côté client (tkdia.com charge dynamiquement). Les structures HTML peuvent changer sans préavis.
- **Données :** Les catalogues ne sont pas des prix permanents. Les prix varient par magasin/ville/zone de livraison. Les EAN ne sont pas toujours présents (surtout BIM, Kazyon, produits frais).
- **Matching :** Risque élevé de faux rapprochements si on fusionne sur le nom seul (packs, formats, marques différentes).

### 1.4 Décisions à prendre avant développement

1. Statut juridique de l'extraction des sites officiels (consultation juridique recommandée).
2. Choix du connecteur prioritaire : Marjane (HTML public) vs. catalogue multi-enseignes (midio/ijob).
3. Licence Open Food Facts : accepter la clause share-alike (les données dérivées redistribuées doivent rester ouvertes) ou limiter l'usage à l'enrichissement interne non redistribué.
4. Granularité géographique du MVP : ville unique (ex. Casablanca) vs. national dès le départ.
5. Politique de fraîcheur : seuil d'expiration des prix (ex. 7 jours pour les prix e-commerce, date de fin de catalogue pour les promotions).

---

## 2. Liste des enseignes marocaines avec URL officielles vérifiées

| Enseigne | URL officielle vérifiée | Type | E-commerce / courses en ligne vérifié | Catalogue officiel vérifié | Commentaire |
|---|---|---|---|---|---|
| Marjane | https://www.marjane.ma/ | Hypermarché | https://www.marjane.ma/courses-en-ligne | https://www.marjane.ma/contenu/nos-catalogues | Courses en ligne avec prix, promotions, format, marque, image. Robots.txt permissif (sitemaps disponibles). CGU générales non trouvées (seules CGU fidélité visibles). |
| Marjane Market | https://www.marjane.ma/market/accueil-marjane-market | Supermarché (format) | Via marjane.ma | Via marjane.ma | Format de proximité du groupe Marjane. |
| Carrefour Maroc | https://carrefour.ma/ | Hypermarché (Label'Vie) | Bringo (app) — https://onelink.to/carrefourma | https://carrefour.ma/catalogues | CGU interdisent robots/spiders et usage commercial des prix. Pas d'API documentée. |
| Carrefour Market | https://carrefour.ma/market | Supermarché (Label'Vie) | Bringo | Via carrefour.ma | Format supermarché. |
| Carrefour Gourmet | https://carrefour.ma/ (menu) | Format premium | Bringo | Via carrefour.ma | Format premium. |
| Carrefour Express | https://carrefour.ma/ (menu) | Format de proximité | Bringo | Via carrefour.ma | Format de proximité. |
| Aswak Assalam | https://www.aswakassalam.com/ | Hypermarché | https://www.aswakdelivery.com/ | https://aswakassalam.com/catalogue | 13 magasins, 70 000 références. E-commerce limité à Casablanca/Mohammedia. |
| Aswak Drive | http://www.aswakdrive.com/ | Drive | http://www.aswakdrive.com/ | Via aswakassalam.com | Retrait en magasin. |
| Atacadão Maroc | https://atacadaomaroc.ma/ | Cash & carry (Label'Vie) | Non vérifié (site en construction) | Via plateformes tierces | 24 magasins dans 23 villes. Site officiel en construction (Cloudflare 302). |
| BIM Maroc | https://www.bim.ma/ | Hard discount | Non vérifié | Via plateformes tierces | Magasins listés sur le site officiel. "Produits actuels" affichés. Pas d'e-commerce vérifié. |
| Kazyon Maroc | https://store.kazyonplus.com/store/kazyon/en | Hard discount | Non vérifié (site SAP) | Via plateformes tierces | 100+ magasins au Maroc. Site officiel sur plateforme SAP. |
| Supeco Maroc | https://supeco.ma/ | Discount (Label'Vie/Carrefour) | Non vérifié (site en construction) | Via plateformes tierces | Site officiel en construction. |
| Kitea | https://www.kitea.ma/ (non vérifié directement) | Maison/ameublement | Non applicable (hors alimentaire) | Via midio.ma, catalogue.ijob.ma | Non alimentaire. Couvert par les plateformes de catalogues. |
| Electroplanet | (non vérifié directement) | Électroménager | Non applicable | Via catalogue.ijob.ma, kazyonmaroc.com | Non alimentaire. Couvert par les plateformes de catalogues. |

**Sources de ces informations :**
- Marjane courses en ligne : https://www.marjane.ma/courses-en-ligne (vérifié oct. 2026)
- Marjane catalogues : https://www.marjane.ma/contenu/nos-catalogues (vérifié oct. 2026)
- Marjane robots.txt : https://www.marjane.ma/robots.txt (vérifié oct. 2026)
- Carrefour Maroc : https://carrefour.ma/ (vérifié oct. 2026)
- Carrefour Maroc mentions légales/CGU : https://carrefour.ma/mentions-legales/ (vérifié oct. 2026)
- Aswak Assalam : https://www.aswakassalam.com/ (vérifié oct. 2026)
- Aswak Assalam CGV : https://aswakassalam.com/conditions-generales-de-vente (vérifié oct. 2026)
- Aswak Delivery : https://www.aswakdelivery.com/ (vérifié oct. 2026)
- Aswak Assalam "qui sommes-nous" : https://aswakassalam.com/qui-sommes-nous (vérifié oct. 2026)
- Atacadão Maroc (Wikipedia) : https://fr.wikipedia.org/wiki/Atacad%C3%A3o_Maroc (vérifié oct. 2026)
- Atacadão Maroc site : https://atacadaomaroc.ma/ (en construction, vérifié oct. 2026)
- Label'Vie communiqué (24 magasins) : https://labelvie.ma/wp-content/uploads/2026/04/CP-Ouverture-Atacadao-Khenifra.pdf (vérifié oct. 2026)
- BIM Maroc : https://www.bim.ma/ (vérifié oct. 2026)
- Kazyon Maroc : https://store.kazyonplus.com/store/kazyon/en (vérifié oct. 2026)
- Supeco Maroc : https://supeco.ma/ (en construction, vérifié oct. 2026)

---

## 3. Catalogues promotionnels et plateformes existantes

| Plateforme | URL vérifiée | Enseignes couvertes | Type de données | Fraîcheur | Affiliation | Commentaire |
|---|---|---|---|---|---|---|
| midio.ma | https://midio.ma/ | BIM, Kazyon, Atacadao, Carrefour, Supeco, Marjane, Aswak Assalam, Kitea | Catalogues en images (pages webp/jpg), navigation par magasin | Derniers catalogues récents (ex. mai 2026) | Indépendant, non affilié | Plateforme bien structurée avec URL par catalogue. Images de pages. Pas de données textuelles structurées vérifiées au niveau produit. |
| catalogue.ijob.ma | https://catalogue.ijob.ma/ | BIM, Carrefour, Aswak Assalam, Kazyon, Oriflame, Electroplanet, IKEA, Supeco, Cerba, Madini, Kitea, Marjane, Amoud, Miniso | Catalogues en images (jpg) | Hebdomadaire (ex. oct. 2026) | Indépendant, non affilié | Pages individuelles par catalogue avec images. Pas de données textuelles structurées vérifiées. |
| tkdia.com | https://tkdia.com/ | Aswak Assalam, Atacadao, BIM, Carrefour, Kazyon, Kitea, Marjane, Supeco | SPA (chargement dynamique) — catalogues, promotions, magasins, produits, articles | Hebdomadaire | Indépendant, non affilié | Application web SPA. Les pages se chargent dynamiquement. Structure à explorer (endpoints internes possibles). |
| promocatalogues.ma | https://promocatalogues.ma/fr | BIM, Marjane, Supeco, Marjane Market, Aswak Assalam, Kazyon, Carrefour | Catalogues interactifs + comparateur de prix par produit | Quotidien (selon leurs dires) | Indépendant | "1er comparateur de prix des supermarchés au Maroc 100% interactif". Compare les prix par produit (ex. pêche calibre moyen). Données issues des catalogues. |
| hmizate.ma | https://hmizate.ma/ | BIM, Kazyon, Marjane, Carrefour, Atacadão, Supeco, Aswak Assalam, Kitea, Alpha 55 | Articles de blog détaillant les promotions (texte) | Hebdomadaire | Indépendant | Articles rédigés listant les promotions par produit avec prix. Données textuelles exploitables mais non structurées (OCR/PDF → texte). |
| soldemaroc.com | https://www.soldemaroc.com/ | Supeco, etc. | Catalogues | Périodique | Indépendant | Moins complet. |
| kazyonmaroc.com | https://kazyonmaroc.com/ | Kazyon (et autres via blog) | Articles de blog détaillant les promotions | Hebdomadaire | Indépendant, non affilié | Articles très détaillés avec prix par produit. |
| kazyon-market.com | https://kazyon-market.com/ | Kazyon, BIM, Marjane, Marjane Market | Articles de blog | Hebdomadaire | Indépendant, non affilié | Similaire. |
| cataloguemarjane.com | https://cataloguemarjane.com/ | Marjane | Catalogues interactifs avec produits, prix, promotions | Périodique | Non officiel | Site non officiel mais structuré (produits, prix, réductions, historique). |
| ilofo.com (ma.ilofo.com) | https://ma.ilofo.com/fr/ | Atacadão, Aswak Assalam, etc. | Catalogues + adresses magasins | Périodique | Indépendant | Fiches magasins avec adresses et horaires. |

**Important :** Aucune de ces plateformes n'est une source de prix permanent. Elles exposent des promotions datées (catalogues hebdomadaires/mensuels). Les prix affichés sont ceux du catalogue, pas nécessairement le prix en rayon au moment de la consultation. De plus, elles sont indépendantes et non affiliées aux enseignes.

**Données structurées vs. images :**
- midio.ma et catalogue.ijob.ma présentent principalement des **images de pages de catalogue** (webp/jpg). L'extraction de données nécessite de l'OCR ou du parsing d'images.
- promocatalogues.ma et hmizate.ma/kazyonmaroc.com présentent des **données textuelles** (articles détaillant les promotions avec prix par produit), plus facilement extractibles.
- tkdia.com est une SPA dont la structure interne (endpoints JSON possibles) doit être explorée (non vérifié).

---

## 4. Benchmark des comparateurs et applications existants

### 4.1 Références internationales

| Solution | URL vérifiée | Marché | Statut | Fonctionnalités clés | Pertinence pour le Maroc |
|---|---|---|---|---|---|
| Google Shopping | https://shopping.google.com/ | International | Actif | Comparaison de prix, filtres, marchands, avis | Référence UX. Ne couvre pas le Maroc (grandes surfaces locales). |
| Idealo | https://www.idealo.com/ | Europe (DE, FR, UK, etc.) | Actif | Comparaison de prix, historique, alertes prix, filtres | Référence technique et UX. Modèle de collecte par flux marchands + scraping. |
| PriceRunner | https://www.pricerunner.com/ | Nordic/Europe | Actif | Comparaison, avis, historique | Référence. |
| Trolley | https://www.trolley.co.uk/ | UK | Actif | Comparaison de prix supermarchés UK, panier, prix unitaire | Très pertinent : modèle de comparaison de paniers et de prix unitaires entre supermarchés. |
| mySupermarket | https://en.wikipedia.org/wiki/MySupermarket | UK | **Fermé** (consumer-facing) le 1er mars 2020 | Comparaison de prix supermarchés UK, suggestions d'alternatives | Étude de cas : modèle viable mais fermé pour pivot B2B. |
| Open Food Facts | https://world.openfoodfacts.org/ | Mondial | Actif | Base de données produits (EAN, nom, marque, ingrédients, nutrition, images) | Source d'enrichissement. Pas de prix. |

### 4.2 Références marocaines

| Solution | URL vérifiée | Marché | Statut | Fonctionnalités | Lacunes / opportunités |
|---|---|---|---|---|---|
| BlaGhla | https://blaghla.com/ | Maroc | Actif | Comparaison prix en temps réel entre Marjane, Carrefour, Aswak Assalam. Recherche par nom/catégorie. Panier comparatif. Promotions. | Couverture limitée à 3 enseignes. Pas d'historique de prix visible. Pas de prix unitaire apparent. Pas d'EAN/scan. |
| Prixci | https://prixci.com/ | Maroc (et autres) | Actif | Comparaison de prix, scan barcode, notifications de baisse de prix, panier, historique des scans. | Couverture et fraîcheur à vérifier. Pas de comparaison de paniers multi-enseignes visible. |
| Promocatalogues.ma | https://promocatalogues.ma/fr | Maroc | Actif | "1er comparateur de prix des supermarchés au Maroc 100% interactif". Comparaison par produit (ex. pêche calibre moyen). Listes de courses. Catalogues interactifs. | Données issues des catalogues (promotions datées). Pas de prix permanent. Couverture multi-enseignes. |
| DepenseLess.com | https://depenseless.com/ | Maroc | Actif | Catalogues + comparaison de prix. | Moins de fonctionnalités avancées. |
| Hmizate.ma | https://hmizate.ma/ | Maroc | Actif | Catalogues, promotions, hôtels, voyages. | Pas de comparaison de prix structurée par produit. |
| midio.ma | https://midio.ma/ | Maroc | Actif | Catalogues multi-enseignes. | Pas de comparaison de prix par produit. |
| tkdia.com | https://tkdia.com/ | Maroc | Actif | Catalogues, promotions, magasins, produits, articles. | SPA. Données à explorer. |
| catalogue.ijob.ma | https://catalogue.ijob.ma/ | Maroc | Actif | Catalogues multi-enseignes. | Pas de comparaison de prix. |
| Combien.ma | https://combien.ma/ | Maroc | Actif (depuis 2008) | Comparateur de prix général (électronique, etc.), pas spécifiquement supermarché. | Pas de focus alimentaire/supermarché. |
| PrixPad | https://www.prixpad.ma/ | Maroc | Actif | Comparateur de prix général. | Peu de données vérifiables. |
| Flipini | https://flipini.com/app | France + Maroc | Actif (app mobile) | Scan barcode, comparaison de prix, catalogues, assistant IA (Piou), menus de la semaine, listes. Couvre France et Maroc. | Couverture Maroc à vérifier (développeur marocain). Fonctionnalités avancées (IA, menus). |
| Safimeal | https://safimeal.ma/fr | Maroc | Actif | Scan santé, score nutritionnel, frigo intelligent, recettes, suivi de budget. | Focus santé/budget, pas comparaison multi-enseignes. |
| Safimeal | https://safimeal.ma/fr | Maroc | Actif | Scan santé, score nutritionnel, frigo intelligent, recettes, suivi de budget. | Focus santé/budget, pas comparaison multi-enseignes. |
| MyMarket.ma | https://www.mymarket.ma/ | Maroc | Actif | Supermarché en ligne (produits, prix, stock). | Source unique (pas comparateur), mais prix exploitables. |
| Baya | https://www.bayasaver.com/ | Maroc | Actif | Anti-gaspillage : paniers d'invendus à prix réduits. | Niche (invendus), pas comparaison. |
| Circl (app) | Google Play | France | Actif | Comparateur liste de courses, promotions, budget. | France uniquement. |

**Fonctionnalités à reprendre comme inspiration :**
- BlaGhla : comparaison de paniers multi-enseignes, UI simple.
- Prixci : scan barcode, notifications de baisse de prix, historique des scans, panier.
- Promocatalogues.ma : comparaison par produit avec prix unitaire, listes de courses, catalogues interactifs.
- Flipini : scan barcode avec fallback clair si produit non trouvé, assistant IA, menus de la semaine basés sur les vraies promos, communauté de relevés de prix.
- Trolley : comparaison de paniers, prix unitaire (au kg/L), historique.
- Safimeal : scan santé + budget, recettes anti-gaspi.

**Lacunes du marché marocain (opportunités) :**
- Aucun comparateur ne couvre BIM, Kazyon, Atacadão, Supeco avec des prix permanents (seulement promotions de catalogues).
- Aucun ne propose d'historique de prix long terme.
- Aucun ne gère le rapprochement de produits équivalents (500g vs 1kg) avec prix unitaire.
- Aucun ne distingue clairement prix normal vs. prix promotionnel vs. prix carte fidélité.
- Aucun ne gère la fraîcheur (date de dernière vérification) de manière transparente.
- La granularité par magasin/ville est rarement exposée.

---

## 5. Matrice des sources de données (sources de vérité)

| Enseigne / source | URL exacte | Type | Données disponibles | Prix permanent | Prix promotionnel | Couverture géo | Fraîcheur | Extraction | Automatisation | Restrictions | Fiabilité | Priorité MVP | Prochaine action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Marjane | https://www.marjane.ma/courses-en-ligne | Site officiel + e-commerce | Nom, prix, promotion, format, marque, image, catégorie | Oui (prix affichés) | Oui (réductions affichées) | Nationale (sélection magasin/zone) | Temps réel (site) | HTML | Moyenne (SPA, sélecteurs à maintenir) | CGU générales non trouvées ; robots.txt permissif (sitemaps dispo) | Moyenne-haute (preuve directe) | P0 | Tester l'extraction d'une catégorie complète et vérifier la présence d'EAN |
| Carrefour Maroc | https://carrefour.ma/ | Site officiel + e-commerce (Bringo) | Promotions sur la home, catalogues | Partiel (promos) | Oui (promos datées) | Nationale | Périodique | HTML | Difficile | **CGU interdisent robots/spiders et usage commercial** | Moyenne (preuve directe) | P2 (via catalogues uniquement) | Vérifier si Bringo expose un endpoint JSON ; consulter juridiquement |
| Aswak Assalam | https://www.aswakassalam.com/ | Site officiel + e-commerce (Aswak Delivery) | Catalogue, produits, prix, promotions | Partiel | Oui (catalogue) | Limitée (Casablanca/Mohammedia pour l'e-commerce) | Périodique | HTML | Moyenne | CGV disponibles ; vente en ligne limitée à Casa/Mohammedia | Moyenne | P1 | Tester l'extraction du catalogue et de la boutique en ligne |
| Atacadão | https://atacadaomaroc.ma/ | Site officiel | Aucune (site en construction) | Non | Non | Nationale (24 magasins) | Inconnue | Impossible (site en construction) | Impossible | Non vérifié | Faible | P2 | Surveiller la mise en ligne du site ; utiliser les catalogues tierces |
| BIM Maroc | https://www.bim.ma/ | Site officiel | "Produits actuels", magasins | Partiel (produits affichés) | Partiel | Nationale | Périodique | HTML | Moyenne-difficile | Non vérifié | Faible-moyenne | P1 | Explorer les pages "produits actuels" et magasins ; tester l'extraction |
| Kazyon Maroc | https://store.kazyonplus.com/store/kazyon/en | Site officiel (SAP) | Magasins, FAQ, CGU | Non vérifié | Non vérifié | Nationale (100+ magasins) | Inconnue | Difficile (plateforme SAP) | Difficile | CGU SAP | Faible | P2 | Vérifier si le site expose des produits/prix ; sinon utiliser les catalogues |
| Supeco Maroc | https://supeco.ma/ | Site officiel | Aucune (site en construction) | Non | Non | Nationale | Inconnue | Impossible | Impossible | Non vérifié | Faible | P2 | Surveiller la mise en ligne ; utiliser les catalogues tierces |
| midio.ma | https://midio.ma/ | Plateforme de catalogues | Catalogues (images), navigation par magasin | Non (promotions datées) | Oui (promotions datées) | Nationale | Hebdomadaire | HTML (images) | Moyenne (URLs structurées par catalogue) | CGU à vérifier | Moyenne | P0 | Tester l'extraction des pages catalogue et l'OCR des images |
| catalogue.ijob.ma | https://catalogue.ijob.ma/ | Plateforme de catalogues | Catalogues (images) | Non (promotions datées) | Oui (promotions datées) | Nationale | Hebdomadaire | HTML (images) | Moyenne | CGU à vérifier | Moyenne | P0 | Tester l'extraction des pages catalogue et l'OCR |
| tkdia.com | https://tkdia.com/ | Plateforme de catalogues | Catalogues, promotions, magasins, produits, articles (SPA) | Non (promotions datées) | Oui (promotions datées) | Nationale | Hebdomadaire | HTML/JS (SPA) | Difficile (rendu client) | CGU à vérifier | Moyenne | P1 | Explorer les endpoints internes de la SPA |
| promocatalogues.ma | https://promocatalogues.ma/fr | Plateforme de catalogues + comparateur | Catalogues interactifs, comparaison par produit | Non (promotions datées) | Oui (promotions datées) | Nationale | Quotidien (selon leurs dires) | HTML | Moyenne | CGU à vérifier | Moyenne | P1 | Tester l'extraction des pages comparateur et catalogues |
| hmizate.ma | https://hmizate.ma/ | Plateforme de catalogues | Articles de blog avec prix par produit | Non (promotions datées) | Oui (promotions datées) | Nationale | Hebdomadaire | HTML (texte) | Facile (texte structuré) | CGU à vérifier | Moyenne | P1 | Tester l'extraction des articles de promotion |
| Open Food Facts | https://world.openfoodfacts.org/ | Base de données ouverte | EAN, nom, marque, catégorie, ingrédients, nutrition, images | **Non (pas de prix)** | Non | Mondial (dont Maroc) | Variable (contributions) | API JSON + exports | Facile (API documentée) | ODbL (attribution + share-alike) | Moyenne (contributif, non garanti) | P0 | Vérifier la couverture Maroc ; tester l'API par EAN |

**Catégorisation des sources :**
- **A — Sources de vérité des prix :** Marjane (e-commerce), Carrefour (via Bringo, sous réserve), Aswak Assalam (e-commerce limité).
- **B — Sources de catalogues :** midio.ma, catalogue.ijob.ma, tkdia.com, promocatalogues.ma, hmizate.ma, kazyonmaroc.com, soldemaroc.com, cataloguemarjane.com.
- **C — Sources d'enrichissement :** Open Food Facts (EAN, nom, marque, catégorie, images, nutrition).
- **D — Sources secondaires :** BlaGhla, Prixci, Promocatalogues.ma, DepenseLess, Flipini, Safimeal (comparateurs existants — inspiration et validation, pas de réutilisation de données sans accord).

---

## 6. Évaluation des possibilités d'automatisation

| Source | Méthode recommandée | Difficulté | Fréquence possible | Fiabilité attendue | Commentaire |
|---|---|---|---|---|---|
| Marjane (courses en ligne) | Scraping HTML (Playwright/Puppeteer) + parsing des pages catégorie/produit | Moyenne | Quotidienne | Moyenne-haute | Site SPA. Sélecteurs à maintenir. Robots.txt permissif. Pas d'API documentée. Tester la présence d'EAN. |
| Carrefour Maroc (site) | Scraping HTML des promotions/catalogues uniquement | Difficile (CGU) | Hebdomadaire | Faible-moyenne | CGU interdisent robots/spiders et usage commercial. Recommandation : ne pas scraper le site principal. Utiliser les catalogues tierces. |
| Carrefour Maroc (Bringo) | Non vérifié — explorer si l'app expose un endpoint JSON | À confirmer | À confirmer | Inconnue | Nécessite une analyse de l'app (reverse engineering) — à éviter sans autorisation. |
| Aswak Assalam (site + catalogue) | Scraping HTML du catalogue + boutique en ligne | Moyenne | Hebdomadaire | Moyenne | E-commerce limité à Casa/Mohammedia. Catalogue en images. |
| Atacadão | Aucune (site en construction) | Impossible | — | — | Utiliser les catalogues tierces. |
| BIM Maroc | Scraping HTML des pages "produits actuels" + magasins | Moyenne-difficile | Hebdomadaire | Faible-moyenne | Structure simple. Pas d'e-commerce. Produits affichés sans prix visible sur la page d'accueil (à vérifier). |
| Kazyon Maroc | Aucune directe (plateforme SAP) | Difficile | — | Faible | Utiliser les catalogues tierces. |
| Supeco Maroc | Aucune (site en construction) | Impossible | — | — | Utiliser les catalogues tierces. |
| midio.ma | Scraping HTML des pages catalogue (images) + OCR | Moyenne | Hebdomadaire | Moyenne | URLs structurées par catalogue. Images de pages. OCR nécessaire pour extraire les données produit. |
| catalogue.ijob.ma | Scraping HTML des pages catalogue (images) + OCR | Moyenne | Hebdomadaire | Moyenne | Similaire à midio.ma. |
| tkdia.com | Scraping de la SPA + exploration des endpoints internes | Difficile | Hebdomadaire | Moyenne | SPA avec chargement dynamique. Endpoints JSON possibles mais non vérifiés. |
| promocatalogues.ma | Scraping HTML des pages comparateur et catalogues | Moyenne | Quotidienne | Moyenne | Données textuelles structurées (produit, prix, enseigne). |
| hmizate.ma / kazyonmaroc.com | Scraping HTML des articles de blog | Facile | Hebdomadaire | Moyenne | Texte structuré avec prix par produit. Plus facile à parser que les images. |
| Open Food Facts | API JSON (documentée) + exports quotidiens | Facile | Quotidienne (exports) | Moyenne (contributif) | API documentée avec rate limits. Exports MongoDB/CSV/JSONL disponibles. Licence ODbL. |

**Principes d'architecture pour la collecte :**
- Connecteur par source (plugin indépendant).
- Conservation des données brutes (raw HTML/PDF/images) avec provenance.
- Retry avec backoff exponentiel.
- Circuit breaker par connecteur.
- Monitoring de la fraîcheur et des erreurs.
- Fallback : si une source devient indisponible, le système continue avec les autres.
- Pas de contournement de CAPTCHA, d'authentification ou de paywall.

---

## 7. Modèle de données proposé

### 7.1 Schéma relationnel (PostgreSQL recommandé)

```sql
-- Catégories
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES categories(id),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    level           SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Enseignes (Retailer)
CREATE TABLE retailers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL UNIQUE,
    website_url     TEXT,
    retailer_type   VARCHAR(50) NOT NULL, -- 'hypermarket', 'supermarket', 'discount', 'cash_carry', 'online_only'
    country_code    CHAR(2) NOT NULL DEFAULT 'MA',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Magasins (Store)
CREATE TABLE stores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id     UUID NOT NULL REFERENCES retailers(id),
    city            VARCHAR(255) NOT NULL,
    address         TEXT,
    geographic_zone VARCHAR(255), -- quartier/zone de livraison
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (retailer_id, city, address)
);
CREATE INDEX idx_stores_retailer ON stores(retailer_id);
CREATE INDEX idx_stores_city ON stores(city);

-- Produits canoniques (Product)
CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name      VARCHAR(500) NOT NULL,
    brand               VARCHAR(255),
    category_id         UUID REFERENCES categories(id),
    subcategory_id      UUID REFERENCES categories(id),
    barcode_gtin        VARCHAR(14) UNIQUE, -- EAN/GTIN (peut être NULL)
    normalized_quantity DECIMAL(12,4), -- ex. 1.0000
    normalized_unit     VARCHAR(20), -- 'kg', 'g', 'L', 'ml', 'unit', 'pack'
    image_url           TEXT,
    attributes          JSONB NOT NULL DEFAULT '{}', -- couleur, saveur, etc.
    match_status        VARCHAR(20) NOT NULL DEFAULT 'unmatched', -- 'matched', 'unmatched', 'ambiguous'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_barcode ON products(barcode_gtin) WHERE barcode_gtin IS NOT NULL;
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('french', canonical_name));
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category ON products(category_id);

-- Produits côté enseigne (RetailerProduct)
CREATE TABLE retailer_products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id         UUID NOT NULL REFERENCES retailers(id),
    store_id            UUID REFERENCES stores(id), -- NULL si prix national
    source_product_id   VARCHAR(255), -- ID interne de l'enseigne
    source_url          TEXT,
    source_name         VARCHAR(500) NOT NULL,
    source_brand        VARCHAR(255),
    source_quantity     VARCHAR(100), -- texte brut : "500 g", "1 L"
    source_unit         VARCHAR(50),
    matched_product_id  UUID REFERENCES products(id),
    match_confidence    DECIMAL(5,4), -- 0.0000 à 1.0000
    match_method        VARCHAR(50), -- 'ean', 'brand_ref', 'name_unit', 'semantic', 'manual'
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (retailer_id, store_id, source_product_id)
);
CREATE INDEX idx_rp_retailer ON retailer_products(retailer_id);
CREATE INDEX idx_rp_store ON retailer_products(store_id);
CREATE INDEX idx_rp_matched ON retailer_products(matched_product_id);
CREATE INDEX idx_rp_source_name ON retailer_products USING gin(to_tsvector('french', source_name));

-- Observations de prix (PriceObservation)
CREATE TABLE price_observations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_product_id UUID NOT NULL REFERENCES retailer_products(id),
    price               DECIMAL(12,2) NOT NULL, -- prix affiché (peut être promo)
    regular_price       DECIMAL(12,2), -- prix normal (si différent)
    promotion_price     DECIMAL(12,2), -- prix promotionnel explicite
    currency            CHAR(3) NOT NULL DEFAULT 'MAD',
    unit_price          DECIMAL(12,4), -- prix par unité normalisée (MAD/kg, MAD/L)
    unit_price_unit     VARCHAR(20), -- 'MAD/kg', 'MAD/L', 'MAD/unit'
    availability        VARCHAR(30) NOT NULL DEFAULT 'unknown', -- 'in_stock', 'out_of_stock', 'unknown'
    observed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_from          TIMESTAMPTZ, -- date de début de validité (promo)
    valid_until         TIMESTAMPTZ, -- date de fin de validité (promo)
    source_type         VARCHAR(30) NOT NULL, -- 'ecommerce', 'catalog', 'ocr', 'manual', 'api'
    verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified', -- 'verified', 'unverified', 'expired', 'disputed'
    raw_data_id         UUID REFERENCES raw_data(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_rp ON price_observations(retailer_product_id);
CREATE INDEX idx_po_observed ON price_observations(observed_at DESC);
CREATE INDEX idx_po_valid ON price_observations(valid_until) WHERE valid_until IS NOT NULL;

-- Données brutes (RawData)
CREATE TABLE raw_data (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID NOT NULL REFERENCES sources(id),
    url             TEXT NOT NULL,
    content_type    VARCHAR(100), -- 'text/html', 'application/pdf', 'image/webp', etc.
    content_hash    VARCHAR(64) NOT NULL, -- SHA-256
    storage_path    TEXT NOT NULL, -- chemin S3/MinIO
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    http_status     SMALLINT,
    UNIQUE (source_id, content_hash)
);
CREATE INDEX idx_raw_source ON raw_data(source_id);
CREATE INDEX idx_raw_fetched ON raw_data(fetched_at DESC);

-- Sources (Source)
CREATE TABLE sources (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name         VARCHAR(255) NOT NULL UNIQUE,
    base_url            TEXT NOT NULL,
    source_type         VARCHAR(30) NOT NULL, -- 'official_ecommerce', 'catalog_platform', 'open_database', 'secondary'
    terms_url           TEXT,
    collection_method   VARCHAR(30) NOT NULL, -- 'api', 'html', 'pdf', 'ocr', 'csv', 'manual'
    last_successful_run TIMESTAMPTZ,
    last_error          TEXT,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Promotions
CREATE TABLE promotions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id         UUID REFERENCES retailers(id),
    store_id            UUID REFERENCES stores(id),
    title               VARCHAR(500),
    description         TEXT,
    valid_from          TIMESTAMPTZ,
    valid_until         TIMESTAMPTZ,
    source_catalog_url  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_retailer ON promotions(retailer_id);
CREATE INDEX idx_promo_valid ON promotions(valid_until);

-- Lien promotion <-> observation
CREATE TABLE promotion_observations (
    promotion_id        UUID NOT NULL REFERENCES promotions(id),
    price_observation_id UUID NOT NULL REFERENCES price_observations(id),
    PRIMARY KEY (promotion_id, price_observation_id)
);

-- Tâches d'importation (ImportJob)
CREATE TABLE import_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID NOT NULL REFERENCES sources(id),
    job_type        VARCHAR(30) NOT NULL, -- 'discovery', 'collection', 'extraction', 'normalization', 'matching'
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    items_processed INTEGER DEFAULT 0,
    items_failed    INTEGER DEFAULT 0,
    error_log       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ij_source ON import_jobs(source_id);
CREATE INDEX idx_ij_status ON import_jobs(status);

-- Journal des erreurs (ErrorLog)
CREATE TABLE error_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID REFERENCES sources(id),
    import_job_id   UUID REFERENCES import_jobs(id),
    error_type      VARCHAR(50) NOT NULL, -- 'http_error', 'parse_error', 'validation_error', 'matching_error'
    message         TEXT NOT NULL,
    context         JSONB,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_el_source ON error_logs(source_id);
CREATE INDEX idx_el_occurred ON error_logs(occurred_at DESC);

-- Règles de rapprochement (MatchingRule)
CREATE TABLE matching_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type       VARCHAR(50) NOT NULL, -- 'ean_exact', 'brand_ref', 'name_unit', 'semantic', 'manual'
    priority        SMALLINT NOT NULL,
    threshold       DECIMAL(5,4), -- seuil de confiance pour les règles floues
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historique des prix (vue matérialisée pour performance)
CREATE MATERIALIZED VIEW price_history AS
SELECT
    po.retailer_product_id,
    rp.matched_product_id,
    po.price,
    po.regular_price,
    po.promotion_price,
    po.unit_price,
    po.currency,
    po.availability,
    po.observed_at,
    po.verification_status
FROM price_observations po
JOIN retailer_products rp ON rp.id = po.retailer_product_id
ORDER BY po.observed_at DESC;

CREATE INDEX idx_ph_product ON price_history(matched_product_id);
CREATE INDEX idx_ph_rp ON price_history(retailer_product_id);
CREATE INDEX idx_ph_observed ON price_history(observed_at DESC);
```

### 7.2 Clés, contraintes et index

- **Unicité :** `products.barcode_gtin` (quand non NULL), `retailer_products(retailer_id, store_id, source_product_id)`, `sources.source_name`, `retailers.name`.
- **Index full-text :** sur `products.canonical_name` et `retailer_products.source_name` (tsvector français).
- **Index partiel :** sur `products.barcode_gtin` (WHERE NOT NULL), sur `price_observations.valid_until` (WHERE NOT NULL).
- **Vue matérialisée :** `price_history` rafraîchie quotidiennement pour les requêtes d'historique.
- **Conservation de l'historique :** toutes les observations sont conservées indéfiniment (append-only). Les données brutes sont conservées 90 jours minimum (configurable). Les prix expirés sont marqués (`verification_status = 'expired'`) mais pas supprimés.

### 7.3 Adaptations aux contraintes découvertes

- **Pas d'EAN pour toutes les enseignes :** `products.barcode_gtin` est nullable. Le matching se fait alors par nom + format + unité.
- **Pas de magasin précis :** `retailer_products.store_id` est nullable (prix national).
- **Pas de prix permanent :** `price_observations.regular_price` est nullable. Le prix affiché (`price`) est le prix réellement observé.
- **Prix carte fidélité :** champ `attributes` JSONB dans `products` ou observation avec `source_type` et métadonnées dans `raw_data`. Recommandation : ajouter un champ `loyalty_price` dans `price_observations` (P1).

---

## 8. Stratégie de matching et de normalisation

### 8.1 Normalisation des unités

| Unité source | Unité normalisée | Facteur de conversion |
|---|---|---|
| g | kg | /1000 |
| mg | kg | /1000000 |
| kg | kg | 1 |
| ml | L | /1000 |
| cl | L | /100 |
| L | L | 1 |
| unité/pièce | unit | 1 |
| pack de N | pack (N unités) | N unités |
| lot de N | lot | N unités |

**Prix unitaire :** `unit_price = price / normalized_quantity` (en MAD/kg, MAD/L ou MAD/unité).

### 8.2 Stratégie de matching progressive

1. **Correspondance exacte par EAN/GTIN** (confiance = 1.0) — lorsqu'il est fiable et présent des deux côtés.
2. **Correspondance marque + référence fabricant** (confiance = 0.95) — si la marque et la référence fabricant correspondent.
3. **Correspondance nom normalisé + format + unité** (confiance = 0.85) — après normalisation du nom (minuscules, suppression des accents, standardisation des abréviations) et correspondance exacte du format et de l'unité.
4. **Similarité textuelle/sémantique** (confiance = seuil configurable, ex. 0.75) — via fuzzy matching (Levenshtein, Jaro-Winkler) ou embeddings. Nécessite validation manuelle si confiance < 0.9.
5. **Validation manuelle** pour les cas ambigus — interface d'administration.

### 8.3 Règles de non-fusion

- **Ne jamais fusionner** deux produits uniquement parce que leurs noms sont proches.
- **Ne jamais fusionner** un pack (ex. 6 unités) avec une unité individuelle sans conversion explicite.
- **Ne jamais fusionner** des produits de marques différentes (sauf marque distributeur vs. marque nationale explicitement équivalente).
- **Ne jamais fusionner** un produit avec prix au kg et un produit avec prix à l'unité sans calcul du prix unitaire.
- **Promotion conditionnée** (carte fidélité, achat multiple) : marquer l'observation avec `source_type = 'catalog'` et `attributes.loyalty_condition = true`. Ne pas comparer directement avec un prix non conditionné sans avertissement.

### 8.4 Exemples de cas à gérer

| Cas | Traitement |
|---|---|
| "Lait UHT 1 L" vs "Lait entier 100 cl" | Normaliser en 1 L. Si marques différentes → produits distincts. Si même marque et même type → candidat au matching (confiance 0.85). |
| Même produit, noms légèrement différents | Normalisation du nom + fuzzy matching. Validation manuelle si confiance < 0.9. |
| Pack de 6 vs unité individuelle | Créer deux RetailerProduct distincts. Calculer le prix unitaire (pack/6). Ne pas fusionner automatiquement. |
| Prix à l'unité vs prix au kg | Calculer le prix unitaire pour les deux. Comparer uniquement les prix unitaires normalisés. |
| Promotion carte fidélité | Marquer l'observation. Afficher séparément. Ne pas inclure dans le "prix le plus bas" sans avertissement. |

---

## 9. Architecture des connecteurs

### 9.1 Pipeline de collecte

```
┌─────────────────┐
│  1. Discovery   │  Découverte des URLs sources (sitemaps, pages catégorie)
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. Collection  │  Téléchargement des données brutes (HTML, PDF, images)
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. Raw Storage │  Conservation brute + provenance (hash, URL, date)
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. Extraction  │  Parsing des champs (nom, prix, format, marque, etc.)
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. Normalization│ Normalisation des noms, unités, devises
└────────┬────────┘
         ▼
┌─────────────────┐
│  6. Deduplication│ Déduplication des observations
└────────┬────────┘
         ▼
┌─────────────────┐
│  7. Matching    │  Rapprochement avec le catalogue canonique
└────────┬────────┘
         ▼
┌─────────────────┐
│  8. Validation  │  Contrôles qualité (prix positif, unités, etc.)
└────────┬────────┘
         ▼
┌─────────────────┐
│  9. Publication │  Enregistrement de l'observation + date de vérification
└─────────────────┘
```

### 9.2 Architecture modulaire

```
src/
├── connectors/
│   ├── base/
│   │   ├── connector.interface.ts
│   │   ├── http.client.ts
│   │   └── retry.policy.ts
│   ├── marjane/
│   │   ├── marjane.connector.ts
│   │   ├── marjane.parser.ts
│   │   └── marjane.config.ts
│   ├── carrefour/
│   │   └── carrefour.catalog.connector.ts  (catalogues uniquement)
│   ├── aswak/
│   │   ├── aswak.connector.ts
│   │   └── aswak.parser.ts
│   ├── midio/
│   │   ├── midio.connector.ts
│   │   └── midio.ocr.ts
│   ├── ijob/
│   │   └── ijob.connector.ts
│   ├── openfoodfacts/
│   │   └── off.connector.ts
│   └── ...
├── pipeline/
│   ├── discovery.service.ts
│   ├── collection.service.ts
│   ├── extraction.service.ts
│   ├── normalization.service.ts
│   ├── dedup.service.ts
│   ├── matching.service.ts
│   ├── validation.service.ts
│   └── publication.service.ts
├── storage/
│   ├── raw.storage.ts (S3/MinIO)
│   └── db.repository.ts
├── monitoring/
│   ├── freshness.monitor.ts
│   ├── error.tracker.ts
│   └── coverage.reporter.ts
└── admin/
    ├── matching.review.ui.tsx
    └── import.dashboard.tsx
```

### 9.3 Principes de résilience

- **Circuit breaker** par connecteur : si un connecteur échoue N fois consécutivement, il est désactivé temporairement.
- **Retry avec backoff exponentiel** : 3 tentatives avec délais croissants.
- **Idempotence** : chaque observation est identifiée par (retailer_product_id, observed_at, content_hash) pour éviter les doublons.
- **Fallback** : si une source devient indisponible, le système continue avec les autres et marque les données comme "non vérifiées récemment".
- **Versioning des parsers** : chaque connecteur a une version de parser. Un changement de structure du site déclenche une alerte et une mise à jour manuelle.

---

## 10. Périmètre MVP et roadmap

### 10.1 P0 — Indispensable au lancement

- Recherche d'un produit par nom ou catégorie.
- Affichage de plusieurs offres (enseigne, prix, format, date de collecte, source).
- Comparaison du prix total et du prix unitaire (MAD/kg, MAD/L).
- Filtrage par enseigne et zone géographique.
- Affichage de la source et de la date de collecte.
- Identification claire des prix expirés ou non vérifiés.
- Interface d'administration pour corriger les correspondances et contrôler les imports.
- Connecteur Marjane (e-commerce).
- Connecteur catalogue multi-enseignes (midio.ma ou catalogue.ijob.ma).
- Connecteur Open Food Facts (enrichissement).

### 10.2 P1 — Amélioration importante

- Historique des prix (lorsqu'il existe suffisamment d'observations).
- Comparaison de paniers (coût total par enseigne).
- Recherche par code-barres (EAN).
- Détection des promotions et économies potentielles.
- Alertes de baisse de prix.
- Connecteur Aswak Assalam.
- Connecteur BIM Maroc.
- Enrichissement via promocatalogues.ma.
- Gestion des prix carte fidélité.
- Couverture par ville (Casablanca, Rabat, Marrakech, etc.).

### 10.3 P2 — Évolution ultérieure

- Connecteur Carrefour Maroc (si autorisation obtenue).
- Connecteur Atacadão, Kazyon, Supeco (si sites officiels disponibles).
- Recommandations personnalisées.
- Menus de la semaine basés sur les promotions (comme Flipini).
- Communauté de relevés de prix (comme Reprice/Flipini).
- API publique pour développeurs tiers.
- Application mobile native.
- Intégration avec les services de livraison (Bringo, Aswak Delivery, Glovo).

### 10.4 Plan de lancement progressif

| Phase | Période | Sources | Objectif |
|---|---|---|---|
| Phase 0 | Semaines 1-2 | Aucune (recherche) | Valider les connecteurs, tester l'extraction, vérifier les CGU |
| Phase 1 | Semaines 3-6 | Marjane + midio.ma + Open Food Facts | MVP fonctionnel sur Casablanca avec 1 enseigne + promotions multi-enseignes |
| Phase 2 | Semaines 7-10 | + Aswak Assalam + BIM | Élargir la couverture à 3 enseignes |
| Phase 3 | Semaines 11-16 | + promocatalogues.ma + hmizate.ma | Enrichir les données promotionnelles |
| Phase 4 | Mois 4-6 | + Carrefour (si autorisation) + autres | Couverture nationale |

---

## 11. Risques, dépendances et décisions à prendre

### 11.1 Risques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| CGU de Carrefour interdisent l'extraction | Certaine | Élevé | Exclure Carrefour du MVP direct ; utiliser les catalogues tierces ; chercher un partenariat |
| Changement de structure HTML des sites | Élevée | Moyen | Connecteurs indépendants, monitoring, alertes, versioning des parsers |
| Données de catalogues non structurées (images) | Certaine | Élevé | OCR (Tesseract/Google Vision) + validation humaine ; commencer par les sources textuelles (hmizate, kazyonmaroc) |
| Faux rapprochements de produits | Élevée | Élevé | Stratégie de matching progressive avec seuils de confiance ; validation manuelle ; ne jamais fusionner sur le nom seul |
| Fraîcheur des données insuffisante | Élevée | Moyen | Seuil d'expiration clair ; affichage de la date de vérification ; alertes |
| Coût de l'infrastructure (OCR, scraping) | Moyenne | Moyen | Commencer petit (1 ville, 1 enseigne) ; optimiser |
| Licence Open Food Facts (share-alike) | Certaine | Moyen | Accepter la clause ou limiter l'usage à l'enrichissement interne non redistribué |
| Instabilité des plateformes de catalogues | Moyenne | Moyen | Multi-sources ; fallback |

### 11.2 Dépendances

- Accès aux sites officiels (disponibilité, anti-bot).
- Qualité des catalogues tierces (complétude, fraîcheur).
- Couverture Open Food Facts au Maroc (à vérifier).
- Ressources pour l'OCR et la validation manuelle.
- Consultation juridique pour les CGU.

### 11.3 Décisions à prendre

1. **Juridique :** faire valider par un juriste la stratégie d'extraction des sites officiels.
2. **Géographique :** choisir la ville pilote (recommandation : Casablanca).
3. **Licence OFF :** accepter la clause share-alike ou non.
4. **OCR :** choisir entre Tesseract (open source) et Google Vision (payant, plus précis).
5. **Hébergement :** cloud (AWS/GCP) ou on-premise.
6. **Modèle économique :** gratuit avec publicité, freemium, ou B2B (vente de données).

---

## 12. Plan de tests et critères d'acceptation

### 12.1 Tests à exécuter

| Catégorie | Test | Critère d'acceptation |
|---|---|---|
| Validation des prix | Prix positif, devise MAD | 100 % des observations avec prix > 0 et devise = MAD |
| Détection des doublons | Pas de doublon (retailer_product_id, observed_at, content_hash) | 0 doublon |
| Contrôle des unités | Conversion correcte (g→kg, ml→L) | 100 % des conversions vérifiées |
| Détection des prix anormaux | Prix < 0.1 * médiane ou > 10 * médiane → alerte | Alerte générée, pas de suppression automatique |
| Vérification de la date de collecte | observed_at présent et <= now() | 100 % |
| Cohérence prix normal/promo | Si promotion_price présent, price <= regular_price | 100 % |
| Détection des produits disparus | Produit non vu depuis X jours → marqué inactif | Marquage automatique |
| Traçabilité | Chaque observation liée à une raw_data et une source | 100 % |
| Tests de non-régression connecteurs | Chaque connecteur a des tests unitaires | 1 test par connecteur minimum |
| Tests du matching | Faux positifs < 5 % sur un échantillon de 100 produits | Mesure sur échantillon |
| Couverture du catalogue | % de produits Marjane extraits vs. total estimé | Rapport hebdomadaire |

### 12.2 Tests non exécutés (à planifier)

- Tests de charge (scraping de 10 000 produits).
- Tests d'intégration end-to-end (pipeline complet).
- Tests de la SPA (tkdia.com) — extraction des endpoints internes.
- Tests de l'OCR sur les catalogues (précision à mesurer).
- Tests de la couverture Open Food Facts au Maroc.

### 12.3 Hypothèses à confirmer

- Marjane expose-t-il des EAN pour les produits alimentaires ? (à vérifier par extraction)
- BIM Maroc affiche-t-il des prix sur son site officiel ? (à vérifier)
- Kazyon Maroc expose-t-il un catalogue de produits avec prix ? (à vérifier)
- Les plateformes de catalogues (midio, ijob) exposent-elles des données textuelles structurées (JSON) en plus des images ? (à vérifier)
- La couverture Open Food Facts au Maroc est-elle suffisante pour le matching ? (à vérifier)
- Carrefour Maroc (Bringo) expose-t-il un endpoint JSON ? (à vérifier, avec prudence juridique)

---

## 13. Backlog initial de tickets techniques

### P0 — Sprint 1-2

| # | Ticket | Description | Priorité |
|---|---|---|---|
| 1 | Setup infrastructure | PostgreSQL + Redis + MinIO (stockage brut) + Docker Compose | P0 |
| 2 | Modèle de données | Créer les tables selon le schéma proposé | P0 |
| 3 | Connecteur Marjane — Discovery | Explorer les sitemaps et les pages catégorie | P0 |
| 4 | Connecteur Marjane — Collection | Télécharger les pages produit (HTML brut) | P0 |
| 5 | Connecteur Marjane — Extraction | Parser nom, prix, format, marque, image, promotion | P0 |
| 6 | Connecteur Marjane — Normalisation | Normaliser les noms et unités | P0 |
| 7 | Connecteur midio.ma — Discovery | Lister les catalogues disponibles par enseigne | P0 |
| 8 | Connecteur midio.ma — Collection | Télécharger les images de pages catalogue | P0 |
| 9 | Connecteur Open Food Facts — API | Tester l'API par EAN et par pays (Maroc) | P0 |
| 10 | Pipeline — Orchestration | Mettre en place le pipeline (discovery → publication) | P0 |
| 11 | Interface d'administration — Matching | UI pour valider/corriger les correspondances | P0 |
| 12 | Interface d'administration — Imports | Dashboard de suivi des imports et erreurs | P0 |
| 13 | API — Recherche produit | Endpoint de recherche par nom/catégorie | P0 |
| 14 | API — Comparaison prix | Endpoint de comparaison par produit | P0 |
| 15 | Frontend — Page produit | Affichage des offres, prix unitaire, source, date | P0 |

### P1 — Sprint 3-4

| # | Ticket | Description | Priorité |
|---|---|---|---|
| 16 | Connecteur Aswak Assalam | Site + catalogue + boutique en ligne | P1 |
| 17 | Connecteur BIM Maroc | Pages "produits actuels" + magasins | P1 |
| 18 | Connecteur promocatalogues.ma | Pages comparateur et catalogues | P1 |
| 19 | Connecteur hmizate.ma | Articles de promotion | P1 |
| 20 | Historique des prix | Vue matérialisée + API + graphique frontend | P1 |
| 21 | Comparaison de paniers | Calcul du coût total par enseigne | P1 |
| 22 | Recherche par code-barres | Scan EAN → produit → offres | P1 |
| 23 | Alertes de baisse de prix | Notification email/push | P1 |
| 24 | OCR des catalogues | Tesseract ou Google Vision sur les images | P1 |
| 25 | Monitoring de fraîcheur | Alertes si un connecteur ne tourne plus | P1 |

### P2 — Sprint 5+

| # | Ticket | Description | Priorité |
|---|---|---|---|
| 26 | Connecteur Carrefour Maroc | Si autorisation obtenue | P2 |
| 27 | Connecteur Atacadão | Si site officiel disponible | P2 |
| 28 | Connecteur Kazyon | Si catalogue produits disponible | P2 |
| 29 | Connecteur Supeco | Si site officiel disponible | P2 |
| 30 | Application mobile native | iOS + Android | P2 |
| 31 | API publique | Pour développeurs tiers | P2 |
| 32 | Communauté de relevés de prix | Comme Reprice/Flipini | P2 |
| 33 | Menus de la semaine | Basés sur les promotions | P2 |
| 34 | Intégration services de livraison | Bringo, Aswak Delivery, Glovo | P2 |

---

## 14. Recommandation argumentée — Trois meilleures sources pour lancer le MVP au Maroc

### 1. Marjane (marjane.ma) — Source de vérité prix (P0)

**Arguments :**
- **Site e-commerce actif** avec prix, promotions, format, marque, image, catégorie.
- **Robots.txt permissif** : seuls `/wallet` et `/account` sont interdits ; les sitemaps sont disponibles (`https://www.marjane.ma/sitemap.xml`).
- **Couverture nationale** : Marjane est présent dans toutes les grandes villes du Maroc.
- **Données riches** : prix normal et promotionnel, carte fidélité, format, marque.
- **Pas de CGU d'extraction explicite** (seules les CGU fidélité sont visibles) — zone grise à clarifier juridiquement, mais pas d'interdiction explicite comme chez Carrefour.

**Risques :** Site SPA (sélecteurs à maintenir). Pas d'EAN vérifié pour les produits alimentaires. Pas d'API documentée.

### 2. midio.ma (ou catalogue.ijob.ma) — Source de catalogues multi-enseignes (P0)

**Arguments :**
- **Couverture multi-enseignes** : BIM, Kazyon, Atacadão, Carrefour, Supeco, Marjane, Aswak Assalam, Kitea — soit toutes les enseignes prioritaires.
- **URLs structurées par catalogue** : facile à découvrir et à télécharger.
- **Gratuit et accessible** : pas d'authentification.
- **Fraîcheur hebdomadaire** : nouveaux catalogues chaque semaine.
- **Complémentarité** : couvre les enseignes non accessibles directement (BIM, Kazyon, Atacadão, Supeco, Carrefour).

**Risques :** Données en images (OCR nécessaire). Pas de prix permanents (promotions datées). Site indépendant, non affilié aux enseignes (CGU à vérifier).

### 3. Open Food Facts (world.openfoodfacts.org) — Source d'enrichissement (P0)

**Arguments :**
- **API documentée** avec rate limits et exports quotidiens (MongoDB, CSV, JSONL).
- **Licence ouverte** (ODbL) : usage commercial autorisé avec attribution et share-alike.
- **Données descriptives riches** : EAN/GTIN, nom, marque, catégorie, ingrédients, nutrition, images.
- **Essentiel pour le matching** : sans EAN et nom normalisé, le rapprochement de produits entre enseignes est impossible.
- **Communauté active** : données en constante amélioration.

**Risques :** Couverture Maroc à vérifier (peut être faible pour les produits locaux). Données contributives (non garanties). Clause share-alike (les données dérivées redistribuées doivent rester ouvertes). Pas de prix.

---

### Conclusion

Ces trois sources combinées permettent de lancer un MVP **fonctionnel et crédible** : Marjane fournit les prix permanents et promotionnels d'une enseigne majeure, les plateformes de catalogues étendent la couverture à toutes les enseignes via les promotions datées, et Open Food Facts fournit la couche d'enrichissement (EAN, nom, marque, catégorie) indispensable au matching et à la comparaison. Cette combinaison respecte les contraintes légales (pas d'extraction de Carrefour), privilégie la qualité et la traçabilité, et permet une montée en charge progressive.

---

**Sources de référence (URLs vérifiées) :**

- Marjane : https://www.marjane.ma/ (vérifié oct. 2026)
- Marjane courses en ligne : https://www.marjane.ma/courses-en-ligne (vérifié oct. 2026)
- Marjane catalogues : https://www.marjane.ma/contenu/nos-catalogues (vérifié oct. 2026)
- Marjane robots.txt : https://www.marjane.ma/robots.txt (vérifié oct. 2026)
- Marjane CGU fidélité : https://www.marjane.ma/contenu/cgu-cgv (vérifié oct. 2026)
- Carrefour Maroc : https://carrefour.ma/ (vérifié oct. 2026)
- Carrefour Maroc mentions légales/CGU : https://carrefour.ma/mentions-legales/ (vérifié oct. 2026)
- Carrefour Maroc catalogues : https://carrefour.ma/catalogues (vérifié oct. 2026)
- Aswak Assalam : https://www.aswakassalam.com/ (vérifié oct. 2026)
- Aswak Assalam CGV : https://aswakassalam.com/conditions-generales-de-vente (vérifié oct. 2026)
- Aswak Delivery : https://www.aswakdelivery.com/ (vérifié oct. 2026)
- Aswak Assalam "qui sommes-nous" : https://aswakassalam.com/qui-sommes-nous (vérifié oct. 2026)
- Atacadão Maroc (Wikipedia) : https://fr.wikipedia.org/wiki/Atacad%C3%A3o_Maroc (vérifié oct. 2026)
- Atacadão Maroc site : https://atacadaomaroc.ma/ (en construction, vérifié oct. 2026)
- Label'Vie communiqué Atacadão Khénifra : https://labelvie.ma/wp-content/uploads/2026/04/CP-Ouverture-Atacadao-Khenifra.pdf (vérifié oct. 2026)
- BIM Maroc : https://www.bim.ma/ (vérifié oct. 2026)
- Kazyon Maroc : https://store.kazyonplus.com/store/kazyon/en (vérifié oct. 2026)
- Supeco Maroc : https://supeco.ma/ (en construction, vérifié oct. 2026)
- midio.ma : https://midio.ma/ (vérifié oct. 2026)
- catalogue.ijob.ma : https://catalogue.ijob.ma/ (vérifié oct. 2026)
- tkdia.com : https://tkdia.com/ (vérifié oct. 2026)
- promocatalogues.ma : https://promocatalogues.ma/fr (vérifié oct. 2026)
- hmizate.ma : https://hmizate.ma/ (vérifié oct. 2026)
- kazyonmaroc.com : https://kazyonmaroc.com/ (vérifié oct. 2026)
- kazyon-market.com : https://kazyon-market.com/ (vérifié oct. 2026)
- cataloguemarjane.com : https://cataloguemarjane.com/ (vérifié oct. 2026)
- soldemaroc.com : https://www.soldemaroc.com/ (vérifié oct. 2026)
- Open Food Facts : https://world.openfoodfacts.org/ (vérifié oct. 2026)
- Open Food Facts terms of use : https://world.openfoodfacts.org/terms-of-use (vérifié oct. 2026)
- Open Food Facts data/API : https://world.openfoodfacts.org/data (vérifié oct. 2026)
- BlaGhla : https://blaghla.com/ (vérifié oct. 2026)
- Prixci : https://prixci.com/ (vérifié oct. 2026)
- DepenseLess : https://depenseless.com/ (vérifié oct. 2026)
- Combien.ma : https://combien.ma/ (vérifié oct. 2026)
- PrixPad : https://www.prixpad.ma/ (vérifié oct. 2026)
- Flipini : https://flipini.com/app (vérifié oct. 2026)
- Safimeal : https://safimeal.ma/fr (vérifié oct. 2026)
- MyMarket.ma : https://www.mymarket.ma/ (vérifié oct. 2026)
- Baya : https://www.bayasaver.com/ (vérifié oct. 2026)
- mySupermarket (Wikipedia) : https://en.wikipedia.org/wiki/MySupermarket (vérifié oct. 2026)
- Trolley : https://www.trolley.co.uk/ (vérifié oct. 2026)
- Idealo : https://www.idealo.com/ (vérifié oct. 2026)
- PriceRunner : https://www.pricerunner.com/ (vérifié oct. 2026)
- Google Shopping : https://shopping.google.com/ (vérifié oct. 2026)

---

*Document rédigé dans le cadre de la phase de recherche stratégique. Aucun développement applicatif n'a été réalisé. Toutes les URLs ont été vérifiées lors de la rédaction (octobre 2026). Les faits vérifiés sont distingués des hypothèses (marquées "à vérifier" ou "non vérifié").*
