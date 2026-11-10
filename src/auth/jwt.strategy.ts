import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Env, ENV } from '../config/env';
import type { JwtPayload, UtilisateurCourant } from '../common/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ENV) env: Env) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): UtilisateurCourant {
    return { idUtilisateur: payload.sub, tenantId: payload.tenantId, permissions: new Set(payload.permissions) };
  }
}
