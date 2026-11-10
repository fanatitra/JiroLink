import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CLE_PERMISSIONS, CLE_PUBLIC } from './decorators';
import type { UtilisateurCourant } from './auth.types';

/** Appliqué globalement : toute route exige un JWT valide sauf si elle est marquée @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(ctx: ExecutionContext) {
    const publique = this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    return publique ? true : super.canActivate(ctx);
  }
}

/** Appliqué globalement, après l'authentification : vérifie les permissions déclarées par @RequirePermissions(). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const publique = this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (publique) return true;

    const requises = this.reflector.getAllAndOverride<string[]>(CLE_PERMISSIONS, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (requises.length === 0) return true;

    const user = ctx.switchToHttp().getRequest<{ user?: UtilisateurCourant }>().user;
    if (!user || !requises.every((p) => user.permissions.has(p))) {
      throw new ForbiddenException('Permission insuffisante');
    }
    return true;
  }
}
