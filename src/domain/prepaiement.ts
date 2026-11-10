import { createHmac } from 'node:crypto';
import { garde } from './shared';
import { deriverCleCompteur, emettreToken } from './token-codec';
import type { ModeDePaiement, StatusPaiement, StatusToken, StatusTransaction, TypeTransaction } from './enums';

// ---------------------------------------------------------------------
// AffectationCompteur — classe-association de « Associer » (Client 1..* — 1..* Compteur)
// ---------------------------------------------------------------------

export class AffectationCompteur {
  constructor(
    public readonly idAffectation: string,
    public readonly clientId: string,
    public readonly compteurMac: string,
    public readonly dateDebut: Date = new Date(),
    public dateFin?: Date,
  ) {}

  /** Active tant que dateFin est nulle. */
  estActive(): boolean {
    return this.dateFin === undefined;
  }

  /** UC5 pkg 8 : l'historique est conservé (RM3), on ne supprime jamais. */
  terminer(maintenant: Date = new Date()): void {
    garde(this.estActive(), 'AFFECTATION_DEJA_TERMINEE', 'Affectation déjà terminée');
    garde(maintenant.getTime() >= this.dateDebut.getTime(), 'DATE_FIN_INVALIDE', 'La fin précède le début');
    this.dateFin = maintenant;
  }
}

// ---------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------

export class Transaction {
  constructor(
    public readonly idTransaction: string, // RM6 : identifiant unique
    public readonly type: TypeTransaction,
    public readonly montant: number,
    public readonly credits: number, // AJOUT : crédits correspondant au montant (requis pour émettre le token)
    public statusTransaction: StatusTransaction = 'EN_ATTENTE',
    public modeDePaiement?: ModeDePaiement,
    public statusPaiement: StatusPaiement = 'EN_ATTENTE',
    public readonly dateTransaction: Date = new Date(),
  ) {
    garde(montant > 0, 'MONTANT_INVALIDE', 'Le montant doit être strictement positif');
    garde(credits > 0, 'CREDITS_INVALIDES', 'Le nombre de crédits doit être strictement positif');
  }

  /** Paiement accepté : la transaction devient définitive (RM7). */
  confirmerPaiement(): void {
    garde(this.statusTransaction === 'EN_ATTENTE', 'TRANSACTION_NON_EN_ATTENTE', 'Transaction déjà traitée');
    this.statusPaiement = 'PAYE';
    this.statusTransaction = 'VALIDEE';
  }

  /** UC1 / E3 : paiement refusé. */
  refuserPaiement(): void {
    garde(this.statusTransaction === 'EN_ATTENTE', 'TRANSACTION_NON_EN_ATTENTE', 'Transaction déjà traitée');
    this.statusPaiement = 'REFUSE';
    this.statusTransaction = 'ECHOUEE';
  }

  /**
   * UC6 — RM7 : une transaction validée n'est jamais supprimée, seulement annulée.
   * E1 recharge déjà consommée · E2 droits insuffisants.
   */
  annuler(contexte: { creditsConsommes: boolean; autorise: boolean }): void {
    garde(contexte.autorise, 'ANNULATION_NON_AUTORISEE', 'Droits insuffisants pour annuler');
    garde(this.statusTransaction !== 'ANNULEE', 'TRANSACTION_DEJA_ANNULEE', 'Transaction déjà annulée');
    garde(!contexte.creditsConsommes, 'RECHARGE_DEJA_CONSOMMEE', 'La recharge a déjà été consommée');
    this.statusTransaction = 'ANNULEE';
  }
}

// ---------------------------------------------------------------------
// Facture — classe-association de l'association ternaire Utilisateur — AffectationCompteur — Transaction
// Elle rattache la transaction à son compteur (via l'affectation), à son client et à l'agent vendeur.
// ---------------------------------------------------------------------

export class Facture {
  private constructor(
    public readonly idFacture: string,
    public readonly transactionId: string,
    public readonly affectationId: string,
    public readonly utilisateurId: string,
    public readonly dateFacture: Date,
  ) {}

  static emettre(p: {
    idFacture: string;
    transaction: Transaction;
    affectation: AffectationCompteur;
    utilisateurId: string;
    maintenant?: Date;
  }): Facture {
    garde(p.affectation.estActive(), 'AFFECTATION_TERMINEE', 'Vente impossible : le compteur n’est plus affecté à ce client');
    garde(p.transaction.statusTransaction !== 'ECHOUEE', 'TRANSACTION_ECHOUEE', 'Aucune facture pour une transaction échouée');
    return new Facture(p.idFacture, p.transaction.idTransaction, p.affectation.idAffectation, p.utilisateurId, p.maintenant ?? new Date());
  }
}

// ---------------------------------------------------------------------
// Token — « Generer » : Token 0..1 — 1 Transaction
// La validation du code se fait dans le COMPTEUR, hors ligne : voir token-codec.ts.
// ---------------------------------------------------------------------

/** Le code n'est jamais stocké en clair : HMAC-SHA256 avec un secret (pepper) serveur. */
export function hacherCode(code: string, secretServeur: string): string {
  return createHmac('sha256', secretServeur).update(code).digest('hex');
}

export class Token {
  constructor(
    public readonly idToken: string,
    public readonly transactionId: string,
    public readonly compteurMac: string,
    private readonly codeHash: string,
    public readonly sequenceIndex: number, // anti-rejeu
    public readonly dateExpiration: Date,
    public status: StatusToken = 'GENERE',
    public readonly dateCreation: Date = new Date(),
  ) {}

  /**
   * Émet un token pour un compteur. Le code en clair n'est remis au client qu'une seule fois ; la plateforme
   * n'en conserve que le hash (traçabilité).
   */
  static emettre(p: {
    idToken: string;
    transactionId: string;
    compteurMac: string; // = deviceId
    sequenceIndex: number;
    credits: number;
    cleRacine: Buffer;
    pepperServeur: string;
    validiteHeures?: number;
    maintenant?: Date;
  }): { token: Token; codeEnClair: string } {
    const maintenant = p.maintenant ?? new Date();
    const cleCompteur = deriverCleCompteur(p.cleRacine, p.compteurMac);
    const code = emettreToken({ cleCompteur, sequenceIndex: p.sequenceIndex, credits: p.credits });
    const token = new Token(
      p.idToken,
      p.transactionId,
      p.compteurMac,
      hacherCode(code, p.pepperServeur),
      p.sequenceIndex,
      // Expiration côté plateforme uniquement : un compteur sans horloge fiable ne peut pas l'imposer.
      new Date(maintenant.getTime() + (p.validiteHeures ?? 72) * 3_600_000),
      'GENERE',
      maintenant,
    );
    return { token, codeEnClair: code };
  }

  /**
   * Appelé à réception de l'accusé de recharge (ou de la synchro hors ligne). Le compteur fait autorité :
   * même un token que la plateforme avait déjà marqué EXPIRE devient UTILISE si le compteur l'a accepté.
   */
  marquerUtilise(): void {
    garde(this.status !== 'UTILISE', 'TOKEN_DEJA_UTILISE', 'Token déjà marqué utilisé');
    this.status = 'UTILISE';
  }

  expirer(): void {
    if (this.status === 'GENERE') this.status = 'EXPIRE';
  }
}
