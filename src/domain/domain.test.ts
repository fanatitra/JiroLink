import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AffectationCompteur, Alarme, Commande, Compteur, ConfigurationCompteur, DomainError, Facture, JourFerie,
  Notification, PlageHoraire, ProfilTarifaire, Role, Synchronisation, TarifCoefficient, Telemetrie, Token,
  Transaction, Utilisateur, deriverCleCompteur, normaliserMac, verifierToken,
} from './index';

const refuse = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
let n = 0;
const id = () => `id-${++n}`;
const MAC = 'A4CF12345678';

const configType = (v = 1) =>
  new ConfigurationCompteur('cfg', MAC, 'u1', v, { seuilTemperature: 80, hysteresisTemperature: 10 }, { intervalleTelemetrie: 30, gsmActive: false }, { alarmeIntrusionActive: true });
const compteurBrut = () => new Compteur({ adresseMac: MAC, tenantId: 't1', numeroSerie: 'JL-1', secretKeyHash: 'h' });
function compteurActif(): Compteur {
  const c = compteurBrut();
  c.appliquerProfilTarifaire('p1');
  c.activer(true, configType());
  return c;
}

test('adresse MAC : normalisée en 12 hexadécimaux majuscules, les formes invalides sont refusées', () => {
  assert.equal(normaliserMac('a4:cf:12:34:56:78'), MAC);
  assert.equal(normaliserMac('A4-CF-12-34-56-78'), MAC);
  assert.equal(normaliserMac('a4cf.1234.5678'), MAC);
  assert.equal(normaliserMac(' a4cf12345678 '), MAC);
  for (const mauvais of ['', 'A4CF1234567', 'A4CF123456789', 'G4CF12345678', 'a4/cf/12/34/56/78', 'A4CF+2345678']) {
    assert.throws(() => normaliserMac(mauvais), refuse('MAC_INVALIDE'), mauvais);
  }
  assert.equal(new Compteur({ adresseMac: 'a4:cf:12:34:56:78', tenantId: 't', numeroSerie: 'S', secretKeyHash: 'h' }).deviceId, MAC);
});

test('compteur : mise en service soumise à l’affectation, à une configuration et à un profil tarifaire', () => {
  const c = compteurBrut();
  assert.throws(() => c.activer(false, configType()), refuse('COMPTEUR_NON_AFFECTE'));
  assert.throws(() => c.activer(true), refuse('CONFIGURATION_INCOMPLETE'));
  assert.throws(() => c.activer(true, configType()), refuse('PROFIL_TARIFAIRE_REQUIS'));
  c.appliquerProfilTarifaire('p1');
  c.activer(true, configType());
  assert.equal(c.statutCompteur, 'ACTIF');
  assert.throws(() => c.activer(true, configType()), refuse('COMPTEUR_DEJA_ACTIF'));
});

test('compteur : un compteur désactivé ne transmet pas et n’est pas rechargeable', () => {
  const c = compteurActif();
  c.signalerConnexion('EN_LIGNE');
  assert.equal(c.etatConnexion, 'EN_LIGNE');
  c.desactiver();
  assert.equal(c.etatConnexion, 'HORS_LIGNE');
  assert.equal(c.estRechargeable(), false);
  assert.throws(() => c.signalerConnexion('EN_LIGNE'), refuse('COMPTEUR_DESACTIVE'));
});

test('compteur : pas d’index de token tant qu’il n’est pas actif, puis séquence croissante', () => {
  assert.throws(() => compteurBrut().reserverIndexToken(), refuse('COMPTEUR_NON_RECHARGEABLE'));
  const a = compteurActif();
  assert.deepEqual([a.reserverIndexToken(), a.reserverIndexToken(), a.reserverIndexToken()], [1, 2, 3]);
});

test('compteur : le solde plateforme est un reflet — un message ancien ne remplace pas un plus récent', () => {
  const c = compteurActif();
  assert.equal(c.estCreditEpuise(), false); // solde jamais reçu
  assert.equal(c.enregistrerSolde(20, new Date('2026-10-20T10:00:00Z')), true);
  assert.equal(c.enregistrerSolde(5, new Date('2026-10-20T12:00:00Z')), true);
  assert.equal(c.enregistrerSolde(12, new Date('2026-10-20T11:00:00Z')), false); // mesure rejouée après coupure réseau
  assert.equal(c.solde, 5);
  c.enregistrerSolde(0, new Date('2026-10-20T13:00:00Z'));
  assert.equal(c.estCreditEpuise(), true);
  assert.throws(() => c.enregistrerSolde(-1, new Date()), refuse('SOLDE_INVALIDE'));
});

