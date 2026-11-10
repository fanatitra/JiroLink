import { garde } from './shared';
import type {
  CanalNotification,
  EtatRelais,
  StatutAlarme,
  StatutCommande,
  StatutNotification,
  TypeAlarme,
  TypeCommande,
} from './enums';

// ---------------------------------------------------------------------
// Telemetrie — composition Compteur ◆— 1..*
// ---------------------------------------------------------------------

export class Telemetrie {
  /**
   * `idTelemetrie` est l'identifiant du diagramme. Clé naturelle d'idempotence : (compteurMac, timestamp). `timestamp` est l'heure DU COMPTEUR (la file hors ligne renvoie des
   * mesures anciennes) ; `recuLe` est l'heure de réception serveur. L'ingestion est idempotente : QoS 1 peut
   * livrer deux fois le même message, la clé naturelle évite le doublon.
   */
  constructor(
    public readonly idTelemetrie: string,
    public readonly compteurMac: string,
    public readonly etatRelais: EtatRelais,
    public readonly timestamp: Date,
    public readonly recuLe: Date = new Date(),
    public readonly tension?: number,
    public readonly courant?: number,
    public readonly temperature?: number,
    public readonly heapLibre?: number,
  ) {}

  /** Délai entre la mesure et sa réception, en secondes (grand = mesure rejouée après coupure réseau). */
  get retardSecondes(): number {
    return Math.max(0, Math.round((this.recuLe.getTime() - this.timestamp.getTime()) / 1000));
  }

  estEnSurchauffe(seuilTemperature: number): boolean {
    return this.temperature !== undefined && this.temperature >= seuilTemperature;
  }
}

// ---------------------------------------------------------------------
// Alarme — composition Compteur ◆— 1..*
// ---------------------------------------------------------------------

export class Alarme {
  constructor(
    public readonly idAlarme: string, // RM1
    public readonly compteurMac: string,
    public readonly type: TypeAlarme,
    public readonly message: string,
    public readonly dateCreation: Date = new Date(), // RM2
    public statut: StatutAlarme = 'DECLENCHEE',
    public dateAcquittement?: Date,
    public acquitteParId?: string, // AJOUT : traçabilité de l'acquittement
  ) {}

  /** UC3 pkg 5 / E1 : alarme déjà acquittée. */
  acquitter(utilisateurId: string, maintenant: Date = new Date()): void {
    garde(this.statut === 'DECLENCHEE', 'ALARME_DEJA_ACQUITTEE', 'Alarme déjà acquittée ou clôturée');
    this.statut = 'ACQUITTEE';
    this.acquitteParId = utilisateurId;
    this.dateAcquittement = maintenant;
  }

  /** RM4 pkg 5 : une alarme ne peut être clôturée qu'après acquittement. */
  cloturer(): void {
    garde(this.statut === 'ACQUITTEE', 'ALARME_NON_ACQUITTEE', "Une alarme doit être acquittée avant d'être clôturée");
    this.statut = 'CLOTUREE';
  }
}

// ---------------------------------------------------------------------
// Notification — composition Alarme ◆— 1..*
// ---------------------------------------------------------------------

export class Notification {
  constructor(
    public readonly idNotification: string,
    public readonly idAlarme: string,
    public readonly canal: CanalNotification,
    public readonly destinataire: string,
    public readonly message: string,
    public statut: StatutNotification = 'EN_ATTENTE',
    public dateEnvoi?: Date,
    public dateLecture?: Date,
  ) {
    garde(destinataire.trim().length > 0, 'DESTINATAIRE_REQUIS', 'Le destinataire est obligatoire');
  }

  marquerEnvoyee(maintenant: Date = new Date()): void {
    garde(this.statut === 'EN_ATTENTE', 'NOTIFICATION_DEJA_TRAITEE', `Notification au statut ${this.statut}`);
    this.statut = 'ENVOYEE';
    this.dateEnvoi = maintenant;
  }

  /** UC5 pkg 5 / E1 : échec d'envoi. */
  echouer(): void {
    garde(this.statut === 'EN_ATTENTE', 'NOTIFICATION_DEJA_TRAITEE', `Notification au statut ${this.statut}`);
    this.statut = 'ECHEC';
  }

