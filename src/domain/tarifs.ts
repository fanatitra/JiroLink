import { cleJour, garde, hhmmEnMinutes } from './shared';
import type { StatusTarifProfil } from './enums';

export class TarifCoefficient {
  constructor(
    public readonly idTarifCoef: string,
    public readonly valeur: number,
    public readonly priorite: number = 0,
  ) {
    // UC4 pkg 2 / E1 : coefficient négatif ou nul interdit
    garde(valeur > 0, 'COEFFICIENT_INVALIDE', 'Le coefficient doit être strictement positif');
  }
}

type Segment = readonly [debut: number, fin: number];

/**
 * Plage horaire (jour, nuit, pointe…). Le diagramme nomme ses bornes « dateDepart / dateFin » :
 * ce sont des heures de la journée au format "HH:mm". Une plage peut franchir minuit : "22:00" -> "06:00".
 */
export class PlageHoraire {
  private readonly liste: TarifCoefficient[] = [];
  private readonly debutMin: number;
  private readonly finMin: number;

  constructor(
    public readonly idPlageHoraire: string,
    public readonly libelle: string,
    public readonly dateDepart: string,
    public readonly dateFin: string,
  ) {
    this.debutMin = hhmmEnMinutes(dateDepart);
    this.finMin = hhmmEnMinutes(dateFin);
    garde(this.debutMin !== this.finMin, 'PLAGE_VIDE', 'Heure de début et de fin identiques'); // UC3 / E2
  }

  /** « Peut avoir » : 1..* coefficients. */
  get coefficients(): readonly TarifCoefficient[] {
    return this.liste;
  }

  ajouterCoefficient(c: TarifCoefficient): void {
    this.liste.push(c);
  }

  private segments(): Segment[] {
    return this.debutMin < this.finMin
      ? [[this.debutMin, this.finMin]]
      : [
          [this.debutMin, 1440],
          [0, this.finMin],
        ];
  }

  contient(minutesDepuisMinuit: number): boolean {
    return this.segments().some(([a, b]) => minutesDepuisMinuit >= a && minutesDepuisMinuit < b);
  }

  /** UC3 / E1 : détection de chevauchement. */
  chevauche(autre: PlageHoraire): boolean {
    return this.segments().some(([a1, b1]) => autre.segments().some(([a2, b2]) => a1 < b2 && a2 < b1));
  }

  /** Coefficient de plus haute priorité (RM5 pkg 2). */
  coefficientEffectif(): number {
    garde(this.liste.length >= 1, 'PLAGE_SANS_COEFFICIENT', `La plage "${this.libelle}" n'a aucun coefficient`);
    return this.liste.reduce((m, c) => (c.priorite > m.priorite ? c : m)).valeur;
  }

  cloner(genId: () => string): PlageHoraire {
    const copie = new PlageHoraire(genId(), this.libelle, this.dateDepart, this.dateFin);
    this.liste.forEach((c) => copie.ajouterCoefficient(new TarifCoefficient(genId(), c.valeur, c.priorite)));
    return copie;
  }
}

/** Jour férié ou période exceptionnelle. Dates "YYYY-MM-DD", bornes incluses. */
export class JourFerie {
  constructor(
    public readonly idJourFerie: string,
    public readonly dateDebut: string,
    public readonly dateFin: string,
    public readonly specialCoefficient: number,
    public readonly libelle?: string,
  ) {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    garde(iso.test(dateDebut) && iso.test(dateFin), 'DATE_INVALIDE', 'Dates attendues au format YYYY-MM-DD');
    garde(dateDebut <= dateFin, 'PERIODE_INVALIDE', 'La date de fin précède la date de début');
    garde(specialCoefficient > 0, 'COEFFICIENT_INVALIDE', 'Le coefficient doit être strictement positif');
  }

  couvre(jour: string): boolean {
    return jour >= this.dateDebut && jour <= this.dateFin;
  }

  chevauche(autre: JourFerie): boolean {
    return this.dateDebut <= autre.dateFin && autre.dateDebut <= this.dateFin;
  }
}

/** Classe-association de « modifier » (Utilisateur — ProfilTarifaire) : une ligne par modification (RM8 pkg 2). */
export class ModificationTarif {
  private constructor(
    public readonly idModification: string,
    public readonly idProfile: string,
    public readonly utilisateurId: string,
    public readonly dateModification: Date,
  ) {}

  static enregistrer(p: { idModification: string; idProfile: string; utilisateurId: string; maintenant?: Date }): ModificationTarif {
    return new ModificationTarif(p.idModification, p.idProfile, p.utilisateurId, p.maintenant ?? new Date());
  }
}