test('token : ce que la plateforme émet, le compteur le valide seul, hors ligne', () => {
  const cleRacine = Buffer.alloc(32, 9);
  const { token, codeEnClair } = Token.emettre({
    idToken: id(), transactionId: 'tx1', compteurMac: MAC, sequenceIndex: 1, credits: 20, cleRacine, pepperServeur: 'pepper',
  });
  assert.equal(JSON.stringify(token).includes(codeEnClair), false, 'le code en clair ne doit pas être stocké');
  assert.deepEqual(verifierToken({ code: codeEnClair, cleCompteur: deriverCleCompteur(cleRacine, MAC), dernierIndexAccepte: 0 }), { sequenceIndex: 1, credits: 20 });
  token.marquerUtilise();
  assert.throws(() => token.marquerUtilise(), refuse('TOKEN_DEJA_UTILISE'));
});

test('token expiré côté plateforme mais accepté par le compteur : le compteur fait autorité', () => {
  const { token } = Token.emettre({ idToken: id(), transactionId: 'tx', compteurMac: MAC, sequenceIndex: 1, credits: 1, cleRacine: Buffer.alloc(32, 1), pepperServeur: 'p' });
  token.expirer();
  assert.equal(token.status, 'EXPIRE');
  token.marquerUtilise();
  assert.equal(token.status, 'UTILISE');
});

test('transaction : annulation seulement si non consommée et autorisée (RM7)', () => {
  const t = new Transaction(id(), 'VENTE', 5000, 20);
  t.confirmerPaiement();
  assert.throws(() => t.annuler({ creditsConsommes: false, autorise: false }), refuse('ANNULATION_NON_AUTORISEE'));
  assert.throws(() => t.annuler({ creditsConsommes: true, autorise: true }), refuse('RECHARGE_DEJA_CONSOMMEE'));
  t.annuler({ creditsConsommes: false, autorise: true });
  assert.equal(t.statusTransaction, 'ANNULEE');
  assert.throws(() => new Transaction(id(), 'VENTE', 0, 1), refuse('MONTANT_INVALIDE'));
  const refusee = new Transaction(id(), 'VENTE', 1000, 4);
  refusee.refuserPaiement();
  assert.equal(refusee.statusTransaction, 'ECHOUEE');
});

test('facture : rattache la transaction à une affectation ACTIVE ; refusée sinon', () => {
  const t = new Transaction(id(), 'VENTE', 5000, 20);
  t.confirmerPaiement();
  const active = new AffectationCompteur('a1', 'cl1', MAC, new Date('2026-01-01'));
  const f = Facture.emettre({ idFacture: 'f1', transaction: t, affectation: active, utilisateurId: 'u1' });
  assert.deepEqual([f.transactionId, f.affectationId, f.utilisateurId], [t.idTransaction, 'a1', 'u1']);

  const terminee = new AffectationCompteur('a2', 'cl1', MAC, new Date('2026-01-01'));
  terminee.terminer(new Date('2026-06-01'));
  assert.throws(() => Facture.emettre({ idFacture: 'f2', transaction: t, affectation: terminee, utilisateurId: 'u1' }), refuse('AFFECTATION_TERMINEE'));
  assert.throws(() => terminee.terminer(), refuse('AFFECTATION_DEJA_TERMINEE'));

  const echouee = new Transaction(id(), 'VENTE', 1000, 4);
  echouee.refuserPaiement();
  assert.throws(() => Facture.emettre({ idFacture: 'f3', transaction: echouee, affectation: active, utilisateurId: 'u1' }), refuse('TRANSACTION_ECHOUEE'));
});

function profilStandard(): ProfilTarifaire {
  const p = new ProfilTarifaire('p1', 't1', 'Standard');
  const jour = new PlageHoraire(id(), 'Jour', '06:00', '22:00');
  jour.ajouterCoefficient(new TarifCoefficient(id(), 1));
  const nuit = new PlageHoraire(id(), 'Nuit', '22:00', '06:00');
  nuit.ajouterCoefficient(new TarifCoefficient(id(), 0.7));
  p.ajouterPlage(jour);
  p.ajouterPlage(nuit);
  p.ajouterJourFerie(new JourFerie(id(), '2026-06-26', '2026-06-26', 0.5));
  return p;
}

test('tarifs : plage de nuit franchissant minuit, jour férié prioritaire', () => {
  const p = profilStandard();
  assert.equal(p.coefficientPour(new Date('2026-10-20T10:30:00')), 1);
  assert.equal(p.coefficientPour(new Date('2026-10-20T23:15:00')), 0.7);
  assert.equal(p.coefficientPour(new Date('2026-10-20T03:00:00')), 0.7);
  assert.equal(p.coefficientPour(new Date('2026-06-26T10:00:00')), 0.5);
});

