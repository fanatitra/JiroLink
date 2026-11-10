import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Env, ENV } from '../config/env';
import type { JwtPayload } from '../common/auth.types';

// Hash factice : on compare toujours un mot de passe, même si l'email est inconnu, pour que le temps de
// réponse ne révèle pas quels emails existent.
const HASH_FACTICE = bcrypt.hashSync('mot-de-passe-factice-jirolink', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(email: string, motDePasse: string): Promise<{ accessToken: string; expiresIn: string }> {
    const u = await this.prisma.utilisateur.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        tenant: { select: { statusTenant: true } },
        role: { select: { permissions: true } },
      },
    });

    const motDePasseValide = await bcrypt.compare(motDePasse, u?.motDePasseHash ?? HASH_FACTICE);
    // Message volontairement identique pour tous les échecs (email inconnu, mauvais mot de passe, compte inactif).
    if (!u || !motDePasseValide || u.statusUtilisateur !== 'ACTIF' || u.tenant.statusTenant !== 'ACTIF') {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const payload: JwtPayload = { sub: u.idUtilisateur, tenantId: u.tenantId, permissions: [...new Set(u.role.permissions)] };

    await this.prisma.utilisateur.update({ where: { idUtilisateur: u.idUtilisateur }, data: { derniereConnexion: new Date() } });
    return { accessToken: await this.jwt.signAsync(payload), expiresIn: this.env.jwtExpiresIn };
  }
}