  marquerLue(maintenant: Date = new Date()): void {
    garde(this.statut === 'ENVOYEE', 'NOTIFICATION_NON_ENVOYEE', 'Seule une notification envoyée peut être lue');
    this.statut = 'LUE';
    this.dateLecture = maintenant;
  }
}

// ---------------------------------------------------------------------
// Commande — classe-association de « commander » (Utilisateur — Compteur)
// ---------------------------------------------------------------------

export class Commande {
  constructor(
    public readonly idCommande: string, // RM2 pkg 6
    public readonly compteurMac: string,
    public readonly utilisateurId: string,
    public readonly type: TypeCommande,
    public readonly dateExpiration: Date, // AJOUT : RM6 pkg 6
    public readonly payload?: Record<string, unknown>, // AJOUT : paramètres (ex. MODIFIER_CONFIG)
    public statut: StatutCommande = 'EN_ATTENTE',
    public readonly dateCreation: Date = new Date(), // RM3 pkg 6
    public dateExecution?: Date,
    public dateConfirmation?: Date,
  ) {}

  static creer(p: {
    idCommande: string;
    compteurMac: string;
    utilisateurId: string;
    type: TypeCommande;
    payload?: Record<string, unknown>;
    validiteMinutes?: number;
    maintenant?: Date;
  }): Commande {
    const maintenant = p.maintenant ?? new Date();
    return new Commande(
      p.idCommande,
      p.compteurMac,
      p.utilisateurId,
      p.type,
      new Date(maintenant.getTime() + (p.validiteMinutes ?? 15) * 60_000),
      p.payload,
      'EN_ATTENTE',
      maintenant,
    );
  }

  /** RM6 : une commande expirée est automatiquement annulée. Retourne true si elle vient d'expirer. */
  expirerSiDepassee(maintenant: Date = new Date()): boolean {
    const ouverte = this.statut === 'EN_ATTENTE' || this.statut === 'ENVOYEE';
    if (ouverte && maintenant.getTime() > this.dateExpiration.getTime()) {
      this.statut = 'EXPIREE';
      return true;
    }
    return false;
  }

  marquerEnvoyee(maintenant: Date = new Date()): void {
    this.expirerSiDepassee(maintenant);
    garde(this.statut === 'EN_ATTENTE', 'COMMANDE_NON_ENVOYABLE', `Commande au statut ${this.statut}`);
    this.statut = 'ENVOYEE';
  }

  /** RM4 pkg 6 : le compteur doit confirmer l'exécution (succès ou échec). */
  confirmerExecution(succes: boolean, dateExecution: Date, maintenant: Date = new Date()): void {
    this.expirerSiDepassee(maintenant);
    garde(this.statut === 'ENVOYEE', 'COMMANDE_NON_ENVOYEE', `Confirmation impossible au statut ${this.statut}`);
    this.statut = succes ? 'EXECUTEE' : 'ECHOUEE';
    this.dateExecution = dateExecution;
    this.dateConfirmation = maintenant;
  }
}

// ---------------------------------------------------------------------
// JournalAudit — table technique (hors diagramme), immuable
// ---------------------------------------------------------------------

export class JournalAudit {
  private constructor(
    public readonly idEvenement: string,
    public readonly typeEvenement: string,
    public readonly horodatage: Date,
    public readonly description?: string,
    public readonly tenantId?: string,
    public readonly utilisateurId?: string,
    public readonly compteurMac?: string,
    public readonly donneesAvant?: unknown,
    public readonly donneesApres?: unknown,
  ) {}

  static enregistrer(p: {
    idEvenement: string;
    typeEvenement: string;
    description?: string;
    tenantId?: string;
    utilisateurId?: string;
    compteurMac?: string;
    avant?: unknown;
    apres?: unknown;
    maintenant?: Date;
  }): JournalAudit {
    garde(p.typeEvenement.trim().length > 0, 'TYPE_EVENEMENT_REQUIS', "Le type d'événement est obligatoire");
    return new JournalAudit(p.idEvenement, p.typeEvenement, p.maintenant ?? new Date(), p.description, p.tenantId, p.utilisateurId, p.compteurMac, p.avant, p.apres);
  }
}
