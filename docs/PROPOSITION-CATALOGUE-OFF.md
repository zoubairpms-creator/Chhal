# Proposition de catalogue enrichi — Open Food Facts (à valider avant import)

Générée le 2026-10-17. **Rien n'a été importé dans le catalogue.** Fichiers :
`docs/catalogue-proposition-off.csv` (à relire dans Excel) et `docs/catalogue-proposition-off.json` (détail, rejets et raisons).

## Chiffres
| | |
|---|---|
| Familles recherchées | 40 |
| Variantes proposées (marque + format + code-barres) | **270** |
| dont « oui » (fiche complète, importable telle quelle) | **98** |
| dont « a_revoir » (à regarder avant de passer à « oui ») | 172 |
| Photos disponibles (hébergées par Open Food Facts) | 235 sur 270 |
| Fiches écartées automatiquement | 737 (raison indiquée pour chacune dans le JSON) |

Raisons d'écart : pas de marque (231), hors famille (223), format absent (143), nom suspect (54), code-barres non EAN-13 (22), doublon (18),
format incohérent (14), code-barres invalide (13), hors alimentaire (9), code interne de magasin (6), plafond de 25 par famille (4).

## Limite importante : les produits de base sont absents
Open Food Facts ne contient presque aucun produit marocain **de base** correctement renseigné :
- **Aucune variante** pour : Riz, Sucre, Farine, Huile de table, Huile d'olive, Lentilles, Pois chiches, Harissa, Charcuterie de dinde.
- **Une ou deux seulement** pour : Semoule, Vermicelles, Thé, Sel, Haricots, Thon, Confiture, Lait en poudre, Fromage, Lben et raïb, Crème fraîche.
- Bien couverts : jus, café, céréales, ketchup et mayonnaise, biscuits, pâtes, concentré de tomate, miel, lait, boissons gazeuses, eau.

Or ce sont justement les produits des paniers prédéfinis. Pour ceux-là, il faudra une autre source (relevés en magasin, photos prises par
les utilisateurs, liste de marques validée par vous). Je n'ai rien inventé pour combler ces trous.

## Comment valider
1. Ouvrez le CSV dans Excel (séparateur « ; », encodage UTF-8).
2. Colonne `valider` : `oui` = sera importé ; `non` ou `a_revoir` ou vide = ignoré.
3. Colonne `drapeaux` : `hors_611` (code-barres non marocain, produit importé), `sans_image`, `nom_court`,
   `format_lu_dans_le_nom` (format absent du champ dédié, lu dans le nom), `marque_suspecte`.
4. Vérifiez surtout : la **famille** correspond-elle au produit ? la **marque** et le **format** sont-ils exacts ?

La recherche d'Open Food Facts est large : j'ai ajouté des filtres de pertinence (une eau de table n'est plus classée en huile), mais
**une relecture humaine reste nécessaire**.

## Importer (après validation)
Essai à blanc (n'écrit rien) :
```bash
corepack pnpm --filter @chhal/scraper off:import
```
Import réel :
```bash
corepack pnpm --filter @chhal/scraper off:import -- --confirm
```
L'import est tout ou rien, ignore les codes-barres déjà connus, refuse les photos hors `images.openfoodfacts.org` (HTTPS) et conserve la
mention de licence de chaque photo.

## Licence et attribution (décision juridique à vous)
- Base : ODbL ; contenus : DbCL ; **photos : CC BY-SA** (attribution obligatoire, partage à l'identique pour les adaptations).
- L'interface affiche « Photo : Open Food Facts, CC BY-SA » et un lien vers la fiche d'origine sous chaque photo.
- Avant toute publication : faire confirmer si fusionner ces données dans notre catalogue impose de partager celui-ci sous les mêmes conditions (ODbL).
- Les photos sont chargées depuis les serveurs d'Open Food Facts (pas de copie chez nous). Une photo absente ou en erreur est remplacée par une icône de catégorie.

## Ce qui a été fait côté code
- Migration 0004 : `products.famille`, `image_url`, `image_credit`, `origine` (additive, sauvegarde `.data/avant-migration-0004`).
- API : `famille` et `image` dans les recherches, fiches et rapports ; point d'import validé `POST /admin/catalogue/import`.
- Interface : photo (ou icône) sur les cartes et la fiche produit, mention de licence.
- Collecte : 1 requête toutes les 7 s, cache de 7 jours (la proposition se régénère hors ligne), arrêt si le service refuse ou reste indisponible.
- `SCRAPER_CONTACT` n'est pas renseigné : le User-Agent des requêtes indique « non configuré ». Renseignez-le dans `.env` si vous voulez
  qu'Open Food Facts puisse vous contacter.

## Pas encore fait
- Regroupement des variantes dans la recherche (affichage par famille) et lignes de panier « n'importe quelle marque » : prévus, non construits.
- Photos des produits de base et des enseignes de hard-discount : aucune source libre trouvée.
