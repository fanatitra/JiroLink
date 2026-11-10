import { timingSafeEqual } from 'node:crypto';
import { arrondi2, garde, normaliserMac } from './shared';
import { INDEX_MAX } from './token-codec';
import type { EtatConnexion, StatusSynchronisation, StatutCompteur, TypeSynchronisation } from './enums';

// ---------------------------------------------------------------------
// ConfigurationCompteur — classe-association de « peut configurer » (Utilisateur — Compteur)
// Les trois attributs du diagramme (seuilsAlarme, parametreReseau, optionFonctionnement) sont
// des documents structurés, validés ici avant d'être stockés en JSON.
// Bornes provisoires : à valider en Phase 0 (point ouvert n°1 : seuil thermique et hystérésis).
// ---------------------------------------------------------------------

export const LIMITES_CONFIG = {
  seuilTemperature: { min: 40, max: 120 }, // °C
  intervalleTelemetrie: { min: 5, max: 3600 }, // secondes
} as const;

export interface SeuilsAlarme {
  seuilTemperature: number;
  hysteresisTemperature: number;
}
export interface ParametreReseau {
  intervalleTelemetrie: number;
  gsmActive: boolean;
}
export interface OptionFonctionnement {
  alarmeIntrusionActive: boolean;
}

export type DecisionThermique = 'COUPER' | 'REARMER' | 'RIEN';

export class ConfigurationCompteur {
  constructor(
    public readonly idConfiguration: string,
    public readonly compteurMac: string,
    public readonly utilisateurId: string, // qui configure
    public readonly version: number,
    public readonly seuilsAlarme: SeuilsAlarme,
    public readonly parametreReseau: ParametreReseau,
    public readonly optionFonctionnement: OptionFonctionnement,
    public readonly dateCreation: Date = new Date(),
    public readonly dateModification?: Date,
  ) {
    const s = LIMITES_CONFIG.seuilTemperature;
    const i = LIMITES_CONFIG.intervalleTelemetrie;
    const { seuilTemperature, hysteresisTemperature } = seuilsAlarme;
    // UC3 pkg 3 / E1-E2 : paramètre invalide, valeur hors limites
    garde(version >= 1 && Number.isInteger(version), 'VERSION_INVALIDE', 'Version de configuration invalide');
    garde(seuilTemperature >= s.min && seuilTemperature <= s.max, 'SEUIL_HORS_LIMITES', `Seuil thermique attendu entre ${s.min} et ${s.max} °C`);
    garde(hysteresisTemperature > 0 && hysteresisTemperature < seuilTemperature, 'HYSTERESIS_INVALIDE', "L'hystérésis doit être > 0 et < seuil");
    garde(
      parametreReseau.intervalleTelemetrie >= i.min && parametreReseau.intervalleTelemetrie <= i.max,
      'INTERVALLE_HORS_LIMITES',
      `Intervalle de télémétrie attendu entre ${i.min} et ${i.max} s`,
    );
  }

  /** Comportement thermique : coupure au seuil, réarmement sous (seuil − hystérésis). */
  decisionThermique(temperature: number, relaisFerme: boolean): DecisionThermique {
    const { seuilTemperature, hysteresisTemperature } = this.seuilsAlarme;
    if (relaisFerme && temperature >= seuilTemperature) return 'COUPER';
    if (!relaisFerme && temperature <= seuilTemperature - hysteresisTemperature) return 'REARMER';
    return 'RIEN';
  }

  /** RM5 pkg 3 : toute modification est historisée -> on ne modifie jamais, on crée la version suivante. */
  nouvelleVersion(p: {
    idConfiguration: string;
    utilisateurId: string;
    seuilsAlarme?: SeuilsAlarme;
    parametreReseau?: ParametreReseau;
    optionFonctionnement?: OptionFonctionnement;
    maintenant?: Date;
  }): ConfigurationCompteur {
    return new ConfigurationCompteur(
      p.idConfiguration,
      this.compteurMac,
      p.utilisateurId,
      this.version + 1,
      p.seuilsAlarme ?? this.seuilsAlarme,
      p.parametreReseau ?? this.parametreReseau,
      p.optionFonctionnement ?? this.optionFonctionnement,
      this.dateCreation,
      p.maintenant ?? new Date(),
    );
  }
}

