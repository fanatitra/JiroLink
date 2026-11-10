import { ValidationPipe } from '@nestjs/common';

/** Configuration unique du pipe de validation, partagée par main.ts et les tests. */
export const creerValidationPipe = () =>
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
