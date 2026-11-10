import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { chargerEnv } from './config/env';
import { creerValidationPipe } from './validation';

async function demarrer(): Promise<void> {
  const env = chargerEnv(); // échoue tôt, avec un message clair, si la configuration est invalide
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(creerValidationPipe());
  app.enableShutdownHooks();
  await app.listen(env.port);
  console.log(`JiroLink API à l'écoute sur http://localhost:${env.port}`);
}

demarrer().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