// ---------------------------------------------------------------------
// Compteur
//
// Le COMPTEUR est l'autorité sur son solde (cahier des charges §08/§10) : il valide les tokens hors
// ligne et décompte la consommation en local (NVS). `solde` (attribut du diagramme) n'est ici qu'un
// REFLET, mis à jour par l'accusé de recharge et la télémétrie : il n'y a volontairement ni crediter()
// ni consommer() côté plateforme.
// ---------------------------------------------------------------------

export interface CompteurProps {
  adresseMac: string; // identifiant (PK du diagramme) ; accepte "aa:bb:…", normalisé en 12 hexa MAJUSCULES
  tenantId: string; // AJOUT (RM8 pkg 3 + isolation)
  numeroSerie: string;
  secretKeyHash: string; // AJOUT : authentification MQTT uniquement (≠ clé des tokens)
  modele?: string;
  versionFirmware?: string;
  statutCompteur?: StatutCompteur;
  etatConnexion?: EtatConnexion;
  solde?: number;
  soldeMisAJourLe?: Date;
  dernierIndexEmis?: number; // AJOUT : séquence des tokens émis (anti-rejeu)
  profilTarifaireId?: string; // « s'appliquer » : exigé pour activer
}

export class Compteur {
  public readonly adresseMac: string;
  public readonly tenantId: string;
  public readonly numeroSerie: string;
  private readonly secretKeyHash: string;
  public modele?: string;
  public versionFirmware?: string;
  public statutCompteur: StatutCompteur;
  public etatConnexion: EtatConnexion;
  private soldeReflet: number;
  private soldeDate?: Date;
  private indexEmis: number;
  public profilTarifaireId?: string;

  constructor(p: CompteurProps) {
    garde(p.numeroSerie.trim().length > 0, 'NUMERO_SERIE_REQUIS', 'Le numéro de série est obligatoire');
    this.adresseMac = normaliserMac(p.adresseMac);
    this.tenantId = p.tenantId;
    this.numeroSerie = p.numeroSerie;
    this.secretKeyHash = p.secretKeyHash;
    this.modele = p.modele;
    this.versionFirmware = p.versionFirmware;
    this.statutCompteur = p.statutCompteur ?? 'ENREGISTRE';
    this.etatConnexion = p.etatConnexion ?? 'HORS_LIGNE';
    this.soldeReflet = p.solde ?? 0;
    this.soldeDate = p.soldeMisAJourLe;
    this.indexEmis = p.dernierIndexEmis ?? 0;
    this.profilTarifaireId = p.profilTarifaireId;
  }

  /** Identifiant du device côté MQTT : jirolink/{adresseMac}/telemetry. */
  get deviceId(): string {
    return this.adresseMac;
  }

  /** Dernier solde connu (reflet ; le compteur fait autorité). */
  get solde(): number {
    return this.soldeReflet;
  }

  get soldeMisAJourLe(): Date | undefined {
    return this.soldeDate;
  }

  get dernierIndexEmis(): number {
    return this.indexEmis;
  }

  /** RM2 pkg 1 / RM4 pkg 3 : un compteur non actif ne peut être rechargé. */
  estRechargeable(): boolean {
    return this.statutCompteur === 'ACTIF';
  }

  /** Réserve l'index du prochain token. En base : UPDATE … SET dernierIndexEmis = dernierIndexEmis + 1 (atomique). */
  reserverIndexToken(): number {
    garde(this.estRechargeable(), 'COMPTEUR_NON_RECHARGEABLE', `Compteur ${this.numeroSerie} non actif : recharge impossible`);
    garde(this.indexEmis < INDEX_MAX, 'INDEX_TOKEN_EPUISE', 'Plus d’index de token disponible pour ce compteur');
    this.indexEmis += 1;
    return this.indexEmis;
  }

  /**
   * Met à jour le reflet du solde depuis un message du compteur (ack de recharge, télémétrie).
   * Un message plus ancien que le solde déjà connu (file hors ligne rejouée) est ignoré.
   */
  enregistrerSolde(solde: number, horodatage: Date): boolean {
    garde(solde >= 0, 'SOLDE_INVALIDE', 'Un solde ne peut pas être négatif');
    if (this.soldeDate && horodatage.getTime() < this.soldeDate.getTime()) return false;
    this.soldeReflet = arrondi2(solde);
    this.soldeDate = horodatage;
    return true;
  }

