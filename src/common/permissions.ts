/**
 * Catalogue des permissions. Un code = "MODULE:ACTION".
 * La matrice rôle -> permissions ci-dessous est PROVISOIRE : elle doit être validée avec le métier
 * (point ouvert n°4 du cahier des charges) avant toute mise en production.
 */
export const P = {
  COMPTEURS_LIRE: 'COMPTEURS:LIRE',
  COMPTEURS_ENREGISTRER: 'COMPTEURS:ENREGISTRER',
  PREPAIEMENT_VENDRE: 'PREPAIEMENT:VENDRE',
  PREPAIEMENT_HISTORIQUE: 'PREPAIEMENT:HISTORIQUE',
  PREPAIEMENT_ANNULER: 'PREPAIEMENT:ANNULER',
  SOUS_COMPTAGE_LIRE: 'SOUS_COMPTAGE:LIRE',
  ALARMES_LIRE: 'ALARMES:LIRE',
  ALARMES_ACQUITTER: 'ALARMES:ACQUITTER',
  ALARMES_CLOTURER: 'ALARMES:CLOTURER',
  COMMANDES_ENVOYER: 'COMMANDES:ENVOYER',
  TARIFS_GERER: 'TARIFS:GERER',
  ADMIN_UTILISATEURS: 'ADMIN:UTILISATEURS',
  /** Périmètre inter-tenant (technicien Control Room, §09 « vue nationale ») — à tracer dans le journal d'audit. */
  PLATEFORME_VUE_NATIONALE: 'PLATEFORME:VUE_NATIONALE',
} as const;

export type CodePermission = (typeof P)[keyof typeof P];

export const TOUTES_LES_PERMISSIONS: readonly CodePermission[] = Object.values(P);
const TOUTES_LES_PERMISSIONS_LISTE = TOUTES_LES_PERMISSIONS;

export const ROLES_PAR_DEFAUT: ReadonlyArray<{ nom: string; description: string; permissions: readonly CodePermission[] }> = [
  {
    nom: 'Opérateur mini-centrale',
    description: 'Vente, caisse et historique de son propre parc (cahier des charges §09)',
    permissions: [P.COMPTEURS_LIRE, P.PREPAIEMENT_VENDRE, P.PREPAIEMENT_HISTORIQUE, P.PREPAIEMENT_ANNULER, P.ALARMES_LIRE, P.TARIFS_GERER],
  },
  {
    nom: 'Gestionnaire hôtelier',
    description: 'Sous-comptage de ses chambres/baux uniquement (§09)',
    permissions: [P.COMPTEURS_LIRE, P.SOUS_COMPTAGE_LIRE, P.ALARMES_LIRE],
  },
  {
    nom: 'Technicien Control Room',
    description: 'Vue nationale, télécommande d’urgence, acquittement des alarmes (§09)',
    permissions: [P.COMPTEURS_LIRE, P.ALARMES_LIRE, P.ALARMES_ACQUITTER, P.ALARMES_CLOTURER, P.COMMANDES_ENVOYER, P.PLATEFORME_VUE_NATIONALE],
  },
  {
    nom: 'Super administrateur',
    description: 'Compte de la plateforme : administration et vue nationale (un utilisateur n’a qu’un seul rôle)',
    permissions: TOUTES_LES_PERMISSIONS_LISTE,
  },
  {
    nom: 'Super administrateur',
    description: 'Toutes les permissions, y compris la vue nationale (premier compte créé par le seed)',
    permissions: TOUTES_LES_PERMISSIONS,
  },
  {
    nom: 'Administrateur',
    description: 'Gestion des utilisateurs, des compteurs et des tarifs de son tenant',
    permissions: [P.COMPTEURS_LIRE, P.COMPTEURS_ENREGISTRER, P.ADMIN_UTILISATEURS, P.TARIFS_GERER, P.ALARMES_LIRE],
  },
];
