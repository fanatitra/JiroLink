/**
 * Tests de bout en bout de l'API (HTTP réel sur un port éphémère) avec un FAUX Prisma en mémoire.
 * Ils vérifient la logique de l'application (authentification, permissions, isolation par tenant,
 * validation, audit) ; ils ne vérifient PAS le SQL : cela demande une vraie base (voir README).
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './app.module';
import { Env, ENV } from './config/env';
import { deriverCleCompteur } from './domain';
import { PrismaService } from './prisma/prisma.service';
import { creerValidationPipe } from './validation';

const MDP = 'motdepasse-de-test-1';
const T1 = randomUUID(), T2 = randomUUID(), TP = randomUUID();
const MAC = 'A4CF12345678';

interface UtilisateurFaux {
  idUtilisateur: string; tenantId: string; email: string; statusUtilisateur: string; statusTenant: string; permissions: string[];
}

class FauxPrisma {
  private readonly hash = bcrypt.hashSync(MDP, 4);
  utilisateurs: UtilisateurFaux[] = [];
  compteurs: Array<Record<string, any>> = [];
  journal: Array<Record<string, any>> = [];

  utilisateur = {
    findUnique: async ({ where }: { where: { email: string } }) => {
      const u = this.utilisateurs.find((x) => x.email === where.email);
      if (!u) return null;
      return {
        idUtilisateur: u.idUtilisateur, tenantId: u.tenantId, motDePasseHash: this.hash, statusUtilisateur: u.statusUtilisateur,
        tenant: { statusTenant: u.statusTenant },
        role: { permissions: u.permissions },
      };
    },
    update: async () => ({}),
  };

  compteur = {
    create: async ({ data }: { data: Record<string, any> }) => {
      if (this.compteurs.some((c) => c.adresseMac === data.adresseMac || c.numeroSerie === data.numeroSerie)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
      }
      const c = { modele: null, versionFirmware: null, statutCompteur: 'ENREGISTRE', etatConnexion: 'HORS_LIGNE', solde: 0,
        soldeMisAJourLe: null, profilTarifaireId: null, ...data };
      this.compteurs.push(c);
      return c;
    },
    findMany: async ({ where, take, skip }: { where: { tenantId?: string }; take: number; skip: number }) =>
      this.compteurs.filter((c) => !where.tenantId || c.tenantId === where.tenantId).slice(skip, skip + take),
    findFirst: async ({ where }: { where: { adresseMac: string; tenantId?: string } }) =>
      this.compteurs.find((c) => c.adresseMac === where.adresseMac && (!where.tenantId || c.tenantId === where.tenantId)) ?? null,
  };

  journalAudit = {
    create: async ({ data }: { data: Record<string, any> }) => { this.journal.push(data); return data; },
  };

  // Le vrai $transaction est atomique ; ce faux exécute simplement les opérations déjà lancées.
  $transaction = async (ops: Array<Promise<unknown>>) => Promise.all(ops);
}

const env: Env = {
  port: 0, databaseUrl: 'postgresql://test', jwtSecret: 'j'.repeat(40), jwtExpiresIn: '15m',
  tokenRootKey: Buffer.alloc(32, 5), tokenPepper: 'p'.repeat(20),
};

let app: INestApplication;
let base: string;
const faux = new FauxPrisma();

const user = (nom: string, tenantId: string, permissions: string[], extra: Partial<UtilisateurFaux> = {}): UtilisateurFaux => ({
  idUtilisateur: randomUUID(), tenantId, email: `${nom}@test.mg`, statusUtilisateur: 'ACTIF', statusTenant: 'ACTIF', permissions, ...extra,
});

before(async () => {
  faux.utilisateurs = [
    user('admin1', T1, ['COMPTEURS:LIRE', 'COMPTEURS:ENREGISTRER']),
    user('admin2', T2, ['COMPTEURS:LIRE', 'COMPTEURS:ENREGISTRER']),
    user('operateur1', T1, ['COMPTEURS:LIRE', 'PREPAIEMENT:VENDRE']),
    user('tech', TP, ['COMPTEURS:LIRE', 'PLATEFORME:VUE_NATIONALE']),
    user('inactif', T1, ['COMPTEURS:LIRE'], { statusUtilisateur: 'DESACTIVE' }),
    user('suspendu', T1, ['COMPTEURS:LIRE'], { statusTenant: 'SUSPENDU' }),
  ];
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV).useValue(env)
    .overrideProvider(PrismaService).useValue(faux)
    .compile();
  app = module.createNestApplication();
  app.useGlobalPipes(creerValidationPipe());
  await app.listen(0);
  base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
});

after(async () => { await app.close(); });

async function appeler(methode: string, chemin: string, opts: { token?: string; corps?: unknown } = {}) {
  const r = await fetch(base + chemin, {
    method: methode,
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.corps === undefined ? undefined : JSON.stringify(opts.corps),
  });
  const texte = await r.text();
  return { status: r.status, json: texte ? JSON.parse(texte) : null };
}

async function connecter(nom: string): Promise<string> {
  const r = await appeler('POST', '/auth/login', { corps: { email: `${nom}@test.mg`, password: MDP } });
  assert.equal(r.status, 200, `login ${nom}`);
  return r.json.accessToken;
}

test('santé : accessible sans authentification', async () => {
  assert.deepEqual((await appeler('GET', '/health')).json, { status: 'ok' });
});

test('toute autre route exige un JWT', async () => {
  assert.equal((await appeler('GET', '/compteurs')).status, 401);
  assert.equal((await appeler('GET', '/compteurs', { token: 'pas-un-jwt' })).status, 401);
});

test('login : échecs indiscernables (email inconnu, mauvais mot de passe, compte désactivé, tenant suspendu)', async () => {
  const essais = [
    { email: 'inconnu@test.mg', password: MDP },
    { email: 'admin1@test.mg', password: 'mauvais' },
    { email: 'inactif@test.mg', password: MDP },
    { email: 'suspendu@test.mg', password: MDP },
  ];
  const reponses = await Promise.all(essais.map((corps) => appeler('POST', '/auth/login', { corps })));
  for (const r of reponses) assert.equal(r.status, 401);
  assert.equal(new Set(reponses.map((r) => JSON.stringify(r.json))).size, 1, 'le message ne doit pas révéler la cause');
  assert.equal((await appeler('POST', '/auth/login', { corps: { email: 'pas-un-email', password: 'x' } })).status, 400);
});

test('login : le JWT porte le tenant et les permissions du rôle', async () => {
  const jwt = await connecter('admin1');
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString());
  assert.equal(payload.tenantId, T1);
  assert.deepEqual(payload.permissions.sort(), ['COMPTEURS:ENREGISTRER', 'COMPTEURS:LIRE']);
});

test('enregistrement : MAC normalisée, secrets renvoyés une fois, audit tracé', async () => {
  const token = await connecter('admin1');
  const r = await appeler('POST', '/compteurs', { token, corps: { adresseMac: 'a4:cf:12:34:56:78', numeroSerie: 'JL-0001', modele: 'JL-ESP32-V1' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.compteur.adresseMac, MAC, 'la MAC est normalisée');
  assert.equal(r.json.compteur.tenantId, T1);
  assert.equal(r.json.compteur.statutCompteur, 'ENREGISTRE');
  assert.equal(r.json.compteur.etatConnexion, 'HORS_LIGNE');
  assert.equal(r.json.compteur.solde, 0);
  assert.equal(r.json.compteur.secretKeyHash, undefined, 'le hash ne doit jamais sortir');
  assert.match(r.json.provisioning.mqttSecret, /^[0-9a-f]{64}$/);
  assert.equal(r.json.provisioning.deviceId, MAC);
  assert.equal(r.json.provisioning.tokenKeyHex, deriverCleCompteur(env.tokenRootKey, MAC).toString('hex'));
  assert.ok(faux.journal.some((j) => j.typeEvenement === 'COMPTEUR_ENREGISTRE' && j.tenantId === T1 && j.compteurMac === MAC));
  const stocke = faux.compteurs.find((c) => c.adresseMac === MAC)!;
  assert.notEqual(stocke.secretKeyHash, r.json.provisioning.mqttSecret, 'le secret MQTT doit être stocké haché');
  assert.ok(await bcrypt.compare(r.json.provisioning.mqttSecret, stocke.secretKeyHash));
});

test('enregistrement : doublon d’adresse MAC (quel que soit son format) ou de numéro de série → 409', async () => {
  const token = await connecter('admin2');
  assert.equal((await appeler('POST', '/compteurs', { token, corps: { adresseMac: 'A4-CF-12-34-56-78', numeroSerie: 'JL-0099' } })).status, 409);
  assert.equal((await appeler('POST', '/compteurs', { token, corps: { adresseMac: 'a4cf.1234.5678', numeroSerie: 'JL-0098' } })).status, 409);
  assert.equal((await appeler('POST', '/compteurs', { token, corps: { adresseMac: 'B4CF12345678', numeroSerie: 'JL-0001' } })).status, 409);
});

test('enregistrement : validation stricte (MAC, numéro de série, champs inconnus)', async () => {
  const token = await connecter('admin1');
  for (const adresseMac of ['', 'A4CF1234567', 'G4CF12345678', 'a4/cf/12/34/56/78', '+', 'A4CF12345678/#']) {
    assert.equal((await appeler('POST', '/compteurs', { token, corps: { adresseMac, numeroSerie: 'JL-0100' } })).status, 400, adresseMac);
  }
  for (const numeroSerie of ['ab', 'avec espace', '../x']) {
    assert.equal((await appeler('POST', '/compteurs', { token, corps: { adresseMac: 'B1CF12345678', numeroSerie } })).status, 400, numeroSerie);
  }
  // tentative de forcer le tenant : le champ inconnu est refusé, pas ignoré
  assert.equal((await appeler('POST', '/compteurs', { token, corps: { adresseMac: 'B2CF12345678', numeroSerie: 'JL-0101', tenantId: T2 } })).status, 400);
  assert.equal((await appeler('POST', '/compteurs', { token, corps: { adresseMac: 'B3CF12345678', numeroSerie: 'JL-0102', solde: 1000000 } })).status, 400, 'le solde ne se fixe pas à la création');
});

test('permissions : un opérateur sans COMPTEURS:ENREGISTRER reçoit 403', async () => {
  const token = await connecter('operateur1');
  assert.equal((await appeler('POST', '/compteurs', { token, corps: { adresseMac: 'C4CF12345678', numeroSerie: 'JL-0200' } })).status, 403);
  assert.equal((await appeler('GET', '/compteurs', { token })).status, 200);
});

test('isolation : un autre tenant ne voit ni ne lit les compteurs du tenant 1', async () => {
  const tokenT2 = await connecter('admin2');
  assert.deepEqual((await appeler('GET', '/compteurs', { token: tokenT2 })).json, []);
  assert.equal((await appeler('GET', `/compteurs/${MAC}`, { token: tokenT2 })).status, 404, 'indiscernable d’un compteur inexistant');
  const tokenT1 = await connecter('operateur1');
  assert.equal((await appeler('GET', `/compteurs/${MAC}`, { token: tokenT1 })).status, 200);
  assert.equal((await appeler('GET', '/compteurs/a4:cf:12:34:56:78', { token: tokenT1 })).status, 200, 'MAC acceptée avec séparateurs');
  assert.equal((await appeler('GET', '/compteurs/a4cf.1234.5678', { token: tokenT1 })).status, 200, 'même normalisation que l’enregistrement');
  assert.equal((await appeler('GET', '/compteurs/pas-une-mac', { token: tokenT1 })).status, 400);
});

test('vue nationale : le technicien voit tous les tenants et l’accès est tracé', async () => {
  const token = await connecter('tech');
  assert.equal((await appeler('GET', '/compteurs', { token })).json.length, 1);
  const avant = faux.journal.filter((j) => j.typeEvenement === 'LECTURE_INTER_TENANT').length;
  assert.equal((await appeler('GET', `/compteurs/${MAC}`, { token })).status, 200);
  const apres = faux.journal.filter((j) => j.typeEvenement === 'LECTURE_INTER_TENANT');
  assert.equal(apres.length, avant + 1);
  assert.equal(apres.at(-1)!.tenantId, T1);
  assert.equal(apres.at(-1)!.compteurMac, MAC);
});

test('pagination : limit/offset bornés', async () => {
  const token = await connecter('tech');
  assert.equal((await appeler('GET', '/compteurs?limit=0', { token })).status, 400);
  assert.equal((await appeler('GET', '/compteurs?limit=500', { token })).status, 400);
  assert.equal((await appeler('GET', '/compteurs?limit=10&offset=0', { token })).status, 200);
});
