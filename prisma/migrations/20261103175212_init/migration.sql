-- CreateEnum
CREATE TYPE "TypeTenant" AS ENUM ('PLATEFORME', 'MINI_CENTRALE', 'HOTEL', 'TELECOM');

-- CreateEnum
CREATE TYPE "StatusTenant" AS ENUM ('ACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "StatusUtilisateur" AS ENUM ('ACTIF', 'DESACTIVE', 'VERROUILLE');

-- CreateEnum
CREATE TYPE "StatutCompteur" AS ENUM ('ENREGISTRE', 'ACTIF', 'MAINTENANCE', 'DESACTIVE');

-- CreateEnum
CREATE TYPE "EtatConnexion" AS ENUM ('EN_LIGNE', 'HORS_LIGNE');

-- CreateEnum
CREATE TYPE "StatutLogement" AS ENUM ('LIBRE', 'OCCUPE');

-- CreateEnum
CREATE TYPE "StatusTarifProfil" AS ENUM ('BROUILLON', 'PROGRAMME', 'ACTIF', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "TypeTransaction" AS ENUM ('VENTE', 'RECHARGE_TOKEN', 'RECHARGE_DISTANTE', 'ANNULATION');

-- CreateEnum
CREATE TYPE "StatusTransaction" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'ANNULEE', 'ECHOUEE');

-- CreateEnum
CREATE TYPE "ModeDePaiement" AS ENUM ('ESPECES', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "StatusPaiement" AS ENUM ('EN_ATTENTE', 'PAYE', 'REFUSE');

-- CreateEnum
CREATE TYPE "StatusToken" AS ENUM ('GENERE', 'UTILISE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "TypeSynchronisation" AS ENUM ('TRANSACTIONS', 'CONFIGURATION', 'PROFIL_TARIFAIRE', 'FIRMWARE');

-- CreateEnum
CREATE TYPE "StatusSynchronisation" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ECHEC', 'CONFLIT');

-- CreateEnum
CREATE TYPE "EtatRelais" AS ENUM ('OUVERT', 'FERME');

-- CreateEnum
CREATE TYPE "TypeAlarme" AS ENUM ('SURCHAUFFE', 'INTRUSION', 'COUPURE_ANORMALE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutAlarme" AS ENUM ('DECLENCHEE', 'ACQUITTEE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "CanalNotification" AS ENUM ('SMS', 'EMAIL', 'PUSH', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "StatutNotification" AS ENUM ('EN_ATTENTE', 'ENVOYEE', 'LUE', 'ECHEC');

-- CreateEnum
CREATE TYPE "TypeCommande" AS ENUM ('COUPER_RELAIS', 'REACTIVER_RELAIS', 'REDEMARRER', 'SYNC_HEURE', 'MODIFIER_CONFIG');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('EN_ATTENTE', 'ENVOYEE', 'EXECUTEE', 'ECHOUEE', 'EXPIREE');

-- CreateTable
CREATE TABLE "tenant" (
    "idTenant" UUID NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "typeTenant" "TypeTenant" NOT NULL,
    "statusTenant" "StatusTenant" NOT NULL DEFAULT 'ACTIF',
    "adresse" VARCHAR(255),
    "telephone" VARCHAR(30),
    "email" VARCHAR(150),
    "cin" VARCHAR(30),

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("idTenant")
);

-- CreateTable
CREATE TABLE "site" (
    "idSite" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "province" VARCHAR(100),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),

    CONSTRAINT "site_pkey" PRIMARY KEY ("idSite")
);

-- CreateTable
CREATE TABLE "client" (
    "idClient" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "prenom" VARCHAR(150),
    "adresse" VARCHAR(255),

    CONSTRAINT "client_pkey" PRIMARY KEY ("idClient")
);

-- CreateTable
CREATE TABLE "logement" (
    "idLogement" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "reference" VARCHAR(50) NOT NULL,
    "type" VARCHAR(50),
    "statut" "StatutLogement" NOT NULL DEFAULT 'LIBRE',

    CONSTRAINT "logement_pkey" PRIMARY KEY ("idLogement")
);

-- CreateTable
CREATE TABLE "role" (
    "idRole" UUID NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "permissions" TEXT[],

    CONSTRAINT "role_pkey" PRIMARY KEY ("idRole")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "idUtilisateur" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "prenom" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "telephone" VARCHAR(30),
    "motDePasseHash" VARCHAR(255) NOT NULL,
    "statusUtilisateur" "StatusUtilisateur" NOT NULL DEFAULT 'ACTIF',
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereConnexion" TIMESTAMP(3),

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("idUtilisateur")
);

-- CreateTable
CREATE TABLE "compteur" (
    "adresseMac" VARCHAR(12) NOT NULL,
    "tenantId" UUID NOT NULL,
    "numeroSerie" VARCHAR(100) NOT NULL,
    "modele" VARCHAR(100),
    "versionFirmware" VARCHAR(30),
    "statutCompteur" "StatutCompteur" NOT NULL DEFAULT 'ENREGISTRE',
    "etatConnexion" "EtatConnexion" NOT NULL DEFAULT 'HORS_LIGNE',
    "solde" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "soldeMisAJourLe" TIMESTAMP(3),
    "dernierIndexEmis" INTEGER NOT NULL DEFAULT 0,
    "secretKeyHash" VARCHAR(255) NOT NULL,
    "profilTarifaireId" UUID,

    CONSTRAINT "compteur_pkey" PRIMARY KEY ("adresseMac")
);

-- CreateTable
CREATE TABLE "affectation_compteur" (
    "idAffectation" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "compteurMac" VARCHAR(12) NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "affectation_compteur_pkey" PRIMARY KEY ("idAffectation")
);

-- CreateTable
CREATE TABLE "configuration_compteur" (
    "idConfiguration" UUID NOT NULL,
    "compteurMac" VARCHAR(12) NOT NULL,
    "utilisateurId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "seuilsAlarme" JSONB NOT NULL,
    "parametreReseau" JSONB NOT NULL,
    "optionFonctionnement" JSONB NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModification" TIMESTAMP(3),

    CONSTRAINT "configuration_compteur_pkey" PRIMARY KEY ("idConfiguration")
);

-- CreateTable
CREATE TABLE "synchronisation" (
    "idSynchronisation" UUID NOT NULL,
    "compteurMac" VARCHAR(12) NOT NULL,
    "typeSynchronisation" "TypeSynchronisation" NOT NULL,
    "status" "StatusSynchronisation" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "donnees" JSONB,

    CONSTRAINT "synchronisation_pkey" PRIMARY KEY ("idSynchronisation")
);

-- CreateTable
CREATE TABLE "transaction" (
    "idTransaction" UUID NOT NULL,
    "type" "TypeTransaction" NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "credits" DECIMAL(12,2) NOT NULL,
    "statusTransaction" "StatusTransaction" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateTransaction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modeDePaiement" "ModeDePaiement",
    "statusPaiement" "StatusPaiement" NOT NULL DEFAULT 'EN_ATTENTE',

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("idTransaction")
);

-- CreateTable
CREATE TABLE "facture" (
    "idFacture" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "affectationId" UUID NOT NULL,
    "utilisateurId" UUID NOT NULL,
    "dateFacture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facture_pkey" PRIMARY KEY ("idFacture")
);

-- CreateTable
CREATE TABLE "token" (
    "idToken" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "compteurMac" VARCHAR(12) NOT NULL,
    "codeHash" VARCHAR(128) NOT NULL,
    "status" "StatusToken" NOT NULL DEFAULT 'GENERE',
    "sequenceIndex" INTEGER NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateExpiration" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_pkey" PRIMARY KEY ("idToken")
);

-- CreateTable
CREATE TABLE "profil_tarifaire" (
    "idProfile" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "statusTarifProfil" "StatusTarifProfil" NOT NULL DEFAULT 'BROUILLON',
    "dateActivation" TIMESTAMP(3),
    "versionProfil" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "profil_tarifaire_pkey" PRIMARY KEY ("idProfile")
);

-- CreateTable
CREATE TABLE "modification_tarif" (
    "idModification" UUID NOT NULL,
    "idProfile" UUID NOT NULL,
    "utilisateurId" UUID NOT NULL,
    "dateModification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modification_tarif_pkey" PRIMARY KEY ("idModification")
);

-- CreateTable
CREATE TABLE "plage_horaire" (
    "idPlageHoraire" UUID NOT NULL,
    "idProfile" UUID NOT NULL,
    "libelle" VARCHAR(100) NOT NULL,
    "dateDepart" TIME(0) NOT NULL,
    "dateFin" TIME(0) NOT NULL,

    CONSTRAINT "plage_horaire_pkey" PRIMARY KEY ("idPlageHoraire")
);

-- CreateTable
CREATE TABLE "tarif_coefficient" (
    "idTarifCoef" UUID NOT NULL,
    "idPlageHoraire" UUID NOT NULL,
    "valeur" DECIMAL(6,3) NOT NULL,
    "priorite" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tarif_coefficient_pkey" PRIMARY KEY ("idTarifCoef")
);

-- CreateTable
CREATE TABLE "jour_ferie" (
    "idJourFerie" UUID NOT NULL,
    "idProfile" UUID NOT NULL,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE NOT NULL,
    "libelle" VARCHAR(150),
    "specialCoefficient" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "jour_ferie_pkey" PRIMARY KEY ("idJourFerie")
);

-- CreateTable
CREATE TABLE "telemetrie" (
    "idTelemetrie" UUID NOT NULL,
    "compteurMac" VARCHAR(12) NOT NULL,
    "tension" DECIMAL(6,2),
    "courant" DECIMAL(6,2),
    "temperature" DECIMAL(5,2),
    "etatRelais" "EtatRelais" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "recuLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heapLibre" INTEGER,

    CONSTRAINT "telemetrie_pkey" PRIMARY KEY ("idTelemetrie","timestamp")
);

-- CreateTable
CREATE TABLE "alarme" (
    "idAlarme" UUID NOT NULL,
    "compteurMac" VARCHAR(12) NOT NULL,
    "acquitteParId" UUID,
    "type" "TypeAlarme" NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutAlarme" NOT NULL DEFAULT 'DECLENCHEE',
    "message" VARCHAR(500) NOT NULL,
    "dateAcquittement" TIMESTAMP(3),

    CONSTRAINT "alarme_pkey" PRIMARY KEY ("idAlarme")
);

-- CreateTable
CREATE TABLE "notification" (
    "idNotification" UUID NOT NULL,
    "idAlarme" UUID NOT NULL,
    "canal" "CanalNotification" NOT NULL,
    "destinataire" VARCHAR(150) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "statut" "StatutNotification" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateEnvoi" TIMESTAMP(3),
    "dateLecture" TIMESTAMP(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("idNotification")
);

-- CreateTable
CREATE TABLE "commande" (
    "idCommande" UUID NOT NULL,
    "compteurMac" VARCHAR(12) NOT NULL,
    "utilisateurId" UUID NOT NULL,
    "type" "TypeCommande" NOT NULL,
    "statut" "StatutCommande" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateExecution" TIMESTAMP(3),
    "dateConfirmation" TIMESTAMP(3),
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,

    CONSTRAINT "commande_pkey" PRIMARY KEY ("idCommande")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "idEvenement" UUID NOT NULL,
    "tenantId" UUID,
    "utilisateurId" UUID,
    "compteurMac" VARCHAR(12),
    "typeEvenement" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "donneesAvant" JSONB,
    "donneesApres" JSONB,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("idEvenement")
);

-- CreateIndex
CREATE INDEX "site_tenantId_idx" ON "site"("tenantId");

-- CreateIndex
CREATE INDEX "client_siteId_idx" ON "client"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "logement_clientId_reference_key" ON "logement"("clientId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "role_nom_key" ON "role"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "utilisateur_tenantId_idx" ON "utilisateur"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "compteur_numeroSerie_key" ON "compteur"("numeroSerie");

-- CreateIndex
CREATE INDEX "compteur_tenantId_statutCompteur_idx" ON "compteur"("tenantId", "statutCompteur");

-- CreateIndex
CREATE INDEX "affectation_compteur_compteurMac_dateFin_idx" ON "affectation_compteur"("compteurMac", "dateFin");

-- CreateIndex
CREATE INDEX "affectation_compteur_clientId_idx" ON "affectation_compteur"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_compteur_compteurMac_version_key" ON "configuration_compteur"("compteurMac", "version");

-- CreateIndex
CREATE INDEX "synchronisation_compteurMac_status_idx" ON "synchronisation"("compteurMac", "status");

-- CreateIndex
CREATE INDEX "transaction_dateTransaction_idx" ON "transaction"("dateTransaction");

-- CreateIndex
CREATE UNIQUE INDEX "facture_transactionId_key" ON "facture"("transactionId");

-- CreateIndex
CREATE INDEX "facture_affectationId_idx" ON "facture"("affectationId");

-- CreateIndex
CREATE INDEX "facture_utilisateurId_idx" ON "facture"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "token_transactionId_key" ON "token"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "token_codeHash_key" ON "token"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "token_compteurMac_sequenceIndex_key" ON "token"("compteurMac", "sequenceIndex");

-- CreateIndex
CREATE UNIQUE INDEX "profil_tarifaire_tenantId_nom_versionProfil_key" ON "profil_tarifaire"("tenantId", "nom", "versionProfil");

-- CreateIndex
CREATE INDEX "modification_tarif_idProfile_idx" ON "modification_tarif"("idProfile");

-- CreateIndex
CREATE INDEX "plage_horaire_idProfile_idx" ON "plage_horaire"("idProfile");

-- CreateIndex
CREATE INDEX "tarif_coefficient_idPlageHoraire_idx" ON "tarif_coefficient"("idPlageHoraire");

-- CreateIndex
CREATE INDEX "jour_ferie_idProfile_idx" ON "jour_ferie"("idProfile");

-- CreateIndex
CREATE UNIQUE INDEX "telemetrie_compteurMac_timestamp_key" ON "telemetrie"("compteurMac", "timestamp");

-- CreateIndex
CREATE INDEX "alarme_compteurMac_statut_idx" ON "alarme"("compteurMac", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "alarme_compteurMac_type_dateCreation_key" ON "alarme"("compteurMac", "type", "dateCreation");

-- CreateIndex
CREATE INDEX "notification_idAlarme_idx" ON "notification"("idAlarme");

-- CreateIndex
CREATE INDEX "commande_compteurMac_statut_idx" ON "commande"("compteurMac", "statut");

-- CreateIndex
CREATE INDEX "journal_audit_horodatage_idx" ON "journal_audit"("horodatage" DESC);

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("idTenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("idSite") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logement" ADD CONSTRAINT "logement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("idClient") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("idTenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("idRole") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compteur" ADD CONSTRAINT "compteur_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("idTenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compteur" ADD CONSTRAINT "compteur_profilTarifaireId_fkey" FOREIGN KEY ("profilTarifaireId") REFERENCES "profil_tarifaire"("idProfile") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectation_compteur" ADD CONSTRAINT "affectation_compteur_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("idClient") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectation_compteur" ADD CONSTRAINT "affectation_compteur_compteurMac_fkey" FOREIGN KEY ("compteurMac") REFERENCES "compteur"("adresseMac") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_compteur" ADD CONSTRAINT "configuration_compteur_compteurMac_fkey" FOREIGN KEY ("compteurMac") REFERENCES "compteur"("adresseMac") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_compteur" ADD CONSTRAINT "configuration_compteur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateur"("idUtilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synchronisation" ADD CONSTRAINT "synchronisation_compteurMac_fkey" FOREIGN KEY ("compteurMac") REFERENCES "compteur"("adresseMac") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("idTransaction") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_affectationId_fkey" FOREIGN KEY ("affectationId") REFERENCES "affectation_compteur"("idAffectation") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateur"("idUtilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token" ADD CONSTRAINT "token_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("idTransaction") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token" ADD CONSTRAINT "token_compteurMac_fkey" FOREIGN KEY ("compteurMac") REFERENCES "compteur"("adresseMac") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_tarifaire" ADD CONSTRAINT "profil_tarifaire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("idTenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modification_tarif" ADD CONSTRAINT "modification_tarif_idProfile_fkey" FOREIGN KEY ("idProfile") REFERENCES "profil_tarifaire"("idProfile") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modification_tarif" ADD CONSTRAINT "modification_tarif_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateur"("idUtilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plage_horaire" ADD CONSTRAINT "plage_horaire_idProfile_fkey" FOREIGN KEY ("idProfile") REFERENCES "profil_tarifaire"("idProfile") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif_coefficient" ADD CONSTRAINT "tarif_coefficient_idPlageHoraire_fkey" FOREIGN KEY ("idPlageHoraire") REFERENCES "plage_horaire"("idPlageHoraire") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jour_ferie" ADD CONSTRAINT "jour_ferie_idProfile_fkey" FOREIGN KEY ("idProfile") REFERENCES "profil_tarifaire"("idProfile") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetrie" ADD CONSTRAINT "telemetrie_compteurMac_fkey" FOREIGN KEY ("compteurMac") REFERENCES "compteur"("adresseMac") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarme" ADD CONSTRAINT "alarme_compteurMac_fkey" FOREIGN KEY ("compteurMac") REFERENCES "compteur"("adresseMac") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarme" ADD CONSTRAINT "alarme_acquitteParId_fkey" FOREIGN KEY ("acquitteParId") REFERENCES "utilisateur"("idUtilisateur") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_idAlarme_fkey" FOREIGN KEY ("idAlarme") REFERENCES "alarme"("idAlarme") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commande" ADD CONSTRAINT "commande_compteurMac_fkey" FOREIGN KEY ("compteurMac") REFERENCES "compteur"("adresseMac") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commande" ADD CONSTRAINT "commande_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateur"("idUtilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("idTenant") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateur"("idUtilisateur") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_compteurMac_fkey" FOREIGN KEY ("compteurMac") REFERENCES "compteur"("adresseMac") ON DELETE SET NULL ON UPDATE CASCADE;
