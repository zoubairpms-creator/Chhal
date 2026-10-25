> Actualisation du deploiement : lire docs/DEPLOIEMENT-PREVERSION-2026-10-25.md. Neon chhal-preview est initialise (0000-0007, 52 produits, 4 paniers, zero prix). Render/Cloudflare non deployes ; la base locale reste intacte.

# Passation Claude — Chhal V1 — 25/10/2026

Reprendre dans C:\Users\anass\Desktop\projet. Application de comparaison de prix, indépendante de PROCURA. Lire docs/RAPPORT-V1-CHATGPT.md avant toute modification. Le porteur a validé le scope V1.

## Code livré
- Prix utilisables unifiés ; promotions futures/inconnues exclues, anciens prix hors limite exclus, offre actuelle conservée si une future existe.
- Traçabilité publique (URL, collecte, validité connue/estimée), contrôle EAN + format.
- Ingestion transactionnelle tracée obligatoire, source active et donnée brute cohérente, doublons protégés.
- Appariements incertains avec payload complet ; choix humain du produit et publication unique.
- Accueil offres actuelles, filtres, recherche EAN, favoris nommés, mode courses à cocher, budget, partage daté et recalcul séparé.
- Administration des files, sources, collectes, couverture.
- Cache hors ligne daté, six heures maximum et même jour au Maroc ; prix expirés refusés.
- Workflow hmizate v2 manuel, essai à blanc par défaut, aucun cron.

## Vérification
358 tests locaux PASS (11 matching, 10 optimizer, 4 i18n, 40 web, 90 scraper, 200 API, 3 diagnostic). 3 tests OFF en direct SKIPPED. Typecheck et build Next PASS ; Drizzle check PASS. Voir le rapport pour les limites : tests en mémoire, recette navigateur indisponible, Neon/Workers non vérifiés.

## À terminer sans refaire le travail
1. **Migration 0007 non appliquée sur la base existante.** Arrêter l'API, sauvegarder la bonne base, vérifier la sauvegarde et obtenir la validation avant application. La CLI exige --confirm ; l'API refuse désormais un schéma ancien sans le modifier.
2. Le porteur doit renseigner SCRAPER_CONTACT (contact dédié public). Premier essai à blanc : trois requêtes, BIM seulement. Import réel distinct après revue.
3. Installer OpenNext/Wrangler approuvés depuis un environnement avec accès npm, puis script setup-cloudflare.mjs et build Worker. Ne pas inventer un lockfile ou un succès de build Worker.
4. Configurer Neon/API gratuite et tester PostgreSQL réellement après accord sur la cible.
5. Recette dans un navigateur réel : FR/ar/EN, mobile/RTL, offres vides et futures, favoris/rechargement, budget partiel, checklist, validation d'un candidat, partage/recalcul et cache expiré.
6. Déploiement seulement après validation. Aucun commit/push sans demande.

## Règles conservées
Observations append-only ; corrections par avis + nouvelle observation. Aucun prix inventé. Aucun secret demandé dans le chat ou inscrit dans le dépôt. Ne pas modifier .env pour choisir un contact à la place du porteur. BIM prioritaire ; Carrefour exclu de la collecte. Aucun accès au tunnel d'un autre projet. Les anciens candidats sans payload demandent un réimport, jamais une reconstitution inventée.
