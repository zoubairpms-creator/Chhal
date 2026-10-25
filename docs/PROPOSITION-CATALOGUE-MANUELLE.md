# Proposition manuelle de variantes — NON VÉRIFIÉE

> **Ces 50 lignes viennent de la connaissance générale de Claude. Aucune n'a de source.**
> Elles peuvent contenir des marques ou des formats qui n'existent pas au Maroc. Rien n'est importé : à vérifier en magasin, ligne par ligne.

Fichier : `docs/catalogue-proposition-manuelle.csv` (Excel, séparateur « ; », UTF-8). Aucun code-barres, aucune photo.

## Contenu (50 lignes, 19 familles)
Sucre 3 · Riz 4 · Farine 3 · Huile de table 8 · Huile d'olive 3 · Lentilles 2 · Pois chiches 2 · Haricots 2 · Thé 4 · Beurre 3 · Confiture 1 ·
Vermicelles 1 · Lessive 3 · Liquide vaisselle 1 · Eau de Javel 1 · Savon 3 · Dentifrice 3 · Shampoing 2 · Papier toilette 1.

## Comment lire les colonnes
| Colonne | Sens |
|---|---|
| `statut` | `NON_VERIFIE` sur toutes les lignes |
| `confiance_marque` | Ma certitude que la **marque** existe au Maroc : haute (très répandue), moyenne (plausible), basse (incertain) |
| `confiance_format` | Ma certitude que ce **format** existe pour cette marque |
| `indice` | D'où vient l'idée : « connaissance générale de Claude (aucune source) » ou un indice précis (ex. une fiche incomplète d'Open Food Facts) |
| `remarque` | Pièges connus : doublon avec un produit sans marque déjà au catalogue, marque utilisée dans nos données fictives, etc. |
| `valider`, `verifie_le`, `enseignes_vues` | **Vides : à remplir par vous** |

Les marques entre parenthèses, « (à préciser : marque lue en magasin) », sont des **emplacements** : farine, lentilles, pois chiches,
haricots, et une ligne de riz de marque distributeur. Je n'ai retenu aucune marque de farine avec une confiance suffisante.

## Points d'attention
- **Marques à confiance « haute »** : Cosumar (sucre), Lesieur (huile), Lipton, Ariel, Tide, Omo, Colgate, Signal, Dove, Head & Shoulders, Lux, Palmolive.
  Même celles-ci : vérifiez le **format** (1 L, 5 kg, 75 ml…), c'est là que je me trompe le plus souvent.
- **Marques à confiance « basse »** : Huilor, Jibal, Sultan, Centrale 250 g, Savon Lux et Palmolive (formats). « Sultan » apparaît aussi dans nos
  données de démonstration fictives : ne la tenez pas pour confirmée.
- **Doublons avec le catalogue de base** : « Sucre en morceaux 1 kg » et « Lessive en poudre 3 kg » existent déjà **sans marque**. L'import crée
  une nouvelle fiche avec marque ; pensez à retirer l'ancienne ou à la rapprocher.
- Les produits de dinde et la harissa (BIM) ne sont pas repris : ils existent déjà, sans marque, dans le catalogue issu du catalogue BIM.

## Procédure de validation
1. En magasin, pour chaque ligne : le produit existe-t-il avec **cette marque** et **ce format** ? Corrigez la marque, le nom ou le format dans le CSV si besoin.
2. Si oui : `valider` = `oui`, `verifie_le` = la date du jour de la vérification (`2026-10-18`), `enseignes_vues` = où vous l'avez vu.
3. Sinon : `non`, ou laissez vide.
4. Emplacements « (à préciser…) » : remplacez par la marque lue en magasin ; sinon la ligne est refusée.

## Import (après vérification)
Essai à blanc, qui n'écrit rien :
```bash
corepack pnpm --filter @chhal/scraper off:import -- --manuel
```
Import réel :
```bash
corepack pnpm --filter @chhal/scraper off:import -- --manuel --confirm
```

Garde-fous : une ligne « oui » sans `verifie_le` (date valide, pas dans le futur), ou avec une marque encore « (à préciser…) », est **refusée** ;
tout ou rien ; une fiche de même marque, même nom et même format est ignorée (insensible à la casse) ; les fiches sont enregistrées avec
l'origine `manuel`, sans code-barres ni photo. Le fichier tel que généré n'importe donc **rien**.

## Régénérer le fichier
```bash
corepack pnpm --filter @chhal/scraper manuel:proposition
```
Attention : cela réécrit le CSV et efface vos saisies. Faites d'abord une copie du fichier que vous avez rempli.
