import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DomainError } from './shared';
import { genererVecteurs } from './token-vecteurs';
import {
  CREDITS_CENTIEMES_MAX, INDEX_MAX, TOKEN_LONGUEUR,
  deriverCleCompteur, emettreToken, verifierToken,
} from './token-codec';

const RACINE = Buffer.alloc(32, 7);
const cle = (deviceId: string) => deriverCleCompteur(RACINE, deviceId);
const refuse = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;

test('aller-retour : le compteur retrouve index et crédits', () => {
  const code = emettreToken({ cleCompteur: cle('ESP32-0001'), sequenceIndex: 3, credits: 12.34 });
  assert.equal(code.length, TOKEN_LONGUEUR);
  assert.match(code, /^\d+$/);
  const r = verifierToken({ code, cleCompteur: cle('ESP32-0001'), dernierIndexAccepte: 2 });
  assert.deepEqual(r, { sequenceIndex: 3, credits: 12.34 });
});

test("un token n'est valable que pour le compteur visé", () => {
  const code = emettreToken({ cleCompteur: cle('A'), sequenceIndex: 1, credits: 10 });
  assert.throws(() => verifierToken({ code, cleCompteur: cle('B'), dernierIndexAccepte: 0 }), refuse('TOKEN_INVALIDE'));
});

test('toute modification d’un chiffre invalide le token', () => {
  const code = emettreToken({ cleCompteur: cle('A'), sequenceIndex: 1, credits: 10 });
  for (let i = 0; i < code.length; i++) {
    const faux = code.slice(0, i) + String((Number(code[i]) + 1) % 10) + code.slice(i + 1);
    assert.throws(() => verifierToken({ code: faux, cleCompteur: cle('A'), dernierIndexAccepte: 0 }), (e) => e instanceof DomainError, `chiffre ${i}`);
  }
});

test('anti-rejeu : index déjà accepté ou antérieur refusé', () => {
  const code = emettreToken({ cleCompteur: cle('A'), sequenceIndex: 5, credits: 10 });
  verifierToken({ code, cleCompteur: cle('A'), dernierIndexAccepte: 4 });
  assert.throws(() => verifierToken({ code, cleCompteur: cle('A'), dernierIndexAccepte: 5 }), refuse('TOKEN_REJOUE'));
  assert.throws(() => verifierToken({ code, cleCompteur: cle('A'), dernierIndexAccepte: 9 }), refuse('TOKEN_REJOUE'));
});

test('format et bornes', () => {
  assert.throws(() => verifierToken({ code: '123', cleCompteur: cle('A'), dernierIndexAccepte: 0 }), refuse('TOKEN_FORMAT_INVALIDE'));
  assert.throws(() => verifierToken({ code: 'x'.repeat(23), cleCompteur: cle('A'), dernierIndexAccepte: 0 }), refuse('TOKEN_FORMAT_INVALIDE'));
  assert.throws(() => emettreToken({ cleCompteur: cle('A'), sequenceIndex: 0, credits: 1 }), refuse('INDEX_HORS_LIMITES'));
  assert.throws(() => emettreToken({ cleCompteur: cle('A'), sequenceIndex: INDEX_MAX + 1, credits: 1 }), refuse('INDEX_HORS_LIMITES'));
  assert.throws(() => emettreToken({ cleCompteur: cle('A'), sequenceIndex: 1, credits: 0 }), refuse('CREDITS_HORS_LIMITES'));
  assert.throws(() => emettreToken({ cleCompteur: cle('A'), sequenceIndex: 1, credits: CREDITS_CENTIEMES_MAX / 100 + 0.01 }), refuse('CREDITS_HORS_LIMITES'));
  const max = emettreToken({ cleCompteur: cle('A'), sequenceIndex: INDEX_MAX, credits: CREDITS_CENTIEMES_MAX / 100 });
  assert.deepEqual(verifierToken({ code: max, cleCompteur: cle('A'), dernierIndexAccepte: 0 }), { sequenceIndex: INDEX_MAX, credits: CREDITS_CENTIEMES_MAX / 100 });
});

test('clé racine trop courte refusée', () => {
  assert.throws(() => deriverCleCompteur(Buffer.alloc(16), 'A'), refuse('CLE_RACINE_FAIBLE'));
});

test('les vecteurs publiés pour le firmware sont à jour', () => {
  const fichier = JSON.parse(readFileSync(join(__dirname, '..', '..', 'docs', 'token-test-vectors.json'), 'utf8'));
  assert.deepEqual(fichier, genererVecteurs(), 'Relancer : npm run vecteurs:token');
});