  estCreditEpuise(): boolean {
    return this.soldeDate !== undefined && this.soldeReflet === 0;
  }

  /**
   * UC4 pkg 3. Conditions : affecté à un client (RM3 pkg 3), configuré (E2), profil tarifaire appliqué
   * (« s'appliquer », multiplicité 1 du diagramme).
   */
  activer(estAffecte: boolean, configuration?: ConfigurationCompteur): void {
    garde(this.statutCompteur !== 'ACTIF', 'COMPTEUR_DEJA_ACTIF', 'Compteur déjà actif');
    garde(estAffecte, 'COMPTEUR_NON_AFFECTE', 'Le compteur doit être affecté avant sa mise en service');
    garde(configuration !== undefined, 'CONFIGURATION_INCOMPLETE', 'Aucune configuration enregistrée');
    garde(this.profilTarifaireId !== undefined, 'PROFIL_TARIFAIRE_REQUIS', 'Un profil tarifaire doit être appliqué au compteur');
    this.statutCompteur = 'ACTIF';
  }

  desactiver(): void {
    garde(this.statutCompteur !== 'DESACTIVE', 'COMPTEUR_DEJA_DESACTIVE', 'Compteur déjà désactivé');
    this.statutCompteur = 'DESACTIVE';
    this.etatConnexion = 'HORS_LIGNE';
  }

  mettreEnMaintenance(): void {
    this.statutCompteur = 'MAINTENANCE';
  }

  /** Un compteur désactivé ne transmet pas de données (RM4 pkg 3). */
  signalerConnexion(etat: EtatConnexion): void {
    garde(this.statutCompteur !== 'DESACTIVE', 'COMPTEUR_DESACTIVE', 'Un compteur désactivé ne transmet pas de données');
    this.etatConnexion = etat;
  }

  appliquerProfilTarifaire(idProfile: string): void {
    this.profilTarifaireId = idProfile;
  }

  appliquerFirmware(version: string): void {
    this.versionFirmware = version;
  }

  /** Compare un hash de secret MQTT (temps constant). */
  verifierSecret(hashCandidat: string): boolean {
    const a = Buffer.from(this.secretKeyHash);
    const b = Buffer.from(hashCandidat);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

// ---------------------------------------------------------------------
// Synchronisation — composition Compteur ◆— 1..* (« Synchroniser »)
// ---------------------------------------------------------------------

export class Synchronisation {
  constructor(
    public readonly idSynchronisation: string,
    public readonly compteurMac: string,
    public readonly typeSynchronisation: TypeSynchronisation,
    public status: StatusSynchronisation = 'EN_ATTENTE',
    public dateDebut: Date = new Date(),
    public dateFin?: Date,
    public readonly donnees?: unknown, // ex. transactions hors ligne à réconcilier
  ) {}

  demarrer(maintenant: Date = new Date()): void {
    garde(this.status === 'EN_ATTENTE', 'SYNC_DEJA_TRAITEE', 'Synchronisation déjà lancée ou terminée');
    this.status = 'EN_COURS';
    this.dateDebut = maintenant;
  }

  terminer(maintenant: Date = new Date()): void {
    garde(this.status === 'EN_COURS', 'SYNC_NON_EN_COURS', 'Synchronisation non en cours');
    this.status = 'TERMINEE';
    this.dateFin = maintenant;
  }

  /** UC7 pkg 1 / E3 : échec de communication ; la reprise repart d'une nouvelle synchronisation. */
  echouer(maintenant: Date = new Date()): void {
    garde(this.status === 'EN_COURS', 'SYNC_NON_EN_COURS', 'Synchronisation non en cours');
    this.status = 'ECHEC';
    this.dateFin = maintenant;
  }

  /** UC7 pkg 1 / E1 : conflit de synchronisation (à arbitrer, le compteur reste l'autorité du solde). */
  signalerConflit(maintenant: Date = new Date()): void {
    garde(this.status === 'EN_COURS', 'SYNC_NON_EN_COURS', 'Synchronisation non en cours');
    this.status = 'CONFLIT';
    this.dateFin = maintenant;
  }
}
