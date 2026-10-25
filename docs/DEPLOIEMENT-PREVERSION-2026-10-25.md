# Chhal - preversion distante - 25 octobre 2026

Etat : base Neon initialisee et verifiee. API Render et web Cloudflare non deployes.

## Cibles confirmees
- Render : espace "My Workspace", `tea-dbf7nb29lscs73941so0`, confirme par le porteur. Connexion fonctionnelle, aucun service Chhal liste ni cree.
- Neon : organisation `org-cold-mountain-99729670`, forfait `free_v3`.
- Projet : `chhal-preview`, ID `fragrant-wave-60417309`, region AWS Francfort `aws-eu-central-1`.
- Branche : `preview`, ID `br-orange-haze-b9wrv52x`.
- Base : `chhal`, PostgreSQL 18.6 ; role `chhal_owner`.
- Calcul configure a 0,25 CU minimum et maximum. Aucun passage a une offre payante.
- Une premiere creation avec un delai de suspension explicite a ete refusee (HTTP 412). Absence de projet verifiee avant la nouvelle tentative reussie sans ce parametre.

Ces identifiants ne sont pas des mots de passe. Aucune chaine de connexion, cle ou jeton n'a ete recupere ou ajoute au depot.

## Initialisation realisee sur la base NEUVE uniquement
Avant ecriture, une requete a confirme la bonne base et zero table publique.
Les migrations 0000 a 0007 ont ete appliquees, puis les references seules :
- 8 migrations, journal Drizzle avec les SHA-256 et dates exacts du code ;
- 52 produits, 208 alias et 61 familles ;
- 4 paniers de reference ;
- BIM et un magasin Casablanca ;
- source hmizate connue mais inactive ;
- ZERO observation de prix, aucune fixture.

L'acces reseau du terminal reste bloque (ENOTFOUND pour npm et GitHub). Pour garder les migrations existantes, le `PgDialect.migrate` installe de Drizzle a genere les instructions et le journal. Le `seedReference` existant a ete execute sur PGlite en memoire avec capture des INSERT, sans utiliser le seed de fixtures. Le SQL resultant a ete rejoue et compare dans une deuxieme base memoire ; le migrateur Drizzle y a ensuite confirme une nouvelle execution sans effet.

Ces instructions ont ete transmises a Neon dans deux transactions avec controles de cible et de base vide. Aucune migration ecrite a la main ne remplace les fichiers Drizzle. Le plan temporaire est `.cache/qa/neon-preview-plan.json` ; il est reserve a une cible neuve et ne doit jamais etre rejoue tel quel sur une base existante.

## Verification distante PASS
- Comptages identiques au replay local : 52 / 208 / 4 / 61, zero prix et zero source active.
- Les 8 empreintes et dates du journal distant correspondent exactement aux fichiers locaux.
- Les 4 colonnes requises par V1 sont presentes.
- Les deux triggers append-only sont actifs.
- La base locale `.data/dev` n'a pas ete ouverte ni migree : sa migration 0007 reste une operation distincte avec arret, sauvegarde et validation.

Ce controle prouve l'initialisation PostgreSQL distante. Il ne remplace pas les tests de l'API via le pilote pg, la recette navigateur ou le build Worker. Les 358 tests de la livraison precedente n'ont pas ete relances pour cette seule operation d'infrastructure.

## Prochain blocage : depot source et Cloudflare
Le dossier local ne contient pas de depot Git. Aucun commit/push n'a ete effectue.
Le compte GitHub connecte est `zoubairanass`, mais aucun depot Chhal accessible n'a ete identifie. Le connecteur disponible ne sait pas creer un depot ; le navigateur de cette session ne dispose d'aucune surface active.

Le porteur doit creer un depot PRIVE Chhal dans son compte, avec un README initial, puis autoriser son acces au connecteur GitHub et a Render. Il devra donner le lien et demander explicitement l'envoi de la V1 dans ce depot pour autoriser le commit/push. Ne jamais utiliser le depot PROCURA ou celui de carte de visite.

OpenNext et Wrangler ne sont toujours pas installes localement. Depuis un terminal du porteur avec acces Internet :
```powershell
cd "C:\Users\anass\Desktop\projet"
corepack pnpm --filter @chhal/web add -D @opennextjs/cloudflare wrangler
node scripts/setup-cloudflare.mjs
corepack pnpm --dir apps/web exec wrangler login
```
La connexion Cloudflare est effectuee par le porteur dans son navigateur. Aucun jeton a transmettre dans le chat. Le build Worker puis l'URL finale workers.dev restent a verifier.

## Suite du deploiement approuve
1. Source GitHub privee et outils Cloudflare operationnels.
2. Tester le build Worker. Relever l'origine publique Cloudflare exacte.
3. Creer l'API Node `chhal-api` sur Render, offre free, region Francfort, racine du monorepo. Utiliser `render.yaml`.
4. Configurer les secrets dans les stockages securises des hebergeurs : URL Neon avec pool pour le trafic applicatif, ADMIN_TOKEN fort, CORS_ORIGIN exacte. Omettre ALLOW_TEST_DATA et activer TRUST_PROXY. Ne pas les inscrire dans le depot.
5. Configurer API_INTERNAL_URL cote Worker, deployer et verifier /health, /ready et les parcours via le proxy.
6. Recette FR/ar/EN, mobile et RTL, favoris, panier, budget partiel, partage/recalcul, administration et cache hors ligne.

Aucun service Render ni Worker public n'est cree. Le site resterait sans prix courants : SCRAPER_CONTACT doit etre renseigne par le porteur avant le premier essai hmizate, trois requetes maximum. L'import reel reste distinct ; ne pas fabriquer de prix pour la demonstration.
