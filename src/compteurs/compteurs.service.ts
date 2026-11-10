import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { deriverCleCompteur } from '../domain';
import { Env, ENV } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { estVueNationale, filtreTenant } from '../common/tenant-scope';
import type { UtilisateurCourant } from '../common/auth.types';
import type { CreerCompteurDto, ListerCompteursDto } from './compteurs.dto';

/** Champs exposés : secretKeyHash n'est jamais lu ni renvoyé. */
const SELECTION = {
  adresseMac: true,
  tenantId: true,
  numeroSerie: true,
  modele: true,
  versionFirmware: true,
  statutCompteur: true,
  etatConnexion: true,
  solde: true,
  soldeMisAJourLe: true,
  profilTarifaireId: true,
} satisfies Prisma.CompteurSelect;

type CompteurSelectionne = Prisma.CompteurGetPayload<{ select: typeof SELECTION }>;

export interface CompteurVue {
  adresseMac: string;
  tenantId: string;
  numeroSerie: string;
  modele: string | null;
  versionFirmware: string | null;
  statutCompteur: string;
  etatConnexion: string;
  /** Reflet du solde : le compteur fait autorité (cahier des charges §08). */
  solde: number;
  soldeMisAJourLe: Date | null;
  profilTarifaireId: string | null;
}

function vue(c: CompteurSelectionne): CompteurVue {
  return {
    adresseMac: c.adresseMac,
    tenantId: c.tenantId,
    numeroSerie: c.numeroSerie,
    modele: c.modele,
    versionFirmware: c.versionFirmware,
    statutCompteur: c.statutCompteur,
    etatConnexion: c.etatConnexion,
    solde: Number(c.solde),
    soldeMisAJourLe: c.soldeMisAJourLe,
    profilTarifaireId: c.profilTarifaireId,
  };
}

@Injectable()
export class CompteursService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Enregistre un compteur dans le tenant de l'appelant et fabrique ses identifiants de provisionnement.
   * Les secrets ne sont renvoyés QU'ICI, une seule fois : le secret MQTT n'est conservé que haché.
   */
  async enregistrer(user: UtilisateurCourant, dto: CreerCompteurDto) {
    const mqttSecret = randomBytes(32).toString('hex');
    const secretKeyHash = await bcrypt.hash(mqttSecret, 10);

    let cree: CompteurSelectionne;
    try {
      // Le compteur et sa trace d'audit sont écrits dans la même transaction.
      [cree] = await this.prisma.$transaction([
        this.prisma.compteur.create({
          data: { adresseMac: dto.adresseMac, tenantId: user.tenantId, numeroSerie: dto.numeroSerie, modele: dto.modele, secretKeyHash },
          select: SELECTION,
        }),
        this.prisma.journalAudit.create({
          data: {
            tenantId: user.tenantId,
            utilisateurId: user.idUtilisateur,
            compteurMac: dto.adresseMac,
            typeEvenement: 'COMPTEUR_ENREGISTRE',
            description: `Compteur ${dto.numeroSerie} (${dto.adresseMac}) enregistré`,
            donneesApres: { adresseMac: dto.adresseMac, numeroSerie: dto.numeroSerie },
          },
        }),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Un compteur avec cette adresse MAC ou ce numéro de série existe déjà');
      }
      throw e;
    }

    return {
      compteur: vue(cree),
      provisioning: {
        deviceId: cree.adresseMac,
        mqttSecret,
        tokenKeyHex: deriverCleCompteur(this.env.tokenRootKey, cree.adresseMac).toString('hex'),
        avertissement: 'Ces secrets ne sont affichés qu’une seule fois : à injecter dans le compteur (menu Maintenance) puis à ne conserver nulle part.',
      },
    };
  }

  async lister(user: UtilisateurCourant, q: ListerCompteursDto) {
    const lignes = await this.prisma.compteur.findMany({
      where: { ...filtreTenant(user) },
      select: SELECTION,
      orderBy: { adresseMac: 'asc' },
      take: q.limit,
      skip: q.offset,
    });
    return lignes.map(vue);
  }

  async obtenir(user: UtilisateurCourant, adresseMac: string) {
    // Le filtre de tenant est dans le WHERE : un compteur d'un autre tenant est indistinguable d'un compteur inexistant.
    const c = await this.prisma.compteur.findFirst({
      where: { adresseMac, ...filtreTenant(user) },
      select: SELECTION,
    });
    if (!c) throw new NotFoundException('Compteur introuvable');

    // Un accès inter-tenant (vue nationale) est tracé : c'est une exception à l'isolation, elle doit être auditable.
    if (estVueNationale(user) && c.tenantId !== user.tenantId) {
      await this.prisma.journalAudit.create({
        data: {
          tenantId: c.tenantId,
          utilisateurId: user.idUtilisateur,
          compteurMac: c.adresseMac,
          typeEvenement: 'LECTURE_INTER_TENANT',
          description: `Lecture du compteur ${c.adresseMac} par la vue nationale`,
        },
      });
    }
    return vue(c);
  }
}
