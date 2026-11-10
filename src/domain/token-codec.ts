/**
 * Format de token de recharge "JLT1" — validable HORS LIGNE par le compteur.
 *
 * Le compteur n'a aucune base de données : le token doit donc porter lui-même
 * son contenu (index de séquence + crédits) et une signature calculée avec une
 * clé propre à ce compteur. Spécification complète pour le firmware : docs/token-format.md
 *
 *   Clé compteur  K_m   = HMAC-SHA256(cléRacine, "JIROLINK-TOKEN-KEY-V1|" + deviceId)
 *   En-tête (48 bits)   = version(4) | index(20) | crédits en centièmes(24)   [big-endian]
 *   MAC (24 bits)       = 3 premiers octets de HMAC-SHA256(K_m, en-tête sur 6 octets)
 *   Token (23 chiffres) = en-tête en décimal sur 15 chiffres + MAC en décimal sur 8 chiffres
 *
 * Cet algorithme est un choix PROVISOIRE et volontairement simple à porter
 * sur ESP32 (mbedTLS) : il pourra être remplacé par STS (point ouvert n°2 du
 * cahier des charges) sans toucher au reste du domaine, car tout passe par
 * emettreToken() / verifierToken().
 *
 * Exigences côté firmware (sinon le MAC de 24 bits est trop faible) :
 *  - verrouillage après N saisies erronées (ex. 5 essais puis 15 min de blocage) ;
 *  - mémoriser en NVS le dernier index accepté et refuser tout index <= à celui-ci.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { garde } from './shared';

export const TOKEN_VERSION = 1;
export const TOKEN_LONGUEUR = 23;
export const INDEX_MAX = 2 ** 20 - 1; // 1 048 575 tokens par compteur
export const CREDITS_CENTIEMES_MAX = 2 ** 24 - 1; // 167 772,15 crédits par token

const PREFIXE_DERIVATION = 'JIROLINK-TOKEN-KEY-V1|';
const LONGUEUR_ENTETE = 15; // 2^48 - 1 = 281 474 976 710 655 (15 chiffres)
const LONGUEUR_MAC = 8; // 2^24 - 1 = 16 777 215 (8 chiffres)

/** Dérive la clé d'un compteur depuis la clé racine (la clé racine ne quitte jamais le serveur). */
export function deriverCleCompteur(cleRacine: Buffer, deviceId: string): Buffer {
  garde(cleRacine.length >= 32, 'CLE_RACINE_FAIBLE', 'La clé racine doit faire au moins 32 octets');
  garde(deviceId.length > 0, 'DEVICE_ID_REQUIS', 'deviceId requis');
  return createHmac('sha256', cleRacine).update(PREFIXE_DERIVATION + deviceId, 'utf8').digest();
}

function octetsEntete(entete: bigint): Buffer {
  const b = Buffer.alloc(6);
  b.writeUIntBE(Number(entete >> 24n), 0, 3);
  b.writeUIntBE(Number(entete & 0xffffffn), 3, 3);
  return b;
}

function calculerMac(cleCompteur: Buffer, entete: bigint): number {
  const h = createHmac('sha256', cleCompteur).update(octetsEntete(entete)).digest();
  return h.readUIntBE(0, 3);
}

export function emettreToken(p: {
  cleCompteur: Buffer;
  sequenceIndex: number;
  credits: number;
}): string {
  const centiemes = Math.round(p.credits * 100);
  garde(Number.isInteger(p.sequenceIndex) && p.sequenceIndex >= 1 && p.sequenceIndex <= INDEX_MAX, 'INDEX_HORS_LIMITES', `Index de séquence attendu entre 1 et ${INDEX_MAX}`);
  garde(centiemes >= 1 && centiemes <= CREDITS_CENTIEMES_MAX, 'CREDITS_HORS_LIMITES', `Crédits attendus entre 0,01 et ${CREDITS_CENTIEMES_MAX / 100}`);

  const entete = (BigInt(TOKEN_VERSION) << 44n) | (BigInt(p.sequenceIndex) << 24n) | BigInt(centiemes);
  const mac = calculerMac(p.cleCompteur, entete);
  return entete.toString().padStart(LONGUEUR_ENTETE, '0') + String(mac).padStart(LONGUEUR_MAC, '0');
}

export interface TokenVerifie {
  sequenceIndex: number;
  credits: number;
}

/**
 * Implémentation de référence de ce que fait le COMPTEUR à la saisie d'un code.
 * Sert de simulateur, de banc de test et de source des vecteurs de test du firmware.
 */
export function verifierToken(p: {
  code: string;
  cleCompteur: Buffer;
  dernierIndexAccepte: number;
}): TokenVerifie {
  garde(/^\d+$/.test(p.code) && p.code.length === TOKEN_LONGUEUR, 'TOKEN_FORMAT_INVALIDE', `Le code doit comporter ${TOKEN_LONGUEUR} chiffres`);

  const entete = BigInt(p.code.slice(0, LONGUEUR_ENTETE));
  const macRecu = Number(p.code.slice(LONGUEUR_ENTETE));
  garde(entete < 1n << 48n && macRecu <= 0xffffff, 'TOKEN_INVALIDE', 'Token invalide');

  const attendu = Buffer.alloc(3);
  attendu.writeUIntBE(calculerMac(p.cleCompteur, entete), 0, 3);
  const recu = Buffer.alloc(3);
  recu.writeUIntBE(macRecu, 0, 3);
  garde(timingSafeEqual(attendu, recu), 'TOKEN_INVALIDE', 'Token invalide');

  garde(Number(entete >> 44n) === TOKEN_VERSION, 'TOKEN_VERSION_INCONNUE', 'Version de token non prise en charge');
  const sequenceIndex = Number((entete >> 24n) & 0xfffffn);
  garde(sequenceIndex > p.dernierIndexAccepte, 'TOKEN_REJOUE', 'Token déjà utilisé ou périmé (index de séquence)');

  return { sequenceIndex, credits: Number(entete & 0xffffffn) / 100 };
}
