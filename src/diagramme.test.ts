/**
 * Garde-fou « le code ressemble au diagramme ».
 * Le diagramme de classes (Visual Paradigm) est transcrit ici sous forme de données ; le test vérifie que
 * le schéma Prisma ET les classes de domaine contiennent chaque classe, chaque attribut et chaque association.
 * À lancer avant toute migration : `npm test`. Si le diagramme évolue, ce fichier est à mettre à jour.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..');
const SCHEMA = readFileSync(join(RACINE, 'prisma', 'schema.prisma'), 'utf8');

// ---------------------------------------------------------------------------
// Transcription du diagramme. Pour chaque attribut : [nom dans le diagramme, nom(s) dans le code].
// Les écarts de nom sont volontaires et documentés dans docs/correspondance-diagramme.md.
// ---------------------------------------------------------------------------
type Attr = [diagramme: string, code: string];
interface ClasseDiagramme {
  classe: string;
  fichier: string; // fichier de domaine
  attributs: Attr[];
}

const CLASSES: ClasseDiagramme[] = [
  { classe: 'Tenant', fichier: 'administration', attributs: [['IdTenant', 'idTenant'], ['nom', 'nom'], ['typeTenant', 'typeTenant'], ['statusTenant', 'statusTenant'], ['adresse', 'adresse'], ['telephone', 'telephone'], ['email', 'email'], ['cin', 'cin']] },
  { classe: 'Utilisateur', fichier: 'administration', attributs: [['IdUtilisateur', 'idUtilisateur'], ['nom', 'nom'], ['prenom', 'prenom'], ['email', 'email'], ['telephone', 'telephone'], ['motDePasse', 'motDePasseHash'], ['statusUtilisateur', 'statusUtilisateur'], ['dateCreation', 'dateCreation'], ['derniereConnexion', 'derniereConnexion']] },
  { classe: 'Role', fichier: 'administration', attributs: [['IdRole', 'idRole'], ['description', 'description'], ['permission', 'permissions']] },
  { classe: 'Site', fichier: 'clients-sites', attributs: [['IdSite', 'idSite'], ['name', 'name'], ['attribute', 'province']] },
  { classe: 'Client', fichier: 'clients-sites', attributs: [['IdClient', 'idClient'], ['nom', 'nom'], ['prenom', 'prenom'], ['adresse', 'adresse']] },
  { classe: 'Logement', fichier: 'clients-sites', attributs: [['IdLogement', 'idLogement'], ['reference', 'reference'], ['type', 'type'], ['statut', 'statut']] },
  { classe: 'AffectationCompteur', fichier: 'prepaiement', attributs: [['dateDebut', 'dateDebut'], ['dateFin', 'dateFin']] },
  { classe: 'Transaction', fichier: 'prepaiement', attributs: [['IdTransaction', 'idTransaction'], ['type', 'type'], ['montant', 'montant'], ['statusTransaction', 'statusTransaction'], ['dateTransaction', 'dateTransaction'], ['modeDePaiement', 'modeDePaiement'], ['statusPaiement', 'statusPaiement']] },
  { classe: 'Facture', fichier: 'prepaiement', attributs: [['IdFacture', 'idFacture'], ['dateFacture', 'dateFacture']] },
  { classe: 'Token', fichier: 'prepaiement', attributs: [['IdToken', 'idToken'], ['code', 'codeHash'], ['status', 'status'], ['datecreation', 'dateCreation']] },
  { classe: 'Compteur', fichier: 'compteurs', attributs: [['adresse_mac', 'adresseMac'], ['numeroSerie', 'numeroSerie'], ['statutCompteur', 'statutCompteur'], ['modele', 'modele'], ['versionFirmware', 'versionFirmware'], ['etatConnexion', 'etatConnexion'], ['solde', 'solde']] },
  { classe: 'ConfigurationCompteur', fichier: 'compteurs', attributs: [['idConfiguration', 'idConfiguration'], ['seuilsAlarme', 'seuilsAlarme'], ['parametreReseau', 'parametreReseau'], ['optionFonctionnement', 'optionFonctionnement'], ['version', 'version'], ['dateCreation', 'dateCreation'], ['dateModification', 'dateModification']] },
  { classe: 'Synchronisation', fichier: 'compteurs', attributs: [['IdSynchronisation', 'idSynchronisation'], ['typeSynchronisation', 'typeSynchronisation'], ['status', 'status'], ['dateDebut', 'dateDebut'], ['datebut (= dateFin)', 'dateFin']] },
  { classe: 'ProfilTarifaire', fichier: 'tarifs', attributs: [['IdProfile', 'idProfile'], ['nom', 'nom'], ['description', 'description'], ['statusTarifProil', 'statusTarifProfil'], ['dateActivation', 'dateActivation'], ['versionProfil', 'versionProfil']] },
  { classe: 'PlageHoraire', fichier: 'tarifs', attributs: [['IdPlageHoraire', 'idPlageHoraire'], ['libellé', 'libelle'], ['dateDepart', 'dateDepart'], ['dateFin', 'dateFin']] },
  { classe: 'TarifCoefficient', fichier: 'tarifs', attributs: [['IdTarifCoef', 'idTarifCoef'], ['valeur', 'valeur'], ['priorité', 'priorite']] },
  { classe: 'JourFerie', fichier: 'tarifs', attributs: [['IdJourFerie', 'idJourFerie'], ['dateDebut', 'dateDebut'], ['dateFin', 'dateFin'], ['libelle', 'libelle'], ['specialCoefficient', 'specialCoefficient']] },
  { classe: 'ModificationTarif', fichier: 'tarifs', attributs: [['datemodification', 'dateModification']] },
  { classe: 'Telemetrie', fichier: 'supervision', attributs: [['IdTelemetrie', 'idTelemetrie'], ['tension', 'tension'], ['courant', 'courant'], ['temperature', 'temperature'], ['etatRelais', 'etatRelais'], ['timestamp', 'timestamp']] },
  { classe: 'Alarme', fichier: 'supervision', attributs: [['IdAlarme', 'idAlarme'], ['type', 'type'], ['dateCreation', 'dateCreation'], ['statut', 'statut'], ['message', 'message'], ['dateAcquittement', 'dateAcquittement']] },
  { classe: 'Notification', fichier: 'supervision', attributs: [['IdNotification', 'idNotification'], ['canal', 'canal'], ['destinataire', 'destinataire'], ['message', 'message'], ['statut', 'statut'], ['dateEnvoi', 'dateEnvoi'], ['daateLecture', 'dateLecture']] },
  { classe: 'Commande', fichier: 'supervision', attributs: [['IdCommande', 'idCommande'], ['type', 'type'], ['statut', 'statut'], ['dateCreation', 'dateCreation'], ['dateExecution', 'dateExecution'], ['dateConfirmation', 'dateConfirmation']] },
];

/** Associations : le champ clé étrangère `champ` du modèle `de` pointe vers le modèle `vers`. */
interface Association {
  libelle: string;
  de: string;
  champ: string;
  vers: string;
  cascade?: boolean; // composition du diagramme (losange plein)
  unique?: boolean; // multiplicité 0..1 / 1 côté « de »
}
const ASSOCIATIONS: Association[] = [
  { libelle: 'Tenant ◇ Site', de: 'Site', champ: 'tenantId', vers: 'Tenant' },
  { libelle: 'Site ◇ Client', de: 'Client', champ: 'siteId', vers: 'Site' },
  { libelle: 'Appartenir', de: 'Utilisateur', champ: 'tenantId', vers: 'Tenant' },
  { libelle: 'Role — Utilisateur', de: 'Utilisateur', champ: 'roleId', vers: 'Role' },
  { libelle: 'Avoir', de: 'Logement', champ: 'clientId', vers: 'Client' },
  { libelle: 'Associer (Client)', de: 'AffectationCompteur', champ: 'clientId', vers: 'Client' },
  { libelle: 'Associer (Compteur)', de: 'AffectationCompteur', champ: 'compteurMac', vers: 'Compteur' },
  { libelle: 'Ternaire Facture → Transaction', de: 'Facture', champ: 'transactionId', vers: 'Transaction', unique: true },
  { libelle: 'Ternaire Facture → AffectationCompteur', de: 'Facture', champ: 'affectationId', vers: 'AffectationCompteur' },
  { libelle: 'Ternaire Facture → Utilisateur', de: 'Facture', champ: 'utilisateurId', vers: 'Utilisateur' },
  { libelle: 'Generer (Token 0..1 — 1 Transaction)', de: 'Token', champ: 'transactionId', vers: 'Transaction', unique: true },
  { libelle: 'Synchroniser ◆', de: 'Synchronisation', champ: 'compteurMac', vers: 'Compteur', cascade: true },
  { libelle: 'Compteur ◆ Telemetrie', de: 'Telemetrie', champ: 'compteurMac', vers: 'Compteur', cascade: true },
  { libelle: 'Compteur ◆ Alarme', de: 'Alarme', champ: 'compteurMac', vers: 'Compteur', cascade: true },
  { libelle: 'Alarme ◆ Notification', de: 'Notification', champ: 'idAlarme', vers: 'Alarme', cascade: true },
  { libelle: 'peut configurer (Utilisateur)', de: 'ConfigurationCompteur', champ: 'utilisateurId', vers: 'Utilisateur' },
  { libelle: 'peut configurer (Compteur)', de: 'ConfigurationCompteur', champ: 'compteurMac', vers: 'Compteur' },
  { libelle: 'commander (Utilisateur)', de: 'Commande', champ: 'utilisateurId', vers: 'Utilisateur' },
  { libelle: 'commander (Compteur)', de: 'Commande', champ: 'compteurMac', vers: 'Compteur' },
  { libelle: 'modifier (Utilisateur)', de: 'ModificationTarif', champ: 'utilisateurId', vers: 'Utilisateur' },
  { libelle: 'modifier (ProfilTarifaire)', de: 'ModificationTarif', champ: 'idProfile', vers: 'ProfilTarifaire' },
  { libelle: "s'appliquer", de: 'Compteur', champ: 'profilTarifaireId', vers: 'ProfilTarifaire' },
  { libelle: 'Contenir ◆', de: 'PlageHoraire', champ: 'idProfile', vers: 'ProfilTarifaire', cascade: true },
  { libelle: 'posseder ◇', de: 'JourFerie', champ: 'idProfile', vers: 'ProfilTarifaire' },
  { libelle: 'Peut avoir', de: 'TarifCoefficient', champ: 'idPlageHoraire', vers: 'PlageHoraire' },
];

