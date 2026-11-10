# Correspondance diagramme de classes ⇄ code

Source : diagramme Visual Paradigm (5 packages). Le code a le même découpage : un fichier de domaine par groupe de classes, un modèle Prisma par classe.

## Les 22 classes

| Package du diagramme | Classe | Fichier de domaine | Modèle Prisma |
|---|---|---|---|
| Prépaiement | Tenant, Utilisateur, Role | `administration.ts` | `Tenant`, `Utilisateur`, `Role` |
| Prépaiement / Clients & Sites | Site, Client, Logement | `clients-sites.ts` | `Site`, `Client`, `Logement` |
| Prépaiement | AffectationCompteur, Transaction, Facture, Token | `prepaiement.ts` | idem |
| Prépaiement / Compteurs / Supervision | Compteur | `compteurs.ts` | `Compteur` |
| Compteurs | ConfigurationCompteur, Synchronisation | `compteurs.ts` | idem |
| Tarifs | ProfilTarifaire, PlageHoraire, TarifCoefficient, JourFerie, ModificationTarif | `tarifs.ts` | idem |
| Supervision | Telemetrie, Alarme, Notification, Commande | `supervision.ts` | idem |

Table technique hors diagramme : `JournalAudit` (traçabilité exigée par les règles de gestion et audit des lectures inter-tenant).

## Les associations

| Association du diagramme | Réalisation |
|---|---|
| Tenant ◇ Site, Site ◇ Client | `Site.tenantId`, `Client.siteId` (le tenant d'un client se déduit par son site) |
| Appartenir (Tenant ◇ Utilisateur) | `Utilisateur.tenantId` |
| Role 1 — 0..* Utilisateur | `Utilisateur.roleId` : un seul rôle par utilisateur |
| Avoir (Client — Logement) | `Logement.clientId` |
| Associer (Client 1..* — 1..* Compteur) + AffectationCompteur | table `affectation_compteur` ; active tant que `dateFin` est nulle |
| Association ternaire Utilisateur—Affectation—Transaction + Facture | table `facture` (une par transaction) : c'est elle qui relie la transaction à son compteur, son client et son agent |
| Generer (Token 0..1 — 1 Transaction) | `Token.transactionId` unique |
| Synchroniser, Telemetrie, Alarme (compositions) | clé étrangère vers `Compteur`, suppression en cascade |
| Alarme ◆ Notification | `Notification.idAlarme`, cascade |
| peut configurer + ConfigurationCompteur | table avec `utilisateurId` + `compteurMac`, une ligne par version |
| commander + Commande | table avec `utilisateurId` + `compteurMac` |
| modifier + ModificationTarif | table avec `utilisateurId` + `idProfile`, une ligne par modification |
| s'appliquer (ProfilTarifaire 1 — 0..* Compteur) | `Compteur.profilTarifaireId` |
| Contenir (◆), posseder (◇), Peut avoir | `PlageHoraire.idProfile`, `JourFerie.idProfile`, `TarifCoefficient.idPlageHoraire` |

## Ajouts (absents du diagramme)

| Ajout | Pourquoi |
|---|---|
| `Compteur.tenantId` | RM8 pkg 3 et isolation par tenant ; un compteur non encore affecté n'a aucun client, donc aucun tenant |
| `Compteur.secretKeyHash` | authentification MQTT du compteur (cahier des charges §10), stocké haché |
| `Compteur.soldeMisAJourLe`, `dernierIndexEmis` | ignorer les messages anciens ; séquence anti-rejeu des tokens |
| `Role.nom` | identifier un rôle (seed, administration) |
| `ProfilTarifaire.tenantId` | isolation par tenant (le diagramme ne rattache le profil à rien) |
| `Transaction.credits` | crédits correspondant au montant, nécessaires pour émettre le token |
| `Token.compteurMac`, `sequenceIndex`, `dateExpiration` | anti-rejeu par compteur (§08) ; expiration (UC2 E3) |
| `Telemetrie.recuLe`, `heapLibre` | heure de réception (file hors ligne) ; santé du firmware (§04) |
| `Alarme.acquitteParId` | traçabilité de l'acquittement |
| `Commande.dateExpiration`, `payload` | RM6 pkg 6 ; paramètres de la commande |
| `Synchronisation.donnees` | transactions hors ligne à réconcilier (UC7 pkg 1) |
| `Site.province`, `latitude`, `longitude` | remplacent `attribute` (voir ci-dessous) |

## Interprétations et corrections de libellés

- **`Site.attribute`** est l'attribut par défaut de Visual Paradigm, jamais renommé : je l'ai remplacé par la province et les coordonnées, nécessaires à la carte du Control Room.
- **`Role.permission`** devient une liste de codes (`permissions`) : le diagramme n'a pas de classe Permission.
- **`motDePasse`** → `motDePasseHash`, **`Token.code`** → `codeHash` : jamais de secret en clair.
- **`PlageHoraire.dateDepart / dateFin`** : ce sont des heures de la journée (`HH:mm`), pas des dates.
- **`Synchronisation`** a deux fois `dateDebut` (« datebut ») : le second est lu comme `dateFin`.
- Fautes de frappe corrigées : `statusTarifProil` → `statusTarifProfil`, `daateLecture` → `dateLecture`, `desciption` → `description`, `TarifCoeffient` → `TarifCoefficient`.
- **Compteur** : `adresse_mac` est la clé et sert de `deviceId` MQTT (12 hexadécimaux majuscules, ex. `A4CF12345678`). `solde` est conservé, mais c'est un reflet : le compteur fait autorité.
- **`ConfigurationCompteur`** : `seuilsAlarme`, `parametreReseau`, `optionFonctionnement` sont des documents JSON validés par le domaine.
- **Multiplicité « 1 » de s'appliquer** : le profil tarifaire est exigé à l'activation du compteur (`PROFIL_TARIFAIRE_REQUIS`), pas à son enregistrement.

## Questions à trancher sur le diagramme

1. **ProfilTarifaire — JourFerie : `1..*`** ? Le diagramme impose au moins un jour férié par profil. Je ne l'ai pas exigé (un profil sans jour férié est normal) : à confirmer.
2. **Prix d'un crédit** : aucune règle Ariary → crédits dans le diagramme ni dans le cahier des charges. Elle est nécessaire pour calculer `Transaction.credits`.
3. **Gestion du firmware (OTA)** : `VersionFirmware`, `MiseAJourFirmware` et `OfflineSyncRecord` n'existent plus dans ce diagramme (`Compteur.versionFirmware` est un simple texte, `Synchronisation` de type `FIRMWARE` peut tracer un déploiement). L'UC7 du package 3 du PDF (campagnes OTA) n'a donc plus de support de données.
4. **Télémétrie** : `puissance` et `niveauSignal` (PDF, package 4) ne sont pas dans le diagramme.
5. **`Tenant.cin`** : numéro de carte d'identité sur une organisation ? Donnée personnelle sensible, à justifier.
6. **Logement** est rattaché au client (« Avoir »), plus au site : une affectation de compteur à une chambre se fait donc via le client occupant.
