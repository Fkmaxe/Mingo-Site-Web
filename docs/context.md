# Contexte métier

Ce fichier décrit le fonctionnement réel du BDE. Il prime sur toute supposition. En cas de doute, demander et ajouter la question en bas.

## Le BDE Mingo

BDE de l'ESGI Paris (anciennement BDE Sigma). Organisation :

- **Bureau** : président, vice-président, secrétaire, trésorier.
- **Pôles** : communication, sport, événementiel, partenariat. Chaque pôle a un ou plusieurs **responsables** et des **membres**.
- Un membre appartient à un pôle **pour une année scolaire** (le BDE change chaque année, l'historique doit rester).

## Utilisateurs et connexion

- Tout le monde se connecte avec son compte Microsoft école **@myskolae.fr** (élèves et membres). Aucun autre domaine n'est accepté.
- Au premier login, le compte est créé avec le rôle **Étudiant**. Le bureau promeut ensuite les membres dans leur pôle.
- Pas de mot de passe géré par l'application.

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
- Deux composantes :
  1. **Présence** aux événements et réunions — calculée automatiquement à partir des check-in.
  2. **Implication dans le pôle** — saisie par le responsable de pôle.
- Le responsable propose, le bureau valide, puis publie. Avant publication, le membre ne voit que ses présences.
- Pondération et périodes (semestre / année) paramétrables. Valeurs par défaut : voir questions ouvertes.
- Statuts d'une note : `draft` → `submitted` → `validated` → `published`.

## Événements et inscriptions

- Un événement appartient à un pôle organisateur.
- Visibilité : `public`, `students` (élèves ESGI connectés), `members` (membres BDE seulement : réunions, événements internes).
- Capacité maximale, date limite d'inscription, **liste d'attente** automatique : quand une place se libère, le premier en attente passe inscrit et reçoit un mail.
- Champs d'inscription personnalisables par événement (taille de t-shirt, régime alimentaire, pseudo en jeu…), stockés en JSON validé par un schéma défini sur l'événement.
- Chaque inscription confirmée a un **QR code** (token aléatoire, non devinable) affiché dans l'espace perso.

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
- Partenariats : fiches partenaires, contacts, statut, contreparties.
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

- [ ] La DSI autorise-t-elle une app tierce sur le tenant Microsoft myskolae.fr (consentement admin) ? Sinon : lien magique par mail @myskolae.fr.
- [ ] Format exact attendu par l'école pour la remontée des points open.
- [ ] Barème des points open : fixé par l'école ou libre par événement ?
- [ ] Échelle et pondération de la note membre (ex. /20, 50 % présence / 50 % implication ?).
- [ ] Qui valide les notes : tout le bureau ou le président seul ?
- [ ] Événements ouverts aux externes (hors myskolae.fr) ?
- [ ] Paiements (soirées, goodies) dès cette année ?
