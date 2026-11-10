# Où est chaque classe du diagramme ?

Les 22 classes du diagramme existent toutes, dans le schéma de base de données et dans le domaine. Ce tableau indique où les trouver et ce qui reste à construire. Il est vérifié automatiquement par `src/diagramme.test.ts` (lancé par `npm test`).

| Classe | Domaine (règles de gestion) | Base de données | API (endpoints) |
|---|---|---|---|
| Tenant | `src/domain/administration.ts` (ligne 4) | `prisma/schema.prisma` (ligne 166) | à faire |
| Utilisateur | `src/domain/administration.ts` (ligne 60) | `prisma/schema.prisma` (ligne 243) | connexion seulement (`/auth/login`) |
| Role | `src/domain/administration.ts` (ligne 31) | `prisma/schema.prisma` (ligne 230) | lu à la connexion (permissions du JWT) |
| Site | `src/domain/clients-sites.ts` (ligne 5) | `prisma/schema.prisma` (ligne 185) | à faire |
| Client | `src/domain/clients-sites.ts` (ligne 21) | `prisma/schema.prisma` (ligne 202) | à faire |
| Logement | `src/domain/clients-sites.ts` (ligne 34) | `prisma/schema.prisma` (ligne 217) | à faire |
| AffectationCompteur | `src/domain/prepaiement.ts` (ligne 10) | `prisma/schema.prisma` (ligne 310) | à faire |
| Transaction | `src/domain/prepaiement.ts` (ligne 36) | `prisma/schema.prisma` (ligne 366) | à faire |
| Facture | `src/domain/prepaiement.ts` (ligne 82) | `prisma/schema.prisma` (ligne 386) | à faire |
| Token | `src/domain/prepaiement.ts` (ligne 114) | `prisma/schema.prisma` (ligne 403) | à faire |
| Compteur | `src/domain/compteurs.ts` (ligne 113) | `prisma/schema.prisma` (ligne 273) | ✔ enregistrer, lister, lire (`/compteurs`) |
| ConfigurationCompteur | `src/domain/compteurs.ts` (ligne 32) | `prisma/schema.prisma` (ligne 328) | à faire |
| Synchronisation | `src/domain/compteurs.ts` (ligne 238) | `prisma/schema.prisma` (ligne 347) | à faire |
| ProfilTarifaire | `src/domain/tarifs.ts` (ligne 115) | `prisma/schema.prisma` (ligne 424) | à faire |
| PlageHoraire | `src/domain/tarifs.ts` (ligne 21) | `prisma/schema.prisma` (ligne 458) | à faire |
| TarifCoefficient | `src/domain/tarifs.ts` (ligne 4) | `prisma/schema.prisma` (ligne 474) | à faire |
| JourFerie | `src/domain/tarifs.ts` (ligne 78) | `prisma/schema.prisma` (ligne 487) | à faire |
| ModificationTarif | `src/domain/tarifs.ts` (ligne 102) | `prisma/schema.prisma` (ligne 444) | à faire |
| Telemetrie | `src/domain/supervision.ts` (ligne 16) | `prisma/schema.prisma` (ligne 510) | à faire |
| Alarme | `src/domain/supervision.ts` (ligne 48) | `prisma/schema.prisma` (ligne 529) | à faire |
| Notification | `src/domain/supervision.ts` (ligne 79) | `prisma/schema.prisma` (ligne 549) | à faire |
| Commande | `src/domain/supervision.ts` (ligne 116) | `prisma/schema.prisma` (ligne 566) | à faire |

Table technique hors diagramme : `JournalAudit` (`prisma/schema.prisma`).

## Lecture du tableau

- **Domaine** : la classe avec ses règles (ex. `Alarme.cloturer()` refuse si l'alarme n'est pas acquittée). Plusieurs classes d'un même package partagent un fichier.
- **Base de données** : le modèle Prisma, qui devient une table à la migration.
- **API** : seul `Compteur` a ses endpoints, et `Utilisateur`/`Role` servent à la connexion. Pour les 19 autres classes, les endpoints (créer, lister, modifier) restent à écrire.