test('tarifs : plage à priorité la plus haute retenue, coefficient nul ou négatif refusé', () => {
  const plage = new PlageHoraire(id(), 'Pointe', '18:00', '20:00');
  plage.ajouterCoefficient(new TarifCoefficient(id(), 1.2, 1));
  plage.ajouterCoefficient(new TarifCoefficient(id(), 2, 5));
  assert.equal(plage.coefficientEffectif(), 2);
  assert.throws(() => new TarifCoefficient(id(), 0), refuse('COEFFICIENT_INVALIDE'));
  assert.throws(() => new PlageHoraire(id(), 'Vide', '10:00', '10:00'), refuse('PLAGE_VIDE'));
});

test('tarifs : chevauchement refusé, profil actif verrouillé, nouvelle version en brouillon', () => {
  const p = profilStandard();
  assert.throws(() => p.ajouterPlage(new PlageHoraire(id(), 'Pointe', '18:00', '20:00')), refuse('PLAGES_CHEVAUCHANTES'));
  assert.throws(() => p.ajouterJourFerie(new JourFerie(id(), '2026-06-25', '2026-06-27', 0.4)), refuse('JOUR_FERIE_EN_CONFLIT'));
  p.activer();
  assert.throws(() => p.ajouterPlage(new PlageHoraire(id(), 'X', '12:00', '13:00')), refuse('PROFIL_VERROUILLE'));
  const v2 = p.nouvelleVersion(id);
  assert.equal(v2.versionProfil, 2);
  assert.equal(v2.statusTarifProfil, 'BROUILLON');
  assert.equal(v2.plages.length, 2);
  assert.equal(v2.joursFeries.length, 1);
});

test('tarifs : un profil sans plage ou avec une plage sans coefficient est incomplet', () => {
  const p = new ProfilTarifaire('p', 't', 'Vide');
  assert.equal(p.estComplet(), false);
  assert.throws(() => p.activer(), refuse('PROFIL_INCOMPLET'));
  p.ajouterPlage(new PlageHoraire(id(), 'Jour', '06:00', '22:00'));
  assert.equal(p.estComplet(), false);
  assert.throws(() => p.programmer(new Date(Date.now() + 1000)), refuse('PROFIL_INCOMPLET'));
});

test('tarifs : programmation uniquement dans le futur', () => {
  const p = profilStandard();
  const maintenant = new Date('2026-10-21T08:00:00Z');
  assert.throws(() => p.programmer(new Date('2026-10-20T08:00:00Z'), maintenant), refuse('DATE_PASSEE'));
  p.programmer(new Date('2026-11-01T00:00:00Z'), maintenant);
  assert.equal(p.statusTarifProfil, 'PROGRAMME');
});

test('configuration : hystérésis thermique, bornes et historisation par version', () => {
  const cfg = configType();
  assert.equal(cfg.decisionThermique(81, true), 'COUPER');
  assert.equal(cfg.decisionThermique(75, false), 'RIEN');
  assert.equal(cfg.decisionThermique(70, false), 'REARMER');
  const mk = (seuil: number, hyst: number, intervalle = 30) =>
    () => new ConfigurationCompteur('c', MAC, 'u', 1, { seuilTemperature: seuil, hysteresisTemperature: hyst }, { intervalleTelemetrie: intervalle, gsmActive: false }, { alarmeIntrusionActive: true });
  assert.throws(mk(80, 90), refuse('HYSTERESIS_INVALIDE'));
  assert.throws(mk(500, 10), refuse('SEUIL_HORS_LIMITES'));
  assert.throws(mk(80, 10, 1), refuse('INTERVALLE_HORS_LIMITES'));
  const v2 = cfg.nouvelleVersion({ idConfiguration: 'c2', utilisateurId: 'u2', seuilsAlarme: { seuilTemperature: 70, hysteresisTemperature: 5 } });
  assert.equal(cfg.version, 1);
  assert.equal(cfg.seuilsAlarme.seuilTemperature, 80, 'la version précédente est conservée');
  assert.deepEqual([v2.version, v2.seuilsAlarme.seuilTemperature, v2.parametreReseau.intervalleTelemetrie], [2, 70, 30]);
});

test('synchronisation : transitions d’état valides uniquement', () => {
  const s = new Synchronisation(id(), MAC, 'TRANSACTIONS');
  assert.throws(() => s.terminer(), refuse('SYNC_NON_EN_COURS'));
  s.demarrer();
  assert.throws(() => s.demarrer(), refuse('SYNC_DEJA_TRAITEE'));
  s.terminer();
  assert.equal(s.status, 'TERMINEE');
  const c = new Synchronisation(id(), MAC, 'CONFIGURATION');
  c.demarrer();
  c.signalerConflit();
  assert.equal(c.status, 'CONFLIT');
});

