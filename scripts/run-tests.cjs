// Lance les tests compilés (dist/**/*.test.js) avec le lanceur natif de Node.
// Écrit à la main pour rester portable (Windows/Linux, Node 20+) sans dépendre des globs de `node --test`.
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

function lister(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? lister(chemin) : chemin.endsWith('.test.js') ? [chemin] : [];
  });
}

const fichiers = lister(join(__dirname, '..', 'dist'));
if (fichiers.length === 0) {
  console.error('Aucun test trouvé dans dist/');
  process.exit(1);
}
process.exit(spawnSync(process.execPath, ['--test', ...fichiers], { stdio: 'inherit' }).status ?? 1);
