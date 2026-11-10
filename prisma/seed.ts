/**
 * Données initiales : rôles, tenant « plateforme » et premier administrateur.
 *   npm run db:seed        (SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD requis dans .env)
 *
 * Aucun mot de passe par défaut n'existe (cahier des charges §03/§11) : il est fourni à l'exécution.
 * La matrice rôles → permissions est PROVISOIRE (point ouvert n°4). Relancer le seed met les permissions
 * des rôles système à jour avec la matrice du code.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ROLES_PAR_DEFAUT } from '../src/common/permissions';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const motDePasse = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !motDePasse || motDePasse.length < 12) {
    throw new Error('SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD (12 caractères minimum) sont requis : aucun mot de passe par défaut n’est prévu.');
  }

  for (const r of ROLES_PAR_DEFAUT) {
    await prisma.role.upsert({
      where: { nom: r.nom },
      update: { description: r.description, permissions: [...r.permissions] },
      create: { nom: r.nom, description: r.description, permissions: [...r.permissions] },
    });
  }

  const tenant =
    (await prisma.tenant.findFirst({ where: { typeTenant: 'PLATEFORME' } })) ??
    (await prisma.tenant.create({ data: { nom: 'JiroLink — plateforme', typeTenant: 'PLATEFORME' } }));

  const role = await prisma.role.findUniqueOrThrow({ where: { nom: 'Super administrateur' } });
  const existant = await prisma.utilisateur.findUnique({ where: { email } });
  if (!existant) {
    await prisma.utilisateur.create({
      data: {
        tenantId: tenant.idTenant,
        roleId: role.idRole,
        nom: 'Administrateur',
        prenom: 'Plateforme',
        email,
        motDePasseHash: await bcrypt.hash(motDePasse, 12),
      },
    });
  }

  console.log(`${existant ? 'Administrateur déjà présent' : 'Administrateur créé'} : ${email} (tenant ${tenant.nom}, rôle ${role.nom})`);
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
