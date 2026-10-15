# Contexte métier

Ce fichier décrit le fonctionnement réel du BDE. Il prime sur toute supposition. En cas de doute, demander et ajouter la question en bas.

## Le BDE Mingo

BDE de l'ESGI Paris. Organisation :

- **Bureau** : président, vice-président, secrétaire, trésorier.
- **Pôles** : communication, sport, événementiel, partenariat. Chaque pôle a un ou plusieurs **responsables** et des **membres**.
- Un membre appartient à un pôle **pour une année scolaire** (le BDE change chaque année, l'historique doit rester).

## Utilisateurs et connexion

- Tout le monde se connecte avec son adresse école **@myskolae.fr** (élèves et membres) et un **mot de passe** choisi à l'inscription. Aucun autre domaine n'est accepté.
- Les adresses de l'école sont de la forme `j.dupont@myskolae.fr` (initiale du prénom, un point, nom de famille). Les formulaires ne demandent que cet identifiant : `@myskolae.fr` est affiché, collé au champ, et ne se modifie pas. Une adresse complète collée ou proposée par le navigateur ne garde que l'identifiant.
- L'adresse est **confirmée par un code à 6 chiffres** envoyé par mail (valable 10 minutes, 3 essais) avant la première connexion : c'est ce qui prouve que l'étudiant possède bien cette adresse. Un code plutôt qu'un lien : les filtres de Microsoft 365 de l'école mettent beaucoup moins ces mails en quarantaine. Une fois l'adresse confirmée, l'étudiant est connecté directement. Mot de passe oublié → lien de réinitialisation par mail.
- Trois façons de se connecter, au choix sur `/login` :
  - **mot de passe** ;
  - **code par mail** : on saisit son adresse, on reçoit un code (mêmes règles que ci-dessus). Ne crée jamais de compte : l'inscription reste nécessaire (elle demande le prénom et le nom) ;
  - **passkey** (Face ID, empreinte, code du téléphone) : ajoutée depuis le profil une fois connecté, une par appareil, supprimable. Le navigateur la propose aussi directement dans le champ email. Ajouts et suppressions sont tracés dans l'audit.
- Pas de connexion Microsoft (Entra ID) : le BDE n'a pas accès au tenant de l'école.
- À l'inscription, le compte est créé avec le rôle **Étudiant**. Le bureau promeut ensuite les membres dans leur pôle.
- L'étudiant saisit son **prénom** et son **nom** séparément ; il peut les corriger depuis son profil (changement tracé dans l'audit). Email, promo et rôles ne se modifient pas soi-même.
- Après connexion, on revient sur la page demandée (`/login?next=…`), y compris après la confirmation du mail.

## Site vitrine

- La partie publique (`/`, `/qui-sommes-nous`, `/evenements`, `/contact`, `/mentions-legales`) est le site officiel **bde-mingo.fr** ; elle vit dans `apps/web` (groupe `(site)`) avec sa propre identité visuelle. L'ancien site séparé (`/fr/…`) redirige vers ces pages.
- Les événements affichés viennent de l'API : en cours et à venir, puis passés. Un visiteur ne voit que les événements publics, un étudiant connecté voit aussi ceux réservés aux étudiants. Chaque carte mène à la page de l'événement (`/events/<slug>`) pour s'inscrire.
- Connexion et création de compte sont accessibles depuis l'en-tête, le menu mobile et le pied de page.
- Mentions légales : éditeurs Maxence Grados (auto-entrepreneur, à titre gratuit) et Jérémy Chény ; hébergeur Maxence Grados ; directeur de la publication : le président.
- L'ancienne landing de l'appli reste visible sur `/preview`.

## Rôles

Les rôles sont cumulables et basés sur des permissions (RBAC), pas codés en dur.

| Rôle | Peut faire |
| --- | --- |
| Visiteur (non connecté) | Voir les événements publics, les partenaires, la page du BDE |
| Étudiant | S'inscrire / se désinscrire, voir son billet QR, voir son solde et l'historique de ses points open |
| Membre BDE | Étudiant + s'inscrire comme staff, voir ses tâches, ses présences, sa note une fois publiée |
| Responsable de pôle | Gérer membres et tâches de son pôle, créer des événements, scanner les entrées, proposer des notes |
| Bureau | Tout, sur tous les pôles + valider notes et points open, exporter. Le trésorier gère le budget |
| Admin technique | Configuration, rôles, intégrations, logs |

