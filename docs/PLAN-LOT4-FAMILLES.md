# Plan Lot 4 — Familles de produits, variantes regroupées et lignes « n'importe quelle marque »

Statut : **à approuver par écrit. Aucun code avant validation.** Rédigé le 2026-10-17.

## 1. Ce que l'utilisateur verra

**Recherche.** Taper « huile » (ou « زيت », ou « zit ») affiche **une carte « Huile de table »** et non douze fiches mélangées :
nombre de variantes, meilleur **prix au litre** avec l'enseigne et la marque, puis les variantes dépliables (marque, format, prix, photo).
Les produits sans famille restent des cartes isolées, comme aujourd'hui.

**Panier.** Deux types de lignes :
- **Précise** (existante) : « Huile Lesieur 1 L × 2 ».
- **Famille** (nouvelle) : « Huile de table, **3 L**, n'importe quelle marque ». Le calcul choisit, **dans chaque magasin**, la variante la moins chère
  pour cette quantité. Le plan affiche la marque retenue, le nombre de paquets, la quantité réellement achetée et le surplus éventuel.

## 2. Règles de calcul d'une ligne famille

Pour une ligne « famille F, quantité Q (kg, L ou pièces) », ville V, magasin S :
1. Candidats : les variantes de F ayant un prix **publié, récent** (âge maximum de l'utilisateur) en S, hors enseignes exclues.
2. Pour chaque variante, **paquets = ⌈ Q ÷ taille du format ⌉** et **coût = paquets × prix du paquet**. On achète des paquets entiers : pas de fraction.
3. On retient le coût le plus bas ; **égalité** : surplus le plus faible, puis identifiant de produit le plus petit (déterminisme).
4. **Une seule variante par magasin et par ligne** en v1 (pas de mélange « 5 L + 2 × 1 L »).
5. Aucune variante avec prix récent en S : la ligne est **introuvable dans ce magasin** ; introuvable partout : signalée et exclue du total, comme aujourd'hui.

Exemple : 5 L d'huile. Variante A 1 L à 20 MAD → 5 paquets = 100 MAD. Variante B 5 L à 92 MAD → 1 paquet = 92 MAD. B gagne.
Variante C 2 L à 38 MAD → 3 paquets = 114 MAD pour 6 L (surplus de 1 L, affiché).

**Intégration sans toucher à l'optimiseur.** Avant le calcul, chaque ligne famille est convertie en un **article virtuel** dont le prix par magasin est le coût
de la meilleure variante. L'optimiseur (pur, version 1.0.0, 9 tests) reste **inchangé** et traite lignes précises et lignes famille ensemble ;
la sortie est enrichie après coup (variante retenue). La résolution est versionnée séparément (`familles-1.0.0`) et la **variante retenue est figée dans le panier
enregistré** : un lien partagé reste reproductible.

## 3. Modèle de données (changement de schéma : votre accord)

| Changement | Détail |
|---|---|
| **Table `families`** | `slug` (clé), `nom` {fr, ar, en}, `categorie`, `classe` (`masse`, `volume`, `piece`), `alias` [{texte, langue}] |
| `products.famille` | Devient une référence vers `families.slug` (colonne existante, aujourd'hui du texte libre et souvent vide) |
| Rattrapage des produits existants | Chaque produit du catalogue actuel reçoit sa famille (tableau en annexe A) ; les produits ambigus restent **sans famille** |
| Paniers enregistrés | **Aucune migration** : `items` accepte déjà du JSON ; les anciens paniers restent valides |
| Paniers prédéfinis | `lignes` accepte aussi `{famille, quantiteBase, unite}` en plus de `{slug, quantite}` |

**Contrainte de cohérence** : toutes les variantes d'une famille ont la **même classe** de format. Une variante d'une autre classe (ex. une bouteille en grammes dans une famille « volume ») est **refusée** à l'import.
Les noms et alias de famille en trois langues (+ arabizi) servent à la recherche : « zit » trouve la famille Huile de table même si aucun nom de variante ne contient « zit ».

## 4. API (ajouts, compatibles avec l'existant)

- `GET /produits` : réponse **inchangée** (`resultats`) **plus** `groupes` : `[{ famille, nom, classe, nbVariantes, meilleurPrixUnitaire:{ enseigne, marque, produit, prix, par }, top3, variantes:[…] }]` et `isoles`.
- `GET /familles` : liste (noms, classe, nombre de variantes avec prix dans la ville).
- `POST /paniers/optimiser`, `/paniers/comparer`, `/paniers`, `/rapports/panier` : `articles` accepte `{produitId, quantite}` **ou** `{famille, quantiteBase, unite}` ; réponses enrichies (`choix`, `nbPaquets`, `quantiteAchetee`, `surplus`).
- Validation : `unite` doit correspondre à la classe de la famille (kg ou l selon le cas) ; quantité de 0,1 à 99 ; limites de débit inchangées.
- Rapport PDF : une section « Variantes retenues par magasin » pour chaque ligne famille.

## 5. Interface

- Carte famille dans la recherche (prix au kg ou au litre, variantes dépliables), bouton **« Ajouter, n'importe quelle marque »** avec quantité par pas de 0,5 (kg/L).
- Dans le panier : ligne famille repérable (icône et mention « n'importe quelle marque »), lien **« Choisir une marque précise »** qui la remplace par une ligne précise.
- Photos et mentions de licence conservées sur les variantes ; arabe de droite à gauche vérifié.

## 6. Tests prévus (QA écrit d'abord)

- **Regroupement** : variantes d'une même famille réunies ; produits sans famille isolés ; famille trouvée par nom, alias arabe, darija et arabizi ; classe incohérente refusée.
- **Prix au kg/L** : tri correct entre formats différents (500 g, 1 kg, 5 kg).
- **Ligne famille** : paquets entiers, surplus, égalités (déterminisme), prix périmés écartés, enseignes exclues, aucune variante → exclue ; **recalcul indépendant par force brute** du total d'un panier mixte (précis + famille).
- **Reproductibilité** : même entrée, même sortie ; panier enregistré relu à l'identique.
- **Compatibilité** : tous les anciens corps de requête et paniers enregistrés restent acceptés ; les 186 tests actuels restent verts.
- **Prédéfinis** : conversion des lignes de base en lignes famille ; articles sans variante tarifée signalés.
- **Interface** : mobile 375 px, clavier, arabe RTL ; lecteur d'écran sur les cartes famille.
- **Sécurité** : validation des entrées (quantités, familles inconnues), pas de fuite de données de test, limites de débit.

## 7. Ordre d'exécution

1. Migration `families` + rattrapage + semis des familles (**arrêt : migration sur la base de dev, sauvegarde préalable**).
2. API de recherche groupée et `/familles`.
3. Résolution des lignes famille + intégration au panier, aux paniers enregistrés et au rapport.
4. Conversion des paniers prédéfinis.
5. Interface.
6. Revue QA et Sécurité, rapport, verdict.

## 8. Risques et limites

- **Les familles restent vides de prix tant qu'il n'y a pas de relevés** : aujourd'hui seuls les 20 prix BIM (catalogue), le beurre et des données fictives existent.
  La fonctionnalité sera correcte et testée avec des jeux de test, mais sa valeur visible dépend de vos relevés.
- **Paquets entiers** : le calcul peut préférer un grand format (surplus). C'est affiché ; la quantité réellement achetée est toujours montrée.
- **Granularité des familles** (ex. « pâtes » regroupe spaghetti et macaronis) : à valider avec l'annexe A ; une famille trop large compare des produits non équivalents.
- **Pas de mélange de variantes** dans un même magasin en v1.
- **Rattrapage** : le tableau ci-dessous est une proposition ; une erreur de famille fausserait la comparaison.

## 9. Décisions demandées

1. **Calcul par paquets entiers** (recommandé) plutôt que prix au kilo multiplié par la quantité (qui suppose qu'on peut acheter une fraction) ?
2. **Une seule variante par magasin et par ligne** en v1 (recommandé) ?
3. **Table `families`** avec noms en trois langues et alias, et le **rattrapage** de l'annexe A : approuvés ?
4. **Convertir les lignes de base des paniers prédéfinis** (riz, sucre, huile, farine, lentilles, etc.) en lignes famille (recommandé) ?
5. Souhaitez-vous aussi **exclure des marques** (en plus des enseignes) dès la v1 ? Je recommande de le reporter.

## Annexe A — familles proposées pour le rattrapage (classe de format)

| Famille | Classe | Produits actuels rattachés |
|---|---|---|
| Riz, Sucre, Farine, Semoule, Couscous, Pâtes, Vermicelles, Sel, Lentilles, Pois chiches, Haricots | masse | « Riz long grain 1 kg », « Sucre en morceaux 1 kg », « Farine de blé 5 kg », etc. |
| Huile de table, Huile d'olive | volume | « Huile de table 1 L », fiches du catalogue |
| Thé, Café, Confiture, Miel, Olives, Concentré de tomate, Harissa, Biscuits, Chocolat | masse | produits du catalogue et du catalogue BIM (ex. « Harissa Oualili ») |
| Lait, Jus, Boisson gazeuse, Eau | volume | « Lait demi-écrémé 1 L », « Eau minérale 1,5 L », boissons BIM |
| Beurre, Margarine, Fromage, Yaourt | masse (yaourt : pièce) | « Beurre Centrale 1 kg », « Margarine Luxmar 450 g » |
| Œufs, Papier toilette | pièce | « Œufs plateau de 30 », « Papier toilette 12 rouleaux » |
| Lessive, Liquide vaisselle, Eau de Javel, Savon, Dentifrice, Shampoing | masse / volume | produits d'entretien et d'hygiène |
| Fruits et légumes frais | masse | « Pommes de terre 1 kg », « Tomates 1 kg », etc. |

Les produits qui ne rentrent clairement dans aucune famille (ex. « Cake Massimo Swiss Roll », « Tic Tac ») restent **sans famille**.
