/**
 * Vecteurs de test du format de token, à rejouer dans le firmware (C++/mbedTLS) pour prouver que
 * l'ESP32 et la plateforme calculent exactement le même token. Fichier généré : npm run vecteurs:token
 */
import { DomainError } from './shared';
import { deriverCleCompteur, emettreToken, verifierToken } from './token-codec';

// CLÉ DE TEST UNIQUEMENT (octets 0x00..0x1f) — ne jamais l'utiliser en production.
export const CLE_RACINE_TEST = Buffer.from(Array.from({ length: 32 }, (_, i) => i));

export function genererVecteurs() {
  const cas: Array<[string, number, number]> = [
    ['A1B2C3D4E5F6', 1, 20],
    ['A1B2C3D4E5F6', 2, 0.5],
    ['A1B2C3D4E5F7', 1, 20],
    ['A1B2C3D4E5F6', 7, 123.45],
    ['A1B2C3D4E5F6', 1_048_575, 167_772.15],
  ];

  const valides = cas.map(([deviceId, sequenceIndex, credits]) => {
    const cleCompteur = deriverCleCompteur(CLE_RACINE_TEST, deviceId);
    const token = emettreToken({ cleCompteur, sequenceIndex, credits });
    const entete = BigInt(token.slice(0, 15));
    const enteteOctets = Buffer.alloc(6);
    enteteOctets.writeUIntBE(Number(entete >> 24n), 0, 3);
    enteteOctets.writeUIntBE(Number(entete & 0xffffffn), 3, 3);
    return {
      deviceId,
      cleCompteurHex: cleCompteur.toString('hex'),
      sequenceIndex,
      credits,
      creditsCentiemes: Math.round(credits * 100),
      enteteHex: enteteOctets.toString('hex'),
      enteteDecimal: token.slice(0, 15),
      macDecimal: token.slice(15),
      token,
    };
  });

  const v1 = valides[0]!;
  const v3 = valides[2]!;
  const altere = v1.token.slice(0, 5) + String((Number(v1.token[5]) + 1) % 10) + v1.token.slice(6);
  const refus: Array<{ description: string; deviceId: string; code: string; dernierIndexAccepte: number }> = [
    { description: 'Chiffre modifié (MAC invalide)', deviceId: 'A1B2C3D4E5F6', code: altere, dernierIndexAccepte: 0 },
    { description: 'Token émis pour un autre compteur', deviceId: 'A1B2C3D4E5F6', code: v3.token, dernierIndexAccepte: 0 },
    { description: 'Rejeu : index déjà accepté', deviceId: 'A1B2C3D4E5F6', code: v1.token, dernierIndexAccepte: 1 },
    { description: 'Longueur incorrecte', deviceId: 'A1B2C3D4E5F6', code: v1.token.slice(0, 22), dernierIndexAccepte: 0 },
    { description: 'Caractère non numérique', deviceId: 'A1B2C3D4E5F6', code: 'x' + v1.token.slice(1), dernierIndexAccepte: 0 },
  ].map((r) => {
    try {
      verifierToken({ code: r.code, cleCompteur: deriverCleCompteur(CLE_RACINE_TEST, r.deviceId), dernierIndexAccepte: r.dernierIndexAccepte });
      throw new Error(`Vecteur de refus accepté à tort : ${r.description}`);
    } catch (e) {
      if (!(e instanceof DomainError)) throw e;
      return { ...r, erreurAttendue: e.code };
    }
  });

  return {
    format: 'JLT1',
    avertissement: 'Clé racine de TEST uniquement. Voir docs/token-format.md.',
    cleRacineTestHex: CLE_RACINE_TEST.toString('hex'),
    valides,
    refus,
  };
}
