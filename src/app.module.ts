import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, PermissionsGuard } from './common/guards';
import { CompteursModule } from './compteurs/compteurs.module';
import { EnvModule } from './config/env.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [EnvModule, PrismaModule, AuthModule, CompteursModule],
  controllers: [HealthController],
  providers: [
    // Ordre d'exécution : 1) authentification, 2) permissions. Toute route est protégée sauf @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