## Classes et profil

- Chaque étudiant indique sa **classe** dans son profil : une **année**, une **filière**, son **rythme** (initial ou alternance), son **numéro de classe** (1 à 9, obligatoire dès qu'une année est choisie) et s'il a fait la **rentrée de janvier** (non par défaut). Années et filières sont gérées par les admins (Gestion → Administration → Classes : créer, renommer, ordonner, donner un **code**, et pour chaque année : filières proposées, alternance obligatoire).
- **Code de classe ESGI** : code de l'année + numéro de classe, avec entre les deux :
  - en **1re et 2e année** (années où l'on choisit son rythme) : la **lettre du rythme** (A = alternance, I = initial), en tronc commun comme en MCSI ;
  - à partir de la **3e année** (années en alternance obligatoire) : le **code de la filière** (la lettre A pour une filière sans code).
  Exemples : `4AL1` (4e année, architecture logicielle, classe 1), `1A3` (1re année en alternance, classe 3), `2I8` (2e année en initial, classe 8), `1I2` (1re année MCSI en initial, classe 2). Codes posés par la migration, modifiables : années `1` à `5`, MCSI `MCSI`, architecture logicielle `AL`, réseaux `SRC`, sécurité `SI` (à vérifier par le bureau).
- Organisation de l'ESGI (mise en place par la migration, modifiable) :
  - **1re et 2e année** : **tronc commun** ou **MCSI**, en **initial ou en alternance** au choix ;
  - **à partir de la 3e année** : une filière de spécialité (architecture logicielle, réseaux, sécurité, MCSI…), **forcément en alternance**.
- Le profil ne propose que les filières de l'année choisie (une année sans filière cochée les propose toutes) ; l'API refuse une filière non proposée. Dans une année en alternance obligatoire, le rythme n'est pas demandé (aucun texte affiché) : l'étudiant est en alternance (et passe en alternance si l'année le devient).
- Les années s'appellent « 1 » à « 5 » (plus « 1A » à « 5A » : le A se lisait « alternance », choisie à part). La classe s'affiche « 4AL1 · 4 · Architecture logicielle », « 1A3 · 1 · Tronc commun · Alternance · Rentrée de janvier » ou « 3 · Sécurité » sans numéro (le rythme n'est pas répété quand il est obligatoire) dans les listes d'inscrits, le pointage, les exports et le classement de la ligue. Renommer une année ou une filière, ou changer son code, met à jour tous les étudiants concernés.
- Filtres par classe : liste des inscrits d'un événement (année, filière, rythme, « non renseigné »), classement de la ligue (année, filière), statistiques de l'année (participants par année, filière, rythme, selon la classe actuelle de chacun).
- **Photo de profil** : prise ou choisie depuis le profil, recadrée en carré et réduite dans le navigateur ; visible par les personnes connectées (en-tête, annuaire, équipes, ligue). Sans photo : les initiales.

## Inventaire

- Le matériel du BDE (son, déco, barnums, gobelets…) : **tous les membres** ajoutent, modifient, déplacent, sortent et rendent ; responsables et bureau peuvent **archiver** (perdu, jeté, vendu), l'historique est gardé et l'objet restaurable.
- Une fiche = un **objet unique** (une enceinte) ou un **stock** avec quantité (200 gobelets), ajusté en + / − (jamais sous ce qui est sorti).
- Chaque fiche : nom (seul champ obligatoire), photo prise au téléphone, **état** (neuf, bon, usé, abîmé, HS), **lieu** de rangement, **catégorie**, pôle, description, et un **code d'étiquette** `INV-0042` avec QR à coller : le scanner ouvre la fiche.
- **Sorties** (facultatives) : qui l'a, pour quel événement, retour prévu ; au retour on note l'état (qui devient celui d'un objet unique). Ce qui est en retard est signalé.
- **Historique complet**, en ajout seul : ajout, modification, déplacement, état, stock, photo, sortie, retour, archivage, avec l'auteur, la date et une note facultative. Par objet et pour tout l'inventaire.
- **Lieux** et **catégories** sont des listes communes : on les choisit dans une liste, on en crée un nouveau sur place (bouton +), et on filtre l'inventaire par lieu ou par catégorie (avec le nombre d'objets).
- Rapide : « Enregistrer et en ajouter un autre » garde le lieu, la catégorie et le pôle ; recherche par nom, catégorie ou code.

## Administration du site

- Un ou plusieurs **administrateurs** ont toutes les permissions du site, en plus de leur éventuel rôle au BDE. Le premier est nommé depuis le serveur (`make-admin`, voir README), les suivants depuis le site.
- Espace **Gestion → Administration** :
  - **Membres** : donner un rôle pour l'année en cours (membre ou responsable d'un pôle, bureau avec un poste), le changer, le retirer, nommer ou retirer un admin. Les rôles se **cumulent** : par exemple admin et responsable com, ou trésorier, responsable événementiel et membre sport. Une personne a un rôle par pôle (responsable *ou* membre) et un seul poste au bureau. Une personne doit avoir créé son compte avant. On ne peut pas se retirer ses propres droits d'admin.
  - **Pôles** : créer, renommer.
  - **Années scolaires** : créer, choisir l'année en cours (la première créée le devient). Les rôles sont annuels : à la rentrée, on reconduit les membres sur la nouvelle année.
  - **Journal** : toutes les actions sensibles (rôles, notes, points, exports…), avec leur auteur.
- Chaque action d'administration est inscrite au journal d'audit.

## Points open

- Système de l'école : des points attribués aux étudiants pour leur investissement associatif.
- Le BDE en attribue aux **participants** de ses événements.
- **Les membres du BDE n'ont pas de points open** (ils ont une note, voir plus bas).
- Chaque événement porte un barème (ex. participer = 2 pts).
- Attribution automatique quand la présence est validée (check-in), puis **validation par le bureau** avant transmission à l'école.
- Ajustement manuel possible par le bureau, **motif obligatoire**.
- Stockage en journal : chaque mouvement est une ligne (`open_points_ledger`), le solde est une somme. Jamais d'UPDATE de solde.

## Notation des membres

- Les membres du BDE reçoivent une **note** attribuée par le bureau.
- La note est un **total de points plafonné**, pas une moyenne pondérée :
  1. **Points de présence** : chaque événement ou réunion où le membre est pointé (participant, staff ou réunion) rapporte un nombre de points. Valeur par défaut fixée sur la période, modifiable événement par événement. Calculés automatiquement depuis les check-in, jamais saisis.
  2. **Points du pôle** (implication) : proposés par le responsable de pôle, entre 0 et le barème.
  - **Note = min(barème, points de présence + points du pôle).** On peut atteindre le maximum uniquement par la présence, uniquement par le pôle, ou par un mélange des deux.
- **Tout est réglable par le bureau** : barème (20 par défaut), points par présence, périodes.
- Périodes : **trimestrielles par défaut**, mais le bureau crée librement ses périodes (dates de début et de fin).
- Le responsable propose, **n'importe quel membre du bureau** valide puis publie. Avant publication, le membre ne voit que ses présences.
- Statuts d'une note : `draft` → `submitted` → `validated` → `published`. Une note publiée n'est modifiable que par le bureau, avec trace dans `audit_log`.

## Événements et inscriptions

- Un événement appartient à un pôle organisateur.
- Visibilité : `public`, `students` (élèves ESGI connectés), `members` (membres BDE seulement : réunions, événements internes).
- Capacité maximale, date limite d'inscription, **liste d'attente** automatique : quand une place se libère, le premier en attente passe inscrit et reçoit un mail.
- Champs d'inscription personnalisables par événement (taille de t-shirt, régime alimentaire, pseudo en jeu…), stockés en JSON validé par un schéma défini sur l'événement (10 questions max). Chaque question a un libellé, une **explication** facultative sur plusieurs lignes (consignes, liste « - Discord : @pseudo »…) et un type : texte court, texte long, nombre, **choix unique** (boutons radio, ex. Oui / Non), **choix multiples** (cases), case à cocher. Les choix peuvent proposer **« Autre »** avec une réponse libre (100 caractères), enregistrée telle quelle. Les réponses à choix multiples s'affichent et s'exportent séparées par des virgules.
- **Annuler / supprimer** : annuler un événement prévient ses inscrits (mail et notification) et le laisse visible avec la mention « annulé ». Un brouillon ou un événement annulé peut ensuite être **supprimé** : il disparaît de toutes les listes et pages, mais ses données (inscriptions, présences, trésorerie, audit) sont gardées. Un événement publié s'annule d'abord ; un événement terminé ou qui compte encore pour la ligue (classement validé) ne se supprime pas.
- **Lien de partage** : chaque événement publié a un bouton « Partager l'événement » (feuille de partage du téléphone, sinon lien copié) vers `/events/<slug>`. Un visiteur non connecté qui ouvre le lien d'un événement réservé aux étudiants passe par la connexion puis revient sur l'événement pour s'inscrire.
- Chaque inscription confirmée a un **QR code** (token aléatoire, non devinable) affiché dans l'espace perso.

### Tournois (inscription par équipe)

- Un événement peut se jouer **en équipe** : l'organisateur fixe une taille minimale et maximale.
- Le capitaine crée l'équipe (nom unique dans l'événement) et reçoit un **code à 6 caractères** à partager ; les coéquipiers rejoignent avec ce code. Pas d'inscription individuelle hors équipe.
- La capacité d'un événement par équipe compte des **équipes** : une équipe prend une place entière, et tous ses membres sont inscrits ou en liste d'attente avec elle. Rejoindre une équipe qui a une place reste possible quand l'événement est complet. Quand une place d'équipe se libère (équipe vidée, capacité augmentée), la première équipe en attente passe inscrite avec tous ses membres, qui reçoivent un mail. Une équipe est « complète » quand elle a au moins le minimum de membres.
- Se désinscrire = quitter l'équipe. Si le capitaine part, le plus ancien membre le remplace ; une équipe vide disparaît.
- Une fois des inscrits, on ne peut plus basculer entre individuel et équipe, ni descendre le maximum sous la plus grande équipe.

### Côté membres (staff)

- Un événement définit des **créneaux staff** (accueil, bar, installation, rangement) avec un nombre de places.
- Les membres se positionnent, le responsable valide ou réaffecte.
- Rappel automatique la veille.

### Check-in

- Scan du QR depuis un téléphone (responsable de pôle ou bureau), recherche manuelle par nom en secours.
- Le pointage des membres staff alimente leur note de présence.
- Un check-in valide génère automatiquement un mouvement de points open en statut `pending` pour les participants (pas pour les membres).

## Gestion interne

- Annuaire des membres (pôle, rôle, promo, contact).
- Tâches (à faire / en cours / fait, responsable, échéance), sur `/tasks` en onglets :
  - **Mes tâches** : celles qui me sont assignées et mes **tâches perso**. Une tâche perso est créée par n'importe quel membre de l'année, n'est assignée à personne et n'est visible que par son auteur (ni le bureau ni les admins ne la voient) ;
  - **Bureau** : le tableau du bureau, visible et géré par le bureau seulement (et les admins) ; on l'assigne à un membre du bureau. Accessible aussi depuis Gestion ;
  - **Pôle X** : le tableau de chaque pôle (le responsable gère, les membres du pôle voient, l'assigné déplace sa tâche).
- Réunions : ordre du jour, compte rendu, présences. Quatre types : **réunion de pôle** (créée par son responsable ou le bureau, pour les membres du pôle), **réunion générale** (tous les membres de l'année), **réunion du bureau** (le bureau seul) et **réunion bureau + responsables** (le bureau et les responsables de pôle). Les trois derniers types sont créés par le bureau. Chaque réunion n'est visible que par les personnes attendues (et le bureau), et le bureau y pointe les présences parmi elles.
- Recrutement : candidatures, affectation à un pôle.
- Partenariats : fiches partenaires, contacts, statut, contreparties. Gérées par le bureau ; le membre référent d'un partenaire peut modifier sa fiche. Les partenaires actifs (nom, site, avantages) sont affichés publiquement.
- Trésorerie (Gestion → Trésorerie, le trésorier saisit, le bureau consulte) : en haut les totaux de l'année (**Recettes**, **Dépenses**, **Solde**), puis le tableau des écritures, filtrable par type et cherchable (contrepartie, initiateur, commentaire). Un bouton « Ajouter » mène au formulaire de création, chaque ligne à la page de l'écriture.
  - Une écriture : **nom de la contrepartie**, **initiateur** (membre du BDE de l'année, cherché par son nom avec sa photo), **montant total**, **date de l'opération**, **type** (Débit = sortie, Crédit = entrée, ou **Autre** avec un nom libre et le sens, entrée ou sortie, qui la compte en recette ou en dépense), événement facultatif, **commentaire** facultatif et **justificatifs de paiement** : plusieurs photos ou PDF (8 Mo au plus chacun, 10 par écriture), affichés dans la page de l'écriture.
  - C'est un **journal** : le montant, le type et le sens ne changent jamais ; une erreur se corrige par « Annuler l'écriture » (écriture inverse datée du jour). L'annulation compte du côté de l'écriture annulée : annuler une dépense fait baisser les dépenses, ce n'est pas une recette. Le reste se corrige, justificatifs compris ; tout est tracé dans l'audit.
  - Le **budget par événement** (prévu, dépenses, recettes, solde) se lit et se fixe sur la page de gestion de l'événement.

## Notifications push

- Chacun active les notifications sur ses appareils, depuis son profil (sur iPhone : une fois l'appli ajoutée à l'écran d'accueil). Elles complètent les mails, ne les remplacent pas.
- Notifications personnelles : **place libérée** (liste d'attente, y compris l'équipe entière d'un tournoi), **rappel la veille**, **événement annulé**, **résultats de la ligue** (points et place, à chaque personne qui a marqué, aussi après une correction). Pas de mail pour les résultats : un envoi à tous les participants à chaque événement ferait classer les mails du BDE en indésirables.
- **Nouvel événement publié** : envoyé aux appareils qui l'acceptent (case « Me prévenir des nouveaux événements », cochée par défaut), seulement à ceux qui peuvent voir l'événement (événements « membres » : membres de l'année), jamais à la personne qui publie.
- Se déconnecter désabonne l'appareil : un téléphone prêté ne reçoit pas les notifications d'un autre compte.

## Ligue sportive

- La **Ligue Sportive Interne** dure une année scolaire. Le classement général est mis à jour à chaque événement validé ; les 3 premiers gagnent des lots (PS5, Switch 2, carte Amazon 100 € en 2026-2027), affichés sur la page `/ligue`.
- Un événement **compte pour la ligue** quand son organisateur (responsable du pôle, bureau) choisit son **sport** dans la gestion de l'événement : tennis de table, badminton, five, padel, basket, paintball au départ ; le bureau ajoute ou renomme les sports. Les événements inter-écoles ne comptent pas : on ne choisit pas de sport.
- **Points** (réglables par le bureau, pour la saison) : 1 point de participation, plus un bonus par place : 1er +10, 2e +7, 3e +5, 4e +3, 5e +2. Le 1er marque donc 11 points, le 5e 3 points, les autres 1 point.
- La participation va à chaque personne **pointée à l'entrée**, et aussi à une personne classée qui ne l'aurait pas été (elle a joué). En équipe, **chaque membre** de l'équipe classée reçoit les points de la place.
- **Tournoi** intégré à l'événement (facultatif) : participants = personnes (ou équipes) pointées à l'entrée, ou tous les inscrits confirmés ; têtes de série dans l'ordre d'inscription. Trois formats :
  - **poules + arbre** : chacun contre chacun en poule (répartition en serpentin), puis les N premiers de chaque poule en élimination directe, poules croisées (1er A contre 2e B) ;
  - **arbre seul** : élimination directe, les meilleures têtes de série sont exemptées du premier tour si le nombre n'est pas une puissance de 2 ;
  - **poules seules** : classement aux points.
- Poules : victoire 3 points, nul 1, défaite 0 ; à égalité, différence de score, confrontation directe, score marqué, puis tête de série. Pas de match nul en phase finale. **Petite finale** pour la 3e place (au choix).
- L'organisateur saisit chaque match en un tap sur le vainqueur, score facultatif. Une correction est possible tant que le match suivant n'est pas joué. Les résultats des poules sont figés une fois l'arbre tiré.
- **Affichage en direct** (TV, vidéoprojecteur) : `/live/<slug>`, ouvert depuis « Affichage TV en direct » (gestion de l'événement ou page de l'événement). Il faut être connecté (n'importe quel compte qui voit l'événement). La page se met à jour toute seule toutes les 10 secondes : matchs **en cours**, matchs **à suivre** (adversaires connus, pas encore joués), poules ou arbre, puis podium quand le tournoi est fini. L'organisateur marque un match « en cours » avec « Lancer » sur sa carte (« Arrêter » pour revenir en arrière) ; saisir le résultat le termine.
- **Classement de l'événement** proposé d'après le tournoi : vainqueur, finaliste, petite finale, puis éliminés au même tour départagés par leur bilan de poule (puis tête de série). L'organisateur le corrige si besoin et clique « Valider le classement » : les points sont écrits dans un **journal** (ajout seul). Une nouvelle validation annule les points de l'événement par des mouvements inverses puis écrit les nouveaux. Tout est tracé dans l'audit.
- Le classement général (ex aequo = même rang) est visible par tous les étudiants connectés, filtrable par année et filière ; le tournoi (poules, arbre) est visible en direct sur la page de l'événement.
- Chacun voit sa place et ses points sur l'accueil, et le détail par événement (points, place) sur son profil.

## Statistiques

- **Par événement** (ses organisateurs : responsable du pôle, bureau) : inscrits, liste d'attente, désinscriptions, présents et taux de présence, absents (inscrits non venus, une fois l'événement commencé), staff validé et pointé, points open générés, inscriptions jour par jour. Équipes inscrites pour un tournoi.
- **L'année** (bureau, droit `stats:read`) : événements publiés ou terminés, inscriptions, entrées pointées, participants uniques, taux de présence sur les événements commencés ; détail par mois, par pôle et par classe (année, filière, initial / alternance).
- **Implication des membres** (bureau) : créneaux staff pointés et présences en réunion par membre, rapportées aux réunions passées de ses pôles et aux réunions générales ; totaux par pôle.

## Exports

- Tout ce qui est listable est exportable vers **Google Sheets** (inscrits, présences, points open, notes, membres, budget).
- Export à la demande + synchro nocturne optionnelle (un classeur par année, un onglet par type).
- Export CSV toujours disponible en secours.
- Les exports passent par un compte de service Google appartenant au BDE, pas par un compte personnel.

## Contraintes

- Utilisé surtout sur **téléphone**, souvent avec un mauvais réseau pendant les événements.
- Doit rester **simple** : s'inscrire à un événement en 2 clics une fois connecté.
- Doit être **reprenable** par le bureau suivant : doc à jour, déploiement en une commande.
- RGPD : données minimales, purge des anciens étudiants, suppression sur demande.

## Questions ouvertes

- [x] ~~La DSI autorise-t-elle une app tierce sur le tenant Microsoft myskolae.fr ?~~ Non, pas d'accès → email + mot de passe, adresse vérifiée par mail (octobre 2026).
- [ ] Format exact attendu par l'école pour la remontée des points open.
- [ ] Barème des points open : fixé par l'école ou libre par événement ?
- [x] ~~Échelle et pondération de la note membre~~ : total de points plafonné (présence + pôle), barème et points réglables par le bureau, périodes trimestrielles par défaut (octobre 2026).
- [x] ~~Qui valide les notes~~ : tout le bureau (octobre 2026).
- [ ] Événements ouverts aux externes (hors myskolae.fr) ?
- [x] ~~Paiements (soirées, goodies) dès cette année ?~~ Pas de paiement dans l'appli : un événement payant passera par un prestataire externe (octobre 2026).
- [x] ~~Tournois : places par personne ou par équipe ?~~ Par équipe entière : la capacité compte des équipes (octobre 2026).
- [ ] Ligue : une personne classée mais non pointée à l'entrée reçoit le point de participation (choix par défaut). À confirmer par le bureau.
- [ ] Durées de conservation des données personnelles (comptes, inscriptions, sessions, audit) : affichées « à préciser » dans les mentions légales.
- [ ] Directeur de la publication du site : le président (Sulyvan Sayah) ou un des éditeurs (Maxence Grados, Jérémy Chény) ?
