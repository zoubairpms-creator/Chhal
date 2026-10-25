# Rapport Lot 2 — Corrections, nouvelle interface, top 3, paniers prédéfinis

Date : 2026-10-17. Verdict : **PASS WITH ACTIONS**.

## Fait

| Bloc | Contenu | Preuve |
|---|---|---|
| Corrections Lot 1 | D1 (limiteur enregistré trop tard), D2/D3 (limites sur `/paniers`, `/paniers/optimiser`, `/paniers/comparer`), D4 (2 décimales), S2 (`trustProxy`), S3 (production refuse de démarrer sans `CORS_ORIGIN` ou avec `ALLOW_TEST_DATA=1`), S5 (en-têtes de sécurité API et Next, HSTS en production) | 18 tests QA verts, dont 7 qui verrouillent les corrections (D1 à D4, S2, S3, S5) |
| Top 3 | `top3`, `nbEnseignes`, `rang`, `ecartVsPlusCherPct` dans l'API ; podium 🥇🥈🥉 sur chaque carte et sur la fiche produit | 4 tests ; vérifié dans le navigateur (−30,5 % pour Al Hari) |
| 3 options de panier | `POST /paniers/comparer` : un seul magasin / 2 magasins / optimal, couverture et total par option, option recommandée | 3 tests ; vérifié dans le navigateur |
| Nouvelle interface | Recherche en direct (dès 2 lettres), catégories, ville mémorisée, quantité +/− sur chaque carte, barre de panier fixe, calcul automatique, options repliées, squelettes de chargement, focus visible, mobile d'abord | Build + navigateur |
| Catalogue proposé | 52 produits génériques sans marque, alias FR/AR/darija/EN, aucun prix | 4 tests d'intégrité |
| Paniers prédéfinis | Essentiel (18 articles), Budget serré (25), Classe moyenne (40), Confort (41), ménage de 4 ; page « Paniers prêts », chargement en un clic | 4 tests API ; vérifié dans le navigateur |
| Migration | `products.slug` (rattrapage des lignes existantes puis NOT NULL, unique) et table `preset_baskets` | Migration appliquée sur la base de dev existante, rechargée proprement |

Tests : **87 PASS** (matching 10, optimizer 9, i18n 4, web 3, scraper 7, api 54). Aucun échec, aucun test ignoré.

## Recherche web (HCP) : ce qui est établi et ce qui ne l'est pas

Retenu : l'alimentation pèse **38,2 %** du budget des ménages en 2022 (37 % en 2014) ; environ **50 %** pour les ménages les plus modestes et environ **30 %** pour les plus aisés ; dépense annuelle moyenne par ménage **83 713 MAD** (95 386 en ville, 56 769 en milieu rural). Repère lait : environ 23,7 L par ménage et par mois hors Ramadan (autre source : 15,8 L).

**Non trouvé** : les quantités par produit et par niveau de vie (le site Ledesk a répondu 403, je n'ai pas contourné). **Les quantités des paniers sont donc des hypothèses de départ**, signalées comme telles dans l'API et dans l'interface. Elles ne sont pas des statistiques officielles.

Sources : [Hespress — enquête HCP](https://fr.hespress.com/373784-373784.html), [FNH — dépenses des ménages](https://www.fnh.ma/article/actualite-economique/hcp-depenses-menages-maroc), [Bladi — consommation](https://www.bladi.net/marocains-pain-the.html), [Le360 — dépenses +50 % en 10 ans](https://fr.le360.ma/societe/depenses-des-menages-marocains-50-en-10-ans-31511/).

## Actions restantes
1. **Valider le catalogue et les paniers** (`packages/db/src/catalogue.ts`) : produits, quantités, noms des profils. Rien n'est destiné à la production avant votre validation.
2. **Aucun prix pour 42 des 52 produits du catalogue** : sur le panier Essentiel, 8 articles sur 18 ont un prix (démo fictive). Sans vrais relevés, les paniers prédéfinis restent largement vides ; l'interface le signale article par article.
3. **Neon jamais testé** (pas de `.env`). Migration 0003 jouée sur PGlite uniquement.
4. **Rôles non indépendants** : QA, Sécurité et full stack ont été joués dans la même session. Une revue indépendante (sous-agent ou humain) reste souhaitable avant la production.
5. **Non traité** : Turnstile (S4), CSP stricte, test de charge, accessibilité vérifiée au lecteur d'écran (seuls les attributs ARIA et le focus sont en place), tests d'interface automatisés (seul le client API est testé côté web).
6. **Écarts à la méthode** : j'ai supprimé trois scripts temporaires de correction que j'avais créés moi-même (`patch_*.py`) sans demande préalable. Marques de produits dans les fixtures (Lesieur, Ariel, etc.) : données fictives, à ne pas prendre pour des relevés.

## Prochaine étape proposée
Vous validez le catalogue et les paniers, puis on saisit de vrais prix pour 10 à 20 produits afin que les paniers prêts donnent un résultat réel.
