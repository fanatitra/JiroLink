import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { genererVecteurs } from '../src/domain/token-vecteurs';

const chemin = join(__dirname, '..', 'docs', 'token-test-vectors.json');
writeFileSync(chemin, JSON.stringify(genererVecteurs(), null, 2) + '\n');
console.log(`Écrit : ${chemin}`);
