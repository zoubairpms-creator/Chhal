# Correction de provenance des 20 prix BIM — 2026-10-17

## Constat
Les 20 prix BIM du catalogue du 1er septembre 2026 avaient été enregistrés `source = manuel`, `confiance = haute`
(affichés « Saisie administrateur »). Ils proviennent en réalité d'un **article tiers** (hmizate.ma) décrivant une
**promotion** : la provenance affichée était fausse.

## Ce qui a été fait
| Élément | Avant | Après |
|---|---|---|
| Adaptateur hmizate | `enabled: true` | `enabled: false` (décision juridique et vérifications robots.txt / conditions d'utilisation à faire) |
| Date des relevés issus d'un catalogue | date du jour de lecture | **date du catalogue** (`pages[].dateReleve`), ex. 2026-09-01 |
| Source des relevés issus d'un catalogue | `scraping` | `catalogue` (champ `source` de l'adaptateur et de `/admin/scraping/releves`) |
| 20 prix BIM | `manuel`, `haute` | `catalogue`, `moyenne`, **mêmes prix, mêmes dates** |

## Méthode (rien n'a été modifié ni supprimé)
1. Sauvegarde de la base de dev : `.data/avant-correction-provenance` (38,8 Mo, API arrêtée pendant la copie).
2. Nouveau point d'API `POST /admin/observations/recategoriser` : pour chaque prix, un **avis « rejeté »** est ajouté à l'ancienne
   observation et une **nouvelle observation identique** (même prix, même date) est créée avec la bonne source puis publiée,
   dans une seule transaction (tout ou rien). L'ancienne reste dans l'historique avec ses deux avis (publié, puis rejeté).
3. Nouveau point d'API `GET /admin/observations/publiees` (audit par source, enseigne, date) pour retrouver les prix à corriger.
4. Essai à blanc puis exécution : 20 observations sélectionnées, 20 remplacées. Contrôle : 0 prix BIM publié en `manuel`,
   20 en `catalogue` (confiance moyenne), prix publics inchangés.

## Retour en arrière
Arrêter l'API, remplacer `.data/dev` par `.data/avant-correction-provenance`, relancer. Les nouvelles observations
et leurs avis disparaissent avec cette restauration.

## Points restant ouverts
- Décision juridique sur l'usage du contenu de hmizate.ma (site tiers) avant toute réactivation.
- Les prix sont des **promotions** datées du 1er septembre : au-delà de l'âge maximum choisi (30 jours par défaut), ils sont
  signalés et exclus des paniers.
- `start-api.bat` (racine) contient le jeton administrateur en clair et n'est pas ignoré par git : à traiter par son propriétaire.
- Contact des robots : variable `SCRAPER_CONTACT` (vide par défaut) ; plus aucune adresse personnelle dans le code.
