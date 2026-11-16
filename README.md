# Pilotage de l'asso

Site de suivi de l'association, pôle par pôle, avec des accès selon le rôle de chacun.

## Ce que fait le site

- **Tableau de bord du bureau** : pour chaque pôle, une **jauge /100** (l'avancement estimé par le respo) et les **objectifs de la semaine** (to-do list cochée). En haut, l'avancement moyen, les objectifs atteints cette semaine et les pôles dont l'estimation date de plus de 7 jours. Les pôles sans jauge affichent un chiffre clé : la recette totale pour Vente cookies, le nombre de partenaires pour Partenariat.
- **Page de chaque pôle** :
  - l'estimation /100 du respo, avec un commentaire, sa date et son auteur ;
  - les objectifs de la semaine, avec les semaines passées et futures (flèches ‹ ›) ;
  - l'équipe du pôle ;
  - les sections propres au pôle (tableau ci-dessous).
- **Dépôt de fichiers avec aperçu** : images, vidéos et sons lisibles directement, PDF en aperçu. On peut aussi déposer un **lien** (Drive, YouTube, SoundCloud…) ou un **texte**. Les sections Prod, Texte, Musique finale, Versions, Logos, Devis Festi Print et Fichiers ont des **commentaires** sous chaque élément.

| Pôle | Jauge | Sections |
|---|---|---|
| Goodies | oui | Devis Festi Print (fichiers) · Logos (fichiers) · Idées de goodies (image, nombre, prix estimé, total) |
| Aprèm sport | oui | Devis bus + activité (prix, prestataire, pièce jointe, moins cher par catégorie) |
| Communication | oui | Fonds des stories · Stockage des vidéos |
| Rap | oui | Prod · Texte · Musique finale (chacun avec commentaires) |
| Kermesse | oui | Devis activités · Idées de disposition et d'activités |
| Soirée BDS | oui | Devis bus + activité · Idées d'activités |
| Film | oui | Synopsis · Versions du film (avec commentaires) |
| Vente cookies | non | Ventes : date, personnes mobilisées, recette (**seul le respo crée une vente**) |
| SOS | oui | Idées de plats · Idées de desserts (image, prix, ingrédients) · Organisation : appartements sur une carte + rôles |
| Partenariat | non | Partenaires et avantages (**seul le respo ajoute**) |
| Dévoilement | oui | Bloc-notes idées · Déroulement minuté (heures de fin et durée totale calculées) · Fichiers |

Un admin peut créer un pôle et lui donner l'une de ces dispositions, ou une disposition « Libre » (bloc-notes + fichiers).

## Qui voit et fait quoi

| | Non validé | Membre d'un pôle | Responsable d'un pôle | Bureau | Admin |
|---|---|---|---|---|---|
| Voir un pôle | rien | **seulement ses pôles** | ses pôles | tous | tous |
| Ajouter du contenu (fichiers, devis, idées…) | non | oui, sauf sections réservées au respo | oui | oui | oui |
| Modifier / supprimer un contenu | non | **le sien uniquement** | tout dans son pôle | tout | tout |
| Estimation /100 et objectifs de la semaine | non | lecture | **oui** | oui | oui |
| Ajouter / retirer des membres d'un pôle | non | non | oui (simples membres de son pôle) | **non** | oui |
| Nommer les responsables, valider les comptes, changer les rôles | non | non | non | non | **oui** |
| Voir les e-mails des membres | non | non | non | non | **oui** |

- Ces règles sont appliquées **par la base de données elle-même** (Row Level Security de Supabase), fichiers compris. Même quelqu'un qui contournerait le site n'obtiendrait que ce que son rôle autorise.
- Les fichiers sont dans un espace **privé** : chaque ouverture passe par un lien temporaire (1 h), délivré seulement aux personnes du pôle.
- Un nouveau compte ne voit **rien** tant qu'un admin ne l'a pas validé **et** ajouté à des pôles. « Retirer l'accès » le retire aussi de tous ses pôles.
- Une personne voit seulement les noms des gens de ses pôles, plus ceux du bureau. Un responsable voit aussi les noms des membres validés, pour pouvoir les ajouter à son pôle.
- Il reste toujours au moins un admin : le dernier admin ne peut pas se retirer ce rôle.

## Essayer tout de suite (mode démo)

Tant que `js/config.js` est vide, le site tourne en **mode démo** avec des données d'exemple. Les membres de la démo sont fictifs, et les données restent dans votre navigateur. Le menu **« Voir en tant que »** en haut de la page permet de se mettre à la place de l'admin, du bureau, d'un respo, d'un membre ou d'un compte non validé, pour vérifier ce que chacun voit.

```bash
cd C:\Users\baroc\asso-pilotage
python -m http.server 8765
```

Puis ouvrez http://localhost:8765. En démo, les fichiers que vous déposez disparaissent au rechargement de la page.

## Mise en ligne (≈ 20 minutes, gratuit)

### 1. Base Supabase

1. Créez un compte sur https://supabase.com, puis **New project** (région *Europe*).
2. **SQL Editor → New query** : collez tout `supabase/schema.sql` → **Run**. Vous devez voir « Success ». Ce script crée aussi l'espace de fichiers privé `pole-files`.
3. Même chose avec `supabase/seed.sql` : il crée les 11 pôles avec leurs sections.
4. **Project Settings → API** : copiez **Project URL** et la clé **anon public** dans `js/config.js`, et mettez le nom de l'asso dans `APP_NAME`.

> La clé *anon* est faite pour être publique : ce sont les règles du `schema.sql` qui protègent les données. **Ne mettez jamais la clé `service_role` dans le site.**

### 2. GitHub Pages

1. Créez un dépôt sur https://github.com/new (par ex. `pilotage-asso`). Un dépôt public suffit : il ne contient que le code, aucune donnée.
2. Envoyez les fichiers :
   ```bash
   cd C:\Users\baroc\asso-pilotage
   git init -b main
   git add .
   git commit -m "Site de pilotage de l'association"
   git remote add origin https://github.com/VOTRE-COMPTE/pilotage-asso.git
   git push -u origin main
   ```
3. Dans le dépôt : **Settings → Pages → Deploy from a branch**, branche `main`, dossier `/ (root)`. L'adresse s'affiche après une minute.

### 3. Relier les deux

Dans Supabase :
- **Authentication → URL Configuration** : mettez l'adresse GitHub Pages dans **Site URL** et dans **Redirect URLs**.
- **Authentication → Sign In / Providers → Email** : décochez **Confirm email**. Le site n'envoie aucun e-mail : la sécurité repose sur la validation de chaque compte par un admin.

### 4. Premier lancement

1. Créez votre compte sur le site. Le **premier inscrit devient admin**.
2. Envoyez l'adresse aux membres. Chacun crée son compte.
3. Dans **Membres et accès** :
   - **Valider** chaque compte ;
   - cliquer sur **Pôles…** pour donner à chacun ses pôles (Membre ou Responsable) ;
   - mettre le rôle **Bureau** aux membres du bureau.

### 5. Reprendre ce qui a été saisi en démo

1. Dans la démo, cliquez sur **Exporter mes données** (en haut), ce qui télécharge un fichier `.json`. Une sauvegarde existe déjà dans `sauvegardes/`.
2. Dans le vrai site, en admin : **Gérer les pôles → Importer des données de la démo…**, puis choisissez le fichier.

L'import reprend les pôles (estimations comprises), les objectifs, les contenus et les commentaires. Il ne reprend pas les comptes ni les équipes, puisque ce sont de vraies personnes à inviter. Les fichiers déposés en démo ne sont pas conservés : il faut les redéposer.

> Le dossier `sauvegardes/` contient des données de l'asso (dont des adresses) : il est exclu de git et ne doit jamais être publié.

## Limites à connaître

- **Taille des fichiers : 50 Mo maximum** par fichier, et 1 Go en tout sur l'offre gratuite de Supabase. Pour les vidéos lourdes (versions du film, vidéos de la com), déposez plutôt un **lien** Drive ou YouTube.
- **Carte SOS** : les fonds de carte viennent d'OpenStreetMap. On place un appartement en cliquant sur la carte, et aucune adresse n'est envoyée à un service extérieur. Les adresses ne sont visibles que des membres du pôle SOS, du bureau et des admins.
- **Pas d'e-mails** : le site n'en envoie aucun (le service intégré de Supabase n'écrit qu'à l'équipe du projet, environ 2 par heure). Conséquences :
  - avant de valider un compte, vérifiez que vous connaissez la personne et son adresse ;
  - **mot de passe oublié** : un admin le réinitialise dans Supabase (Authentication → Users → la personne → *Send password recovery* ne marchera pas sans SMTP ; supprimez plutôt le compte pour qu'elle se réinscrive, puis revalidez-la et redonnez-lui ses pôles).
  - Pour réactiver les e-mails plus tard : branchez un SMTP (Authentication → Emails → SMTP, par ex. Brevo), puis recochez *Confirm email*.
- **Projet en pause** : sur l'offre gratuite, Supabase met en pause un projet inutilisé pendant 7 jours. Il suffit de le relancer depuis Supabase.

## Fichiers

```
index.html            page unique
styles.css            apparence générale (clair / sombre automatique, mobile)
sections.css          jauges, tableau de bord, sections, carte
js/config.js          nom de l'asso + identifiants Supabase   ← à remplir
js/templates.js       disposition de chaque pôle (sections)
js/app.js             écrans
js/data.js            accès aux données + mode démo (mêmes règles que la base)
supabase/schema.sql   tables, droits par rôle, fichiers, temps réel   ← à lancer une fois
supabase/seed.sql     les 11 pôles et leurs sections                  ← à lancer ensuite
```
