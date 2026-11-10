# JiroLink — domaine, schéma de persistance et API

Stack du cahier des charges : TypeScript · NestJS · Prisma · PostgreSQL/TimescaleDB.
Le modèle suit le **diagramme de classes Visual Paradigm** (22 classes) : voir `docs/correspondance-diagramme.md` et `docs/carte-des-classes.md` (où est chaque classe). `src/diagramme.test.ts` vérifie automatiquement que chaque classe, attribut et association du diagramme existe dans le schéma et le domaine.

## Où en est le projet

| Brique | État |
|---|---|
| Classes de domaine + règles de gestion (`src/domain`) | Fait, testé |
| Format de token validable hors ligne + vecteurs de test pour le firmware | Fait, testé (`docs/token-format.md`) |
| Schéma Prisma (22 classes + journal d'audit) | Validé ; **migration non encore exécutée sur une vraie base** |
| API : authentification JWT, permissions, isolation par tenant, module Compteurs | Fait, testé avec un faux Prisma |
| Prépaiement (vente → facture → token), tarifs, alarmes, télécommande | À faire |
| Passerelle MQTT (EMQX) et contrat de messages | À faire |

## Démarrage (Windows / PowerShell, Node 20.6+ ; Node 22 LTS conseillé)

```powershell
npm install
npm run demo                 # scénario des règles métier, sans base de données
npm test                     # tests du domaine, de l'API et de la fidélité au diagramme

copy .env.example .env       # puis REMPLIR .env (voir les commentaires du fichier)
npm run db:up                # PostgreSQL + TimescaleDB (Docker Desktop requis)
npm run prisma:migrate       # crée les tables
npm run db:seed              # rôles, tenant plateforme, 1er administrateur
npm run dev                  # compile et lance l'API sur http://localhost:3000
```

Si `npm test` signale des erreurs sur `Prisma` (« has no exported member », « unknown[] »), le client Prisma n'est pas généré pour le schéma actuel : lancez `npx prisma generate` (c'est fait automatiquement par `npm install`).
Si une erreur mentionne `src/domain/sites.ts`, c'est un fichier d'une ancienne version : supprimez-le (il ne fait plus partie du projet).

Générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Essayer l'API

```powershell
$r = Invoke-RestMethod -Method Post http://localhost:3000/auth/login -ContentType 'application/json' `
     -Body (@{ email='VOTRE_EMAIL'; password='VOTRE_MOT_DE_PASSE' } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($r.accessToken)" }

# Enregistrer un compteur : renvoie ses secrets UNE seule fois
Invoke-RestMethod -Method Post http://localhost:3000/compteurs -Headers $h -ContentType 'application/json' `
     -Body (@{ adresseMac='A4:CF:12:34:56:78'; numeroSerie='JL-0001'; modele='JL-ESP32-V1' } | ConvertTo-Json)

Invoke-RestMethod http://localhost:3000/compteurs -Headers $h
Invoke-RestMethod http://localhost:3000/compteurs/A4:CF:12:34:56:78 -Headers $h
```

## Principes d'architecture (issus du cahier des charges)

- **Le compteur fait autorité sur son solde** (§08/§10). `Compteur.solde` est un reflet mis à jour par l'accusé de recharge et la télémétrie ; il n'existe volontairement pas de `crediter()` côté serveur.
- **Le token est validé par le compteur, hors ligne.** Format `JLT1` : 23 chiffres = index + crédits + signature HMAC calculée avec une clé propre au compteur. La clé racine ne quitte jamais le serveur. Spécification et vecteurs de test pour l'équipe firmware : `docs/token-format.md`, `docs/token-test-vectors.json`.
- **Le compteur est identifié par son adresse MAC** (clé du diagramme), qui est aussi son `deviceId` MQTT.
- **Deux clés distinctes par compteur** : secret MQTT (stocké haché) et clé des tokens (dérivée de la clé racine, jamais stockée).
- **Isolation par tenant** : `filtreTenant(user)` est injecté dans chaque requête Prisma. Seule la permission `PLATEFORME:VUE_NATIONALE` (technicien Control Room) lève l'isolation, et chaque lecture inter-tenant est tracée dans `JournalAudit`.
- **Toute route est protégée par défaut** (guards globaux) ; seules `/health` et `/auth/login` sont `@Public()`.

## Limites connues et points ouverts

- **Questions sur le diagramme** : voir la fin de `docs/correspondance-diagramme.md`.
- **À valider par le métier (Phase 0)** : matrice rôles → permissions (`src/common/permissions.ts`, provisoire), bornes du seuil thermique (`LIMITES_CONFIG`), choix final de l'algorithme de token (STS ou `JLT1`), prix d'un crédit.
- **Isolation par convention** : elle repose sur `filtreTenant` + tests. Durcissement prévu : Row-Level Security PostgreSQL.
- **JWT** : les permissions sont embarquées (validité 15 min par défaut) ; une révocation n'est effective qu'à l'expiration. Pas encore de limitation du nombre de tentatives de login (prévu avec Redis).
- **Migration SQL à compléter** après la première migration Prisma :
  - un seul client actif par compteur (RM2 pkg 8) :
    `CREATE UNIQUE INDEX uq_affectation_active ON affectation_compteur ("compteurMac") WHERE "dateFin" IS NULL;`
  - TimescaleDB : `SELECT create_hypertable('telemetrie','timestamp');`
- Les tests de l'API utilisent un faux Prisma en mémoire : ils prouvent la logique applicative, pas le SQL.
- Pas encore d'endpoints de création de tenants et d'utilisateurs : le seed crée le premier administrateur (rôle « Super administrateur »).