// ---------------------------------------------------------------------------
// Lecture du schéma et du domaine
// ---------------------------------------------------------------------------
function modelesPrisma(): Map<string, string[]> {
  const modeles = new Map<string, string[]>();
  for (const m of SCHEMA.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    modeles.set(m[1]!, m[2]!.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')));
  }
  return modeles;
}

function blocClasse(fichier: string, classe: string): string | undefined {
  const source = readFileSync(join(RACINE, 'src', 'domain', `${fichier}.ts`), 'utf8');
  const debut = source.search(new RegExp(`export class ${classe}\\b`));
  if (debut < 0) return undefined;
  const suite = source.slice(debut + 1).search(/\nexport (class|function|const|interface|type) /);
  return suite < 0 ? source.slice(debut) : source.slice(debut, debut + 1 + suite);
}

const champsDe = (lignes: string[]) => new Set(lignes.filter((l) => !l.startsWith('@@')).map((l) => l.split(/\s+/)[0]!));

// ---------------------------------------------------------------------------
test('diagramme : les 22 classes existent dans le schéma Prisma, avec tous leurs attributs', () => {
  const modeles = modelesPrisma();
  const manques: string[] = [];
  for (const c of CLASSES) {
    const lignes = modeles.get(c.classe);
    if (!lignes) {
      manques.push(`modèle Prisma ${c.classe} absent`);
      continue;
    }
    const champs = champsDe(lignes);
    for (const [diag, code] of c.attributs) if (!champs.has(code)) manques.push(`${c.classe}.${diag} → champ Prisma « ${code} » absent`);
  }
  assert.equal(CLASSES.length, 22);
  assert.deepEqual(manques, []);
});

test('diagramme : les 22 classes existent dans le domaine, avec tous leurs attributs', () => {
  const manques: string[] = [];
  for (const c of CLASSES) {
    const bloc = blocClasse(c.fichier, c.classe);
    if (!bloc) {
      manques.push(`classe de domaine ${c.classe} absente de ${c.fichier}.ts`);
      continue;
    }
    for (const [diag, code] of c.attributs) if (!new RegExp(`\\b${code}\\b`).test(bloc)) manques.push(`${c.classe}.${diag} → propriété « ${code} » absente du domaine`);
  }
  assert.deepEqual(manques, []);
});

test('diagramme : toutes les associations sont réalisées (clé étrangère, cible, composition, unicité)', () => {
  const modeles = modelesPrisma();
  const manques: string[] = [];
  for (const a of ASSOCIATIONS) {
    const lignes = modeles.get(a.de);
    if (!lignes) { manques.push(`${a.libelle} : modèle ${a.de} absent`); continue; }
    const relation = lignes.find((l) => new RegExp(`^\\w+\\s+${a.vers}\\??\\s+@relation\\("[^"]+",\\s*fields:\\s*\\[${a.champ}\\]`).test(l));
    if (!relation) { manques.push(`${a.libelle} : aucune relation ${a.de}.${a.champ} → ${a.vers}`); continue; }
    if (a.cascade && !relation.includes('onDelete: Cascade')) manques.push(`${a.libelle} : composition sans suppression en cascade`);
    if (a.unique) {
      const cle = lignes.find((l) => l.split(/\s+/)[0] === a.champ);
      if (!cle?.includes('@unique')) manques.push(`${a.libelle} : ${a.de}.${a.champ} devrait être unique`);
    }
  }
  assert.deepEqual(manques, []);
});

test('diagramme : toute classe du schéma est soit au diagramme, soit une table technique déclarée', () => {
  const connues = new Set([...CLASSES.map((c) => c.classe), 'JournalAudit']);
  const inconnues = [...modelesPrisma().keys()].filter((m) => !connues.has(m));
  assert.deepEqual(inconnues, [], 'modèle Prisma absent du diagramme : à déclarer ou à retirer');
});
