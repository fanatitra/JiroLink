import { garde } from './shared';
import type { StatutLogement, StatutSite } from './enums';

export class Client {
  constructor(
    public readonly clientId: string,
    public readonly tenantId: string,
    public nom: string,
    public telephone?: string,
    public email?: string,
    public readonly dateCreation: Date = new Date(),
  ) {
    garde(nom.trim().length > 0, 'CLIENT_NOM_REQUIS', 'Le nom du client est obligatoire');
  }
}

export class Site {
  constructor(
    public readonly siteId: string,
    public readonly tenantId: string,
    public nom: string,
    public typeSite?: string, // MINI_CENTRALE, HOTEL, PYLONE, POSTE_HTA_BT
    public province?: string,
    public statutSite: StatutSite = 'ACTIF',
    public latitude?: number,
    public longitude?: number,
    public adresse?: string,
  ) {
    garde(nom.trim().length > 0, 'SITE_NOM_REQUIS', 'Le nom du site est obligatoire');
    if (latitude !== undefined) garde(latitude >= -90 && latitude <= 90, 'LATITUDE_INVALIDE', 'Latitude hors limites');
    if (longitude !== undefined) garde(longitude >= -180 && longitude <= 180, 'LONGITUDE_INVALIDE', 'Longitude hors limites');
  }
}

/** Chambre d'hôtel, bail, local commercial (sous-comptage). */
export class Logement {
  constructor(
    public readonly logementId: string,
    public readonly siteId: string,
    public identifiant: string,
    public typeLogement?: string,
    public statut: StatutLogement = 'LIBRE',
  ) {}

  occuper(): void {
    garde(this.statut === 'LIBRE', 'LOGEMENT_OCCUPE', `Le logement ${this.identifiant} est déjà occupé`);
    this.statut = 'OCCUPE';
  }

  liberer(): void {
    this.statut = 'LIBRE';
  }
}
