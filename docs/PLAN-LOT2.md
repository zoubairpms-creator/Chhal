# Plan Lot 2 — Corrections, nouvelle interface, top 3, paniers prédéfinis

Statut : **à approuver par écrit. Aucun code avant validation.**

## 0. Corrections (Full stack, puis QA vérifie)
- D1/S1 : enregistrer le limiteur avant les routes (`await` sur le plugin).
- D2/D3 : limites de débit sur `POST /paniers` (par ex. 20/heure) et `/paniers/optimiser` (par ex. 60/minute).
- S2/S3 : `trustProxy` configurable, CORS obligatoire en production (refus de démarrer sans `CORS_ORIGIN` si `NODE_ENV=production`).
- D4 : refuser plus de 2 décimales sur les prix.
- S5 : en-têtes de sécurité de base (API et Next).
- Les marques `it.fails` correspondantes sont retirées : les tests doivent passer au vert.
- S4 (Turnstile) : dépend de votre compte Cloudflare ; reporté, signalé.

## 1. Nouvelle interface (Designer + Full stack)
Constat : l'interface actuelle demande trop d'étapes (taper, choisir la ville, cliquer Rechercher, ajouter, calculer).

| Aujourd'hui | Proposition |
|---|---|
| Recherche après clic sur un bouton | **Recherche en direct** dès 2 lettres, avec suggestions |
| Ville à choisir à chaque fois | **Ville mémorisée** (Casablanca par défaut), changement en un geste |
| Liste de textes | **Cartes produit** avec photo-icône par catégorie et raccourcis (Épicerie, Frais, Boissons, Ménage) |
| Ajout au panier puis page panier | **Bouton +/− direct** sur chaque carte, **barre de panier fixe** en bas (nombre d'articles, total estimé) |
| Calcul sur clic | **Calcul automatique** à chaque changement ; options (magasins max, exclusions, âge) repliées sous « Options » |
| Chargement en texte | **Squelettes de chargement** et message clair si le serveur démarre |
| Page dense | **Mobile d'abord**, grandes zones tactiles, texte lisible, darija en RTL soigné |

## 2. Top 3 des meilleurs résultats
- **Par produit** : en haut, un **podium** des 3 enseignes les moins chères (rang, enseigne, prix, **écart en % face à la plus chère**, date, source). Les autres enseignes sont repliées sous « Voir toutes ».
- **Dans les résultats de recherche** : chaque carte montre ses 3 meilleurs prix (changement additif de l'API : champ `top3` en plus de `meilleurPrix`).
- **Pour un panier** : **3 options côte à côte** : « Un seul magasin », « 2 magasins », « Optimal (sans limite) », avec total, économie et nombre de magasins ; l'utilisateur choisit sans régler de paramètres.

## 3. Paniers prédéfinis
Pages « Paniers prêts » : un clic charge le panier, puis le calcul se fait seul.

| Panier | Contenu |
|---|---|
| **Essentiel** | Une vingtaine d'articles de base (riz, sucre, huile, farine, lait, thé, œufs, pâtes, conserves, eau, savon, lessive…) |
| **Mensuel Budget serré** | Quantités mensuelles pour un ménage de référence |
| **Mensuel Classe moyenne** | Idem, plus de variété (viandes, laitages, produits d'entretien) |
| **Mensuel Aisé** | Idem, plus de produits de marque et de produits frais |

Je propose des noms neutres (« Budget serré », « Classe moyenne », « Confort ») ; vous pouvez garder « pauvre / moyenne / riche » si vous préférez.

**Points d'attention (à valider par vous) :**
1. **Composition et quantités = hypothèses de départ, pas des statistiques.** Je ne les présenterai pas comme officielles. Pour les fonder sur des données, il faut les rapprocher de l'enquête de consommation des ménages du HCP (Maroc), que je n'ai pas encore consultée ; je peux le faire en recherche web, avec votre validation de la liste finale.
2. **Taille du ménage de référence** : je propose 4 personnes. À confirmer.
3. **Catalogue insuffisant** : il n'y a que 11 produits. Les paniers prédéfinis exigent un catalogue de 60 à 100 produits (phase 0bis, avec alias FR/AR/EN) et des prix. **Sans prix réels, un panier prédéfini s'affiche vide ou en données de démonstration.**
4. **Changement de schéma (arrêt obligatoire)** : ajouter `products.slug` (clé stable, unique) pour que les paniers référencent les produits sans ambiguïté, et une table `preset_baskets` (slug, profil, nom et description par langue, lignes). Alternative sans migration : paniers définis dans le code, résolus par alias (plus fragile). **Je recommande la migration.**

## 4. Tests prévus
- QA d'abord : `top3` (égalités, moins de 3 enseignes, une seule), 3 options de panier (cohérence des totaux, économie ≥ 0), chargement d'un panier prédéfini (articles manquants signalés), limites de débit (429), 2 décimales.
- Interface : navigation clavier, mobile 375 px, arabe en RTL, lecteur d'écran sur les cartes et la barre de panier.
- Non-régression : 66 tests actuels + défauts D1 à D4 au vert.

## 5. Ordre d'exécution
1. Corrections (lot 0) puis revue QA/Sécurité.
2. Top 3 (API additive, puis interface).
3. Nouvelle interface (recherche en direct, barre de panier, calcul automatique).
4. Paniers prédéfinis : après validation du schéma et du catalogue.

## 6. Questions pour vous
1. Approuvez-vous le plan, dont la migration `products.slug` + `preset_baskets` ?
2. Noms des profils : neutres, ou « pauvre / moyenne / riche » ?
3. Ménage de référence : 4 personnes ?
4. Autorisez-vous la recherche web du catalogue et des habitudes de consommation (HCP) pour fonder les paniers ?
