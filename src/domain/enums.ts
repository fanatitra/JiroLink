// Miroir TypeScript des enums du schéma Prisma (le domaine reste indépendant de @prisma/client).

export type TypeTenant = 'PLATEFORME' | 'MINI_CENTRALE' | 'HOTEL' | 'TELECOM';
export type StatusTenant = 'ACTIF' | 'SUSPENDU';
export type StatusUtilisateur = 'ACTIF' | 'DESACTIVE' | 'VERROUILLE';
export type StatutSite = 'ACTIF' | 'SUSPENDU';
export type StatutLogement = 'LIBRE' | 'OCCUPE';

export type StatutCompteur = 'ENREGISTRE' | 'ACTIF' | 'MAINTENANCE' | 'DESACTIVE';
export type EtatConnexion = 'EN_LIGNE' | 'HORS_LIGNE';
export type TypeSynchronisation = 'TRANSACTIONS' | 'CONFIGURATION' | 'PROFIL_TARIFAIRE' | 'FIRMWARE';
export type StatusSynchronisation = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINEE' | 'ECHEC' | 'CONFLIT';

export type StatusTarifProfil = 'BROUILLON' | 'PROGRAMME' | 'ACTIF' | 'ARCHIVE';

export type TypeTransaction = 'VENTE' | 'RECHARGE_TOKEN' | 'RECHARGE_DISTANTE' | 'ANNULATION';
export type StatusTransaction = 'EN_ATTENTE' | 'VALIDEE' | 'ANNULEE' | 'ECHOUEE';
export type ModeDePaiement = 'ESPECES' | 'MOBILE_MONEY';
export type StatusPaiement = 'EN_ATTENTE' | 'PAYE' | 'REFUSE';
export type StatusToken = 'GENERE' | 'UTILISE' | 'EXPIRE';

export type EtatRelais = 'OUVERT' | 'FERME';
export type TypeAlarme = 'SURCHAUFFE' | 'INTRUSION' | 'COUPURE_ANORMALE' | 'AUTRE';
export type StatutAlarme = 'DECLENCHEE' | 'ACQUITTEE' | 'CLOTUREE';
export type CanalNotification = 'SMS' | 'EMAIL' | 'PUSH' | 'DASHBOARD';
export type StatutNotification = 'EN_ATTENTE' | 'ENVOYEE' | 'LUE' | 'ECHEC';
export type TypeCommande = 'COUPER_RELAIS' | 'REACTIVER_RELAIS' | 'REDEMARRER' | 'SYNC_HEURE' | 'MODIFIER_CONFIG';
export type StatutCommande = 'EN_ATTENTE' | 'ENVOYEE' | 'EXECUTEE' | 'ECHOUEE' | 'EXPIREE';
