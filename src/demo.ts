/**
 * Scénario de démonstration : exerce les règles de gestion du PDF sur les classes de domaine
 * (alignées sur le diagramme de classes). Lancer avec :  npm run demo
 */
import { randomUUID as id } from 'node:crypto';
import {
  AffectationCompteur, Alarme, Client, Commande, Compteur, ConfigurationCompteur, DomainError, Facture, JourFerie,
  Notification, PlageHoraire, ProfilTarifaire, Role, Site, Synchronisation, TarifCoefficient, Tenant, Token,
  Transaction, Utilisateur, deriverCleCompteur, verifierToken,
} from './domain';

const ok = (msg: string) => console.log(`  ✔ ${msg}`);
function refus(msg: string, fn: () => void, codeAttendu: string) {
  try {
    fn();
    throw new Error(`ATTENDU un refus (${codeAttendu}) : ${msg}`);
  } catch (e) {
    if (e instanceof DomainError && e.code === codeAttendu) return ok(`refusé comme prévu [${e.code}] ${msg}`);
    throw e;
  }
}
const titre = (t: string) => console.log(`\n${t}`);

const CLE_RACINE = Buffer.alloc(32, 42); // démo uniquement
const PEPPER = 'pepper-de-demo';

// --- Organisation : Tenant ◇ Site ◇ Client, Role — Utilisateur ---------
titre('Organisation et permissions (un rôle par utilisateur)');
const tenant = new Tenant(id(), 'Mini-centrale Andasibe', 'MINI_CENTRALE');
const site = new Site(id(), tenant.idTenant, 'Centrale Andasibe', 'Toamasina', -18.9, 48.4);
const client = new Client(id(), site.idSite, 'Rasoamanana', 'Marie', 'Lot 12 Andasibe');
const roleAgent = new Role(id(), 'Opérateur mini-centrale', ['PREPAIEMENT:VENDRE']);
const agent = new Utilisateur(id(), tenant.idTenant, roleAgent.idRole, 'Rakoto', 'Jean', 'Jean@JiroLink.mg', 'hash-bcrypt');
console.log(' ', agent.aPermission('PREPAIEMENT:VENDRE', roleAgent) ? '✔ agent autorisé à vendre' : '✘ KO');
console.log(' ', !agent.aPermission('ALARMES:CLOTURER', roleAgent) ? '✔ agent non autorisé à clôturer une alarme' : '✘ KO');
ok(`email normalisé : ${agent.email}`);

// --- Tarifs : ProfilTarifaire ◆ PlageHoraire, ◇ JourFerie ---------------
titre('Tarifs (RM2 versions, RM4 jours fériés prioritaires, plage de nuit)');
const profil = new ProfilTarifaire(id(), tenant.idTenant, 'Tarif standard');
const jour = new PlageHoraire(id(), 'Jour', '06:00', '22:00');
jour.ajouterCoefficient(new TarifCoefficient(id(), 1.0));
const nuit = new PlageHoraire(id(), 'Nuit', '22:00', '06:00'); // franchit minuit
nuit.ajouterCoefficient(new TarifCoefficient(id(), 0.7));
profil.ajouterPlage(jour);
profil.ajouterPlage(nuit);
refus('plage chevauchante', () => profil.ajouterPlage(new PlageHoraire(id(), 'Pointe', '18:00', '20:00')), 'PLAGES_CHEVAUCHANTES');
profil.ajouterJourFerie(new JourFerie(id(), '2026-06-26', '2026-06-26', 0.5, 'Fête de l’Indépendance'));
const at = (iso: string) => new Date(iso);
console.log('  coef mardi 10h30        =', profil.coefficientPour(at('2026-10-20T10:30:00')));
console.log('  coef mardi 23h15 (nuit) =', profil.coefficientPour(at('2026-10-20T23:15:00')));
console.log('  coef 26 juin 10h (férié)=', profil.coefficientPour(at('2026-06-26T10:00:00')));
profil.activer();
refus('modification d’un profil actif', () => profil.ajouterPlage(new PlageHoraire(id(), 'X', '12:00', '13:00')), 'PROFIL_VERROUILLE');
ok(`nouvelle version v${profil.nouvelleVersion(id).versionProfil} créée en brouillon`);

// --- Compteur : identifié par son adresse MAC ---------------------------
titre('Mise en service d’un compteur (PK = adresse MAC)');
const compteur = new Compteur({ adresseMac: 'a4:cf:12:34:56:78', tenantId: tenant.idTenant, numeroSerie: 'JL-0001', secretKeyHash: 'hash-secret', modele: 'JL-ESP32-V1' });
ok(`adresse MAC normalisée : ${compteur.adresseMac} (= deviceId MQTT)`);
const config = new ConfigurationCompteur(id(), compteur.adresseMac, agent.idUtilisateur, 1,
  { seuilTemperature: 80, hysteresisTemperature: 10 }, { intervalleTelemetrie: 30, gsmActive: false }, { alarmeIntrusionActive: true });
const affectation = new AffectationCompteur(id(), client.idClient, compteur.adresseMac);
refus('token sur compteur non activé', () => compteur.reserverIndexToken(), 'COMPTEUR_NON_RECHARGEABLE');
refus('activation sans configuration', () => compteur.activer(true), 'CONFIGURATION_INCOMPLETE');
refus('activation sans profil tarifaire', () => compteur.activer(true, config), 'PROFIL_TARIFAIRE_REQUIS');
compteur.appliquerProfilTarifaire(profil.idProfile);
compteur.activer(affectation.estActive(), config);
ok(`compteur ${compteur.numeroSerie} activé (statut ${compteur.statutCompteur})`);
console.log('  81 °C relais fermé  ->', config.decisionThermique(81, true));
console.log('  75 °C relais ouvert ->', config.decisionThermique(75, false), '(encore dans l’hystérésis)');
console.log('  69 °C relais ouvert ->', config.decisionThermique(69, false));
const v2 = config.nouvelleVersion({ idConfiguration: id(), utilisateurId: agent.idUtilisateur, seuilsAlarme: { seuilTemperature: 75, hysteresisTemperature: 8 } });
ok(`configuration historisée : v${config.version} conservée, v${v2.version} créée`);

