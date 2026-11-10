import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { DomainError, normaliserMac } from '../domain';

/** Normalise une adresse MAC reçue dans l'URL ("a4:cf:…" ou "A4CF…") ou refuse la requête (400). */
@Injectable()
export class ParseMacPipe implements PipeTransform<string, string> {
  transform(valeur: string): string {
    try {
      return normaliserMac(valeur);
    } catch (e) {
      if (e instanceof DomainError) throw new BadRequestException('Adresse MAC invalide');
      throw e;
    }
  }
}