export class ProfilTarifaire {
  private readonly listePlages: PlageHoraire[] = [];
  private readonly listeJoursFeries: JourFerie[] = [];

  constructor(
    public readonly idProfile: string,
    public readonly tenantId: string,
    public readonly nom: string,
    public readonly versionProfil: number = 1,
    public statusTarifProfil: StatusTarifProfil = 'BROUILLON',
    public dateActivation?: Date,
    public description?: string,
  ) {
    garde(nom.trim().length > 0, 'PROFIL_NOM_REQUIS', 'Le nom du profil est obligatoire'); // UC1 / E2
  }

  /** « Contenir » : composition, 1..* plages. */
  get plages(): readonly PlageHoraire[] {
    return this.listePlages;
  }

  /** « posseder » : agrégation de jours fériés. */
  get joursFeries(): readonly JourFerie[] {
    return this.listeJoursFeries;
  }

  private verifierModifiable(): void {
    // RM2 : un profil validé n'est jamais modifié, on crée une nouvelle version
    garde(this.statusTarifProfil === 'BROUILLON', 'PROFIL_VERROUILLE', 'Profil non modifiable : créez une nouvelle version (nouvelleVersion())');
  }

  ajouterPlage(plage: PlageHoraire): void {
    this.verifierModifiable();
    garde(!this.listePlages.some((p) => p.chevauche(plage)), 'PLAGES_CHEVAUCHANTES', `La plage "${plage.libelle}" chevauche une plage existante`);
    this.listePlages.push(plage);
  }

  ajouterJourFerie(regle: JourFerie): void {
    this.verifierModifiable();
    garde(!this.listeJoursFeries.some((r) => r.chevauche(regle)), 'JOUR_FERIE_EN_CONFLIT', 'Une règle exceptionnelle existe déjà sur cette période');
    this.listeJoursFeries.push(regle);
  }

  /**
   * Multiplicités du diagramme : 1..* plage(s) par profil, 1..* coefficient(s) par plage.
   * Le diagramme indique aussi 1..* jour(s) férié(s) par profil : volontairement NON exigé ici
   * (un profil sans jour férié est un cas normal) — à confirmer.
   */
  estComplet(): boolean {
    return this.listePlages.length >= 1 && this.listePlages.every((p) => p.coefficients.length >= 1);
  }

  /** RM2 : toute modification passe par une nouvelle version (brouillon). */
  nouvelleVersion(genId: () => string): ProfilTarifaire {
    const v = new ProfilTarifaire(genId(), this.tenantId, this.nom, this.versionProfil + 1, 'BROUILLON', undefined, this.description);
    this.listePlages.forEach((p) => v.listePlages.push(p.cloner(genId)));
    this.listeJoursFeries.forEach((r) => v.listeJoursFeries.push(new JourFerie(genId(), r.dateDebut, r.dateFin, r.specialCoefficient, r.libelle)));
    return v;
  }

  /** RM6 / UC6 : programmer une activation future. */
  programmer(dateActivation: Date, maintenant: Date = new Date()): void {
    garde(this.estComplet(), 'PROFIL_INCOMPLET', 'Profil incomplet');
    garde(dateActivation.getTime() > maintenant.getTime(), 'DATE_PASSEE', "La date d'activation doit être future");
    this.statusTarifProfil = 'PROGRAMME';
    this.dateActivation = dateActivation;
  }

  /** UC7 : l'ancien profil actif doit être archivé par le service appelant (RM1). */
  activer(maintenant: Date = new Date()): void {
    garde(this.estComplet(), 'PROFIL_INCOMPLET', 'Profil incomplet'); // E1
    garde(this.statusTarifProfil !== 'ACTIF', 'PROFIL_DEJA_ACTIF', 'Profil déjà actif'); // E2
    this.statusTarifProfil = 'ACTIF';
    this.dateActivation = maintenant;
  }

  archiver(): void {
    this.statusTarifProfil = 'ARCHIVE';
  }

  /** Coefficient applicable à un instant donné. RM4 : un jour férié est prioritaire sur les plages horaires. */
  coefficientPour(instant: Date): number {
    const jour = cleJour(instant);
    const ferie = this.listeJoursFeries.find((r) => r.couvre(jour));
    if (ferie) return ferie.specialCoefficient;

    const minutes = instant.getHours() * 60 + instant.getMinutes();
    const plage = this.listePlages.find((p) => p.contient(minutes));
    garde(plage !== undefined, 'AUCUNE_PLAGE', `Aucune plage horaire ne couvre ${instant.toTimeString().slice(0, 5)}`);
    return plage.coefficientEffectif();
  }
}
