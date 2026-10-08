# Contexte métier

Ce fichier décrit le fonctionnement réel du BDE. Il prime sur toute supposition. En cas de doute, demander et ajouter la question en bas.

## Le BDE Mingo

BDE de l'ESGI Paris (anciennement BDE Sigma). Organisation :

- **Bureau** : président, vice-président, secrétaire, trésorier.
- **Pôles** : communication, sport, événementiel, partenariat. Chaque pôle a un ou plusieurs **responsables** et des **membres**.
- Un membre appartient à un pôle **pour une année scolaire** (le BDE change chaque année, l'historique doit rester).

## Utilisateurs et connexion

- Tout le monde se connecte avec son adresse école **@myskolae.fr** (élèves et membres) et un **mot de passe** choisi à l'inscription. Aucun autre domaine n'est accepté.
- L'adresse est **confirmée par mail** avant la première connexion : c'est ce qui prouve que l'étudiant possède bien cette adresse. Mot de passe oublié → lien de réinitialisation par mail.
- Pas de connexion Microsoft (Entra ID) : le BDE n'a pas accès au tenant de l'école.
- À l'inscription, le compte est créé avec le rôle **Étudiant**. Le bureau promeut ensuite les membres dans leur pôle.

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
- Champs d'inscription personnalisables par événement (taille de t-shirt, régime alimentaire, pseudo en jeu…), stockés en JSON validé par un schéma défini sur l'événement.
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
- Tâches par pôle (à faire / en cours / fait, responsable, échéance).
- Réunions : ordre du jour, compte rendu, présences.
- Recrutement : candidatures, affectation à un pôle.
- Partenariats : fiches partenaires, contacts, statut, contreparties. Gérées par le bureau ; le membre référent d'un partenaire peut modifier sa fiche. Les partenaires actifs (nom, site, avantages) sont affichés publiquement.
- Trésorerie simple : budget par événement, dépenses / recettes, justificatifs.

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
