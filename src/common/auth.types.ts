/** Contenu du JWT. Les permissions y sont embarquées : durée de vie courte (JWT_EXPIRES_IN) pour limiter la dérive. */
export interface JwtPayload {
  sub: string; // idUtilisateur
  tenantId: string;
  permissions: string[];
}

/** Utilisateur authentifié, attaché à la requête par la stratégie JWT. */
export interface UtilisateurCourant {
  idUtilisateur: string;
  tenantId: string;
  permissions: ReadonlySet<string>;
}
