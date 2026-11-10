import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { CodePermission } from './permissions';
import type { UtilisateurCourant } from './auth.types';

export const CLE_PUBLIC = 'jirolink:public';
export const CLE_PERMISSIONS = 'jirolink:permissions';

/** Route sans authentification (login, santé). Toute autre route est protégée par défaut. */
export const Public = () => SetMetadata(CLE_PUBLIC, true);

/** Permissions toutes requises pour appeler la route. */
export const RequirePermissions = (...permissions: CodePermission[]) => SetMetadata(CLE_PERMISSIONS, permissions);

export const CurrentUser = createParamDecorator((_donnee: unknown, ctx: ExecutionContext): UtilisateurCourant => {
  return ctx.switchToHttp().getRequest<{ user: UtilisateurCourant }>().user;
});
