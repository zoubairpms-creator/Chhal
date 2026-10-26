# Chhal - passation du deploiement en ligne - 26 octobre 2026

Etat : sources V1 et outils Cloudflare prepares sur GitHub ; tests et build Worker PASS. API Render et site public Cloudflare non deployes.

## Depot et preuve
- Depot PRIVE : https://github.com/zoubairpms-creator/Chhal
- Branche : main.
- Commit source importe et verrou de dependances : 19923299c0e29e3be5eb8ccff21e136c9be9726c.
- Verification reussie : https://github.com/zoubairpms-creator/Chhal/actions/runs/40242013802
- Job : https://github.com/zoubairpms-creator/Chhal/actions/runs/40242013802/job/121315638409
- Duree totale : 2 min 10 s. Suite hors reseau PASS, build Next/OpenNext PASS, enregistrement des sources PASS.
- Versions du build : Node 24, Next 16.4.2, @opennextjs/cloudflare 1.20.13.
- Le premier essai 40241726068 a echoue sur ERR_PNPM_IGNORED_BUILDS. Correction ciblee : allowBuilds pour esbuild, workerd et sharp ; aucune autorisation globale de tous les scripts.

Le connecteur GitHub utilise encore zoubairanass et retourne 404 sur ce depot de zoubairpms-creator. La session navigateur du proprietaire a permis l'import autorise et l'execution en ligne. Ne pas utiliser PROCURA ou le depot de carte de visite.

## Initialisation du code
L'archive historique Chhal_V1_Code_Passation_2026-10-25.zip a ete envoyee dans le depot. Le workflow manuel .github/workflows/bootstrap-v1.yml :
1. Controle le SHA-256 de l'archive et chaque fichier de son manifeste.
2. Restaure les sources sans base ni secret et sans ecraser un projet deja initialise.
3. Installe les dependances verrouillees et les deux outils Cloudflare approuves.
4. Execute scripts/setup-cloudflare.mjs, la suite hors reseau et le build Worker.
5. Enregistre les sources, pnpm-workspace.yaml, les dependances web, le verrou et open-next.config.ts dans main.

ATTENTION : ce bootstrap est a usage unique. Il refuse volontairement de fonctionner lorsque les sources sont deja presentes. Les workflows ci.yml et scrape.yml de l'archive n'ont pas ete restaures par le jeton du job : ne pas pretendre que des tests a chaque push ou une collecte planifiee sont actifs.

Le depot distant contient maintenant la configuration Cloudflare construite. Ces modifications de dependances n'ont pas ete rapatriees dans le dossier Windows, dont les outils OpenNext/Wrangler restent absents. Repartir du commit distant avant toute modification du verrou ; ne pas reinjecter le vieux verrou de l'archive. Le telechargement navigateur du depot a ete tente mais n'a pas ete confirme.

## Neon deja pret
Voir docs/DEPLOIEMENT-PREVERSION-2026-10-25.md :
- projet chhal-preview : fragrant-wave-60417309 ; AWS Francfort ; offre free_v3 ;
- branche preview : br-orange-haze-b9wrv52x ; base chhal ;
- migrations 0000 a 0007 appliquees sur cette base neuve et journal verifie ;
- 52 produits, 208 alias, 61 familles, 4 paniers ; zero prix et zero source active ;
- les deux triggers append-only sont actifs.
La base locale .data/dev n'a pas ete migree. Sa migration 0007 reste soumise a arret, sauvegarde et validation.

## Blocages de publication
- L'onglet Cloudflare affiche https://dash.cloudflare.com/login.
- L'onglet Render affiche https://dashboard.render.com/login.
- Le connecteur Render fonctionne dans l'espace My Workspace, tea-dbf7nb29lscs73941so0, confirme par le porteur. Aucun service Chhal n'est cree.
- Le porteur doit terminer les connexions et, si demande, lier ce nouveau depot GitHub aux hebergeurs. Ne pas creer un nouveau compte ou accepter des conditions a sa place. Aucun mot de passe ou jeton a demander dans le chat.

## Suite concrete
1. Reprendre les onglets deja ouverts apres connexion du porteur.
2. Configurer le projet Cloudflare Worker chhal-web depuis le bon depot GitHub, offre gratuite, racine du monorepo.
3. Build : corepack pnpm --filter @chhal/web build:worker. Commande de publication depuis apps/web : corepack pnpm exec opennextjs-cloudflare deploy. Verifier les commandes proposees par le tableau de bord avant validation.
4. Relever l'origine workers.dev exacte pour CORS_ORIGIN.
5. Deployer chhal-api sur Render free, region Francfort, depuis main et render.yaml. Variables securisees : DATABASE_URL Neon avec pool, ADMIN_TOKEN fort, CORS_ORIGIN exacte, NODE_ENV=production, TRUST_PROXY=1. Omettre ALLOW_TEST_DATA.
6. Configurer API_INTERNAL_URL sur le Worker avec l'origine HTTPS Render, puis verifier /health, /ready et les parcours via /api-proxy.
7. Recette FR/ar/EN, mobile/RTL, favoris, budget partiel, mode courses, partage/recalcul et cache hors ligne.

Aucun lien public d'application n'est disponible a cette etape. SCRAPER_CONTACT reste absent localement ; aucun scraping reel n'a ete lance. Le premier essai hmizate reste limite a trois requetes a blanc. Aucun prix ne doit etre invente pour remplir la preversion.