test('alarme : clôture impossible avant acquittement', () => {
  const a = new Alarme('a1', MAC, 'SURCHAUFFE', 'T° 82');
  assert.throws(() => a.cloturer(), refuse('ALARME_NON_ACQUITTEE'));
  a.acquitter('u1');
  assert.equal(a.acquitteParId, 'u1');
  assert.throws(() => a.acquitter('u2'), refuse('ALARME_DEJA_ACQUITTEE'));
  a.cloturer();
  assert.equal(a.statut, 'CLOTUREE');
});

test('notification : cycle EN_ATTENTE → ENVOYEE → LUE, lecture impossible avant envoi', () => {
  const n1 = new Notification(id(), 'a1', 'SMS', '+261340000000', 'msg');
  assert.throws(() => n1.marquerLue(), refuse('NOTIFICATION_NON_ENVOYEE'));
  n1.marquerEnvoyee();
  n1.marquerLue();
  assert.equal(n1.statut, 'LUE');
  const n2 = new Notification(id(), 'a1', 'EMAIL', 'x@y.mg', 'msg');
  n2.echouer();
  assert.equal(n2.statut, 'ECHEC');
  assert.throws(() => new Notification(id(), 'a1', 'SMS', '  ', 'msg'), refuse('DESTINATAIRE_REQUIS'));
});

test('commande : expiration automatique et confirmation d’exécution', () => {
  const t0 = new Date('2026-10-21T08:00:00Z');
  const c = Commande.creer({ idCommande: 'm1', compteurMac: MAC, utilisateurId: 'u1', type: 'COUPER_RELAIS', validiteMinutes: 15, maintenant: t0 });
  assert.equal(c.expirerSiDepassee(new Date('2026-10-21T08:10:00Z')), false);
  c.marquerEnvoyee(t0);
  c.confirmerExecution(true, new Date('2026-10-21T08:11:00Z'), new Date('2026-10-21T08:12:00Z'));
  assert.deepEqual([c.statut, c.dateExecution?.toISOString(), c.dateConfirmation?.toISOString()], ['EXECUTEE', '2026-10-21T08:11:00.000Z', '2026-10-21T08:12:00.000Z']);

  const perimee = Commande.creer({ idCommande: 'm2', compteurMac: MAC, utilisateurId: 'u1', type: 'REDEMARRER', validiteMinutes: 15, maintenant: t0 });
  assert.equal(perimee.expirerSiDepassee(new Date('2026-10-21T08:16:00Z')), true);
  assert.throws(() => perimee.marquerEnvoyee(new Date('2026-10-21T08:17:00Z')), refuse('COMMANDE_NON_ENVOYABLE'));
});

test('télémétrie : le retard mesure le délai de la file hors ligne', () => {
  const t = new Telemetrie(id(), MAC, 'FERME', new Date('2026-10-21T08:00:00Z'), new Date('2026-10-21T08:05:00Z'), 230);
  assert.equal(t.retardSecondes, 300);
  assert.equal(new Telemetrie(id(), MAC, 'OUVERT', new Date(), new Date(), undefined, undefined, 85).estEnSurchauffe(80), true);
});

test('utilisateur : permissions issues du rôle unique, compte inactif sans permission, email en minuscules', () => {
  const role = new Role('r1', 'Agent', ['PREPAIEMENT:VENDRE']);
  const autre = new Role('r2', 'Autre', ['PREPAIEMENT:VENDRE']);
  const u = new Utilisateur('u1', 't1', 'r1', 'Rakoto', 'Jean', 'Jean@Test.MG', 'hash');
  assert.equal(u.email, 'jean@test.mg');
  assert.equal(u.aPermission('PREPAIEMENT:VENDRE', role), true);
  assert.equal(u.aPermission('ALARMES:CLOTURER', role), false);
  assert.equal(u.aPermission('PREPAIEMENT:VENDRE', autre), false, 'le rôle fourni doit être celui de l’utilisateur');
  u.desactiver();
  assert.equal(u.aPermission('PREPAIEMENT:VENDRE', role), false);
  assert.throws(() => u.enregistrerConnexion(), refuse('COMPTE_INACTIF'));
  assert.throws(() => new Utilisateur('u2', 't1', 'r1', 'A', 'B', 'pas-un-email', 'h'), refuse('EMAIL_INVALIDE'));
});
