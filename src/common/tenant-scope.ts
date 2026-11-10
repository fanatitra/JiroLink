import { P } from './permissions';
import type { UtilisateurCourant } from './auth.types';

/**
 * Isolation par tenant (cahier des charges §06 : « séparation hermétique »).
 *
 * Règle : toute requête Prisma sur une donnée appartenant à un tenant DOIT spread ce filtre dans son `where`.
 * Les utilisateurs portant PLATEFORME:VUE_NATIONALE (technicien Control Room) voient tous les tenants.
 *
 * Limite assumée : c'est une convention appliquée dans les services (et vérifiée par les tests), pas
 * une barrière technique. Le durcissement prévu est le Row-Level Security PostgreSQL.
 */
export function filtreTenant(user: UtilisateurCourant): { tenantId?: string } {
  return user.permissions.has(P.PLATEFORME_VUE_NATIONALE) ? {} : { tenantId: user.tenantId };
}

export function estVueNationale(user: UtilisateurCourant): boolean {
  return user.permissions.has(P.PLATEFORME_VUE_NATIONALE);
}
