import { garde } from './shared';
import type { StatutLogement } from './enums';

/** Tenant ◇— 1..* Site. */
export class Site {
  constructor(
    public readonly idSite: string,
    public readonly tenantId: string,
    public name: string,
    public province?: string,
    public latitude?: number,
    public longitude?: number,
  ) {
    garde(name.trim().length > 0, 'SITE_NOM_REQUIS', 'Le nom du site est obligatoire');
    if (latitude !== undefined) garde(latitude >= -90 && latitude <= 90, 'LATITUDE_INVALIDE', 'Latitude hors limites');
    if (longitude !== undefined) garde(longitude >= -180 && longitude <= 180, 'LONGITUDE_INVALIDE', 'Longitude hors limites');
  }
}

/** Site ◇— 1..* Client : un client est rattaché à un site (donc, par lui, à un tenant). */
export class Client {
  constructor(
    public readonly idClient: string,
    public readonly siteId: string,
    public nom: string,
    public prenom?: string,
    public adresse?: string,
  ) {
    garde(nom.trim().length > 0, 'CLIENT_NOM_REQUIS', 'Le nom du client est obligatoire');
  }
}

/** Client 1 — « Avoir » — 1..* Logement (chambre, bail, local commercial). */
export class Logement {
  constructor(
    public readonly idLogement: string,
    public readonly clientId: string,
    public reference: string,
    public type?: string,
    public statut: StatutLogement = 'LIBRE',
  ) {
    garde(reference.trim().length > 0, 'LOGEMENT_REFERENCE_REQUISE', 'La référence du logement est obligatoire');
  }

  occuper(): void {
    garde(this.statut === 'LIBRE', 'LOGEMENT_OCCUPE', `Le logement ${this.reference} est déjà occupé`);
    this.statut = 'OCCUPE';
  }

  liberer(): void {
    this.statut = 'LIBRE';
  }
}