// --- Prépaiement : Transaction + Facture + Token ------------------------
titre('Vente + token validé HORS LIGNE par le compteur (UC1, UC2, UC6)');
const vente = new Transaction(id(), 'VENTE', 5000, 20, 'EN_ATTENTE', 'ESPECES');
vente.confirmerPaiement();
const facture = Facture.emettre({ idFacture: id(), transaction: vente, affectation, utilisateurId: agent.idUtilisateur });
ok(`facture ${facture.idFacture.slice(0, 8)}… : rattache la transaction au compteur (via l'affectation), au client et à l'agent`);
const index = compteur.reserverIndexToken();
const { token, codeEnClair } = Token.emettre({
  idToken: id(), transactionId: vente.idTransaction, compteurMac: compteur.deviceId,
  sequenceIndex: index, credits: vente.credits, cleRacine: CLE_RACINE, pepperServeur: PEPPER,
});
ok(`token ${codeEnClair} (23 chiffres) remis au client ; seul son hash est conservé`);

// ---- Simulation du COMPTEUR : il ne connaît que sa propre clé, ni la clé racine ni la base ----
const cleDuCompteur = deriverCleCompteur(CLE_RACINE, compteur.deviceId);
let indexAccepte = 0; // en NVS dans le vrai compteur
let soldeLocal = 0; // idem
const faux = codeEnClair.slice(0, 10) + String((Number(codeEnClair[10]) + 1) % 10) + codeEnClair.slice(11);
refus('code mal saisi (1 chiffre)', () => verifierToken({ code: faux, cleCompteur: cleDuCompteur, dernierIndexAccepte: indexAccepte }), 'TOKEN_INVALIDE');
const accepte = verifierToken({ code: codeEnClair, cleCompteur: cleDuCompteur, dernierIndexAccepte: indexAccepte });
soldeLocal += accepte.credits;
indexAccepte = accepte.sequenceIndex;
ok(`le compteur accepte hors ligne : +${accepte.credits} crédits, solde local = ${soldeLocal}`);
refus('rejeu du même code', () => verifierToken({ code: codeEnClair, cleCompteur: cleDuCompteur, dernierIndexAccepte: indexAccepte }), 'TOKEN_REJOUE');

// ---- La liaison revient : synchronisation, puis ack et télémétrie ----
const sync = new Synchronisation(id(), compteur.adresseMac, 'TRANSACTIONS', 'EN_ATTENTE', new Date(), undefined, [{ index: accepte.sequenceIndex }]);
sync.demarrer();
token.marquerUtilise();
compteur.enregistrerSolde(soldeLocal, new Date());
sync.terminer();
ok(`synchronisation ${sync.status} ; la plateforme reflète le solde ${compteur.solde} (le compteur reste l'autorité)`);
refus('annulation après consommation', () => vente.annuler({ creditsConsommes: true, autorise: true }), 'RECHARGE_DEJA_CONSOMMEE');
compteur.enregistrerSolde(0, new Date(Date.now() + 1000));
ok(`télémétrie : solde 0 -> crédit épuisé = ${compteur.estCreditEpuise()} (le compteur a ouvert son relais)`);
const termine = new AffectationCompteur(id(), client.idClient, compteur.adresseMac, new Date('2026-01-01'));
termine.terminer(new Date('2026-06-01'));
refus('vente sur une affectation terminée', () => Facture.emettre({ idFacture: id(), transaction: vente, affectation: termine, utilisateurId: agent.idUtilisateur }), 'AFFECTATION_TERMINEE');

// --- Supervision : Alarme ◆ Notification, Commande ----------------------
titre('Alarmes et notifications (RM4 : clôture seulement après acquittement)');
const alarme = new Alarme(id(), compteur.adresseMac, 'SURCHAUFFE', 'Température 82 °C : relais ouvert');
const notif = new Notification(id(), alarme.idAlarme, 'SMS', '+261340000000', alarme.message);
notif.marquerEnvoyee();
notif.marquerLue();
refus('clôture sans acquittement', () => alarme.cloturer(), 'ALARME_NON_ACQUITTEE');
alarme.acquitter(agent.idUtilisateur);
alarme.cloturer();
ok(`alarme ${alarme.statut} ; notification ${notif.statut}`);

titre('Télécommande (RM6 : expiration automatique)');
const t0 = new Date('2026-10-21T08:00:00');
const cmd = Commande.creer({ idCommande: id(), compteurMac: compteur.adresseMac, utilisateurId: agent.idUtilisateur, type: 'COUPER_RELAIS', validiteMinutes: 15, maintenant: t0 });
cmd.marquerEnvoyee(t0);
cmd.confirmerExecution(true, new Date('2026-10-21T08:01:40'), new Date('2026-10-21T08:02:00'));
ok(`commande ${cmd.type} -> ${cmd.statut}`);
const cmd2 = Commande.creer({ idCommande: id(), compteurMac: compteur.adresseMac, utilisateurId: agent.idUtilisateur, type: 'REDEMARRER', maintenant: t0 });
refus('envoi d’une commande périmée', () => cmd2.marquerEnvoyee(new Date('2026-10-21T09:00:00')), 'COMMANDE_NON_ENVOYABLE');

console.log('\nToutes les règles de gestion démontrées sont respectées.\n');
